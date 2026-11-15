import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MIN_REJECTION_REASON_LENGTH,
  PettyCashPeriodStatus,
  PettyCashStatus,
  PettyCashVoucherStatus,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { assertPositiveUsdAmount } from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import {
  assertPeriodCanBeClosed,
  assertValidYearMonth,
  calculateBalanceAfterVoucherDisbursement,
  calculateBalanceAfterVoucherSettlement,
  calculateOpeningAvailableBalance,
} from './domain/petty-cash-balance.calculator';
import {
  CreatePettyCashDto,
  OpenPettyCashPeriodDto,
  RequestVoucherDto,
  SettleVoucherDto,
} from './dto/petty-cash.dto';

@Injectable()
export class PettyCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Crea una Caja Chica asignada a un Proyecto (RN-CAJA-01).
   */
  async createPettyCash(dto: CreatePettyCashDto, actor: AuthenticatedUser) {
    const cleanCode = dto.code.trim().toUpperCase();
    const authorizedDec = assertPositiveUsdAmount(
      dto.authorizedAmount,
      'authorizedAmount',
    );

    const existing = await this.prisma.pettyCash.findUnique({
      where: { code: cleanCode },
    });

    if (existing) {
      throw new ConflictException(
        `[RN-CAJA-01] Ya existe una caja chica con el código '${cleanCode}'.`,
      );
    }

    const created = await this.prisma.pettyCash.create({
      data: {
        code: cleanCode,
        name: dto.name.trim(),
        projectId: dto.projectId,
        authorizedAmount: authorizedDec.toFixed(2),
        status: PettyCashStatus.ACTIVA,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CREATE_PETTY_CASH',
      tableName: 'petty_cashes',
      recordId: created.id,
      oldValues: null,
      newValues: {
        code: created.code,
        projectId: created.projectId,
        authorizedAmount: authorizedDec.toFixed(2),
      },
    });

    return created;
  }

  /**
   * Solicita la apertura mensual de una caja chica arrastrando automáticamente el saldo de cierre del mes anterior (RN-CAJA-02 y RN-CAJA-04).
   */
  async openMonthlyPeriod(
    pettyCashId: string,
    dto: OpenPettyCashPeriodDto,
    actor: AuthenticatedUser,
  ) {
    const yearMonth = assertValidYearMonth(dto.yearMonth);

    const openOrRequested = await this.prisma.pettyCashPeriod.findFirst({
      where: {
        pettyCashId,
        status: {
          in: [PettyCashPeriodStatus.SOLICITADO, PettyCashPeriodStatus.ABIERTO],
        },
      },
    });

    if (openOrRequested) {
      throw new ConflictException(
        `[RN-CAJA-02] La caja chica ya posee un período activo o en solicitud (${openOrRequested.yearMonth}). Debe cerrarse antes de abrir uno nuevo.`,
      );
    }

    const lastClosedPeriod = await this.prisma.pettyCashPeriod.findFirst({
      where: {
        pettyCashId,
        status: PettyCashPeriodStatus.CERRADO,
      },
      orderBy: { yearMonth: 'desc' },
    });

    const carryoverBalance = lastClosedPeriod?.closingBalance
      ? lastClosedPeriod.closingBalance.toString()
      : '0.00';

    const availableBalance = calculateOpeningAvailableBalance(
      carryoverBalance,
      dto.initialReplenishment,
    );

    const createdPeriod = await this.prisma.pettyCashPeriod.create({
      data: {
        pettyCashId,
        yearMonth,
        carryoverBalance,
        initialReplenishment: String(dto.initialReplenishment),
        availableBalance,
        status: PettyCashPeriodStatus.SOLICITADO,
        openedById: actor.id,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'OPEN_PETTY_CASH_PERIOD',
      tableName: 'petty_cash_periods',
      recordId: createdPeriod.id,
      oldValues: null,
      newValues: {
        yearMonth,
        carryoverBalance,
        availableBalance,
      },
    });

    return createdPeriod;
  }

  /**
   * Aprueba la apertura mensual de la caja chica por parte de Gerencia (Exclusivo RECEPTOR según RN-SEG-02).
   */
  async approvePeriodOpening(periodId: string, actor: AuthenticatedUser) {
    const period = await this.prisma.pettyCashPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period) {
      throw new NotFoundException(`El período de caja chica '${periodId}' no existe.`);
    }

    if (period.status !== PettyCashPeriodStatus.SOLICITADO) {
      throw new BadRequestException(
        `[RN-CAJA-02] Solo se puede aprobar un período en estado SOLICITADO (actual: ${period.status}).`,
      );
    }

    const updated = await this.prisma.pettyCashPeriod.update({
      where: { id: periodId },
      data: {
        status: PettyCashPeriodStatus.ABIERTO,
        approvedById: actor.id,
        openedAt: new Date(),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'APPROVE_PETTY_CASH_PERIOD',
      tableName: 'petty_cash_periods',
      recordId: periodId,
      oldValues: { status: period.status },
      newValues: { status: PettyCashPeriodStatus.ABIERTO },
    });

    return updated;
  }

  /**
   * Solicita un vale de caja chica verificando que no supere el saldo disponible actual (RN-CAJA-02 y RN-CAJA-03).
   */
  async requestVoucher(
    periodId: string,
    dto: RequestVoucherDto,
    actor: AuthenticatedUser,
  ) {
    const period = await this.prisma.pettyCashPeriod.findUnique({
      where: { id: periodId },
    });

    if (!period || period.status !== PettyCashPeriodStatus.ABIERTO) {
      throw new BadRequestException(
        '[RN-CAJA-02] Solo se pueden solicitar vales sobre un período mensual ABIERTO.',
      );
    }

    // Verifica que el monto solicitado quepa dentro del saldo disponible actual (RN-CAJA-02)
    calculateBalanceAfterVoucherDisbursement(
      period.availableBalance.toString(),
      dto.requestedAmount,
    );

    const requestedDec = assertPositiveUsdAmount(
      dto.requestedAmount,
      'requestedAmount',
    );

    const voucher = await this.prisma.pettyCashVoucher.create({
      data: {
        code: dto.code.trim().toUpperCase(),
        periodId,
        requestedById: actor.id,
        beneficiaryName: dto.beneficiaryName.trim(),
        concept: dto.concept.trim(),
        requestedAmount: requestedDec.toFixed(2),
        status: PettyCashVoucherStatus.SOLICITADO,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'REQUEST_PETTY_CASH_VOUCHER',
      tableName: 'petty_cash_vouchers',
      recordId: voucher.id,
      oldValues: null,
      newValues: {
        code: voucher.code,
        requestedAmount: requestedDec.toFixed(2),
      },
    });

    return voucher;
  }

  /**
   * Aprueba un vale solicitado por el GENERADOR. La aprobación no mueve saldo;
   * el desembolso es una etapa posterior (RN-CAJA-03 / RN-SEG-02).
   */
  async approveVoucher(voucherId: string, actor: AuthenticatedUser) {
    const voucher = await this.prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { period: true },
    });

    if (!voucher) {
      throw new NotFoundException(`El vale '${voucherId}' no existe.`);
    }

    if (voucher.status !== PettyCashVoucherStatus.SOLICITADO) {
      throw new BadRequestException(
        `[RN-CAJA-03] Solo se puede aprobar un vale en estado SOLICITADO (actual: ${voucher.status}).`,
      );
    }

    if (voucher.period.status !== PettyCashPeriodStatus.ABIERTO) {
      throw new BadRequestException(
        '[RN-CAJA-02] Solo se pueden aprobar vales de un período mensual ABIERTO.',
      );
    }

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id: voucherId },
      data: {
        status: PettyCashVoucherStatus.APROBADO,
        approvedById: actor.id,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'APPROVE_PETTY_CASH_VOUCHER',
      tableName: 'petty_cash_vouchers',
      recordId: voucherId,
      oldValues: { status: voucher.status },
      newValues: { status: PettyCashVoucherStatus.APROBADO },
    });

    return updated;
  }

  /**
   * Rechaza un vale solicitado o aprobado antes de su desembolso (RN-CAJA-03).
   */
  async rejectVoucher(
    voucherId: string,
    reason: string,
    actor: AuthenticatedUser,
  ) {
    const cleanReason = (reason ?? '').trim();
    if (cleanReason.length < MIN_REJECTION_REASON_LENGTH) {
      throw new BadRequestException(
        `[RN-CAJA-03] El motivo de rechazo debe tener al menos ${MIN_REJECTION_REASON_LENGTH} caracteres.`,
      );
    }

    const voucher = await this.prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { period: true },
    });

    if (!voucher) {
      throw new NotFoundException(`El vale '${voucherId}' no existe.`);
    }

    if (
      voucher.status !== PettyCashVoucherStatus.SOLICITADO &&
      voucher.status !== PettyCashVoucherStatus.APROBADO
    ) {
      throw new BadRequestException(
        `[RN-CAJA-03] Solo se pueden rechazar vales SOLICITADO o APROBADO antes del desembolso (actual: ${voucher.status}).`,
      );
    }

    if (voucher.period.status !== PettyCashPeriodStatus.ABIERTO) {
      throw new BadRequestException(
        '[RN-CAJA-02] Solo se pueden rechazar vales de un período mensual ABIERTO.',
      );
    }

    const updated = await this.prisma.pettyCashVoucher.update({
      where: { id: voucherId },
      data: {
        status: PettyCashVoucherStatus.RECHAZADO,
        rejectionReason: cleanReason,
        approvedById: actor.id,
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'REJECT_PETTY_CASH_VOUCHER',
      tableName: 'petty_cash_vouchers',
      recordId: voucherId,
      oldValues: { status: voucher.status },
      newValues: {
        status: PettyCashVoucherStatus.RECHAZADO,
        rejectionReason: cleanReason,
      },
    });

    return updated;
  }

  /**
   * Desembolsa un vale previamente APROBADO, descontando del saldo disponible
   * (RN-CAJA-02 y RN-CAJA-03).
   */
  async disburseVoucher(voucherId: string, actor: AuthenticatedUser) {
    const voucher = await this.prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { period: true },
    });

    if (!voucher) {
      throw new NotFoundException(`El vale '${voucherId}' no existe.`);
    }

    if (voucher.status !== PettyCashVoucherStatus.APROBADO) {
      throw new BadRequestException(
        `[RN-CAJA-03] El vale debe estar APROBADO para desembolsarse (actual: ${voucher.status}).`,
      );
    }

    if (voucher.period.status !== PettyCashPeriodStatus.ABIERTO) {
      throw new BadRequestException(
        '[RN-CAJA-02] Solo se pueden desembolsar vales de un período mensual ABIERTO.',
      );
    }

    const newAvailableBalance = calculateBalanceAfterVoucherDisbursement(
      voucher.period.availableBalance.toString(),
      voucher.requestedAmount.toString(),
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedVoucher = await tx.pettyCashVoucher.update({
        where: { id: voucherId },
        data: {
          status: PettyCashVoucherStatus.DESEMBOLSADO,
          disbursedById: actor.id,
          disbursedAmount: voucher.requestedAmount.toString(),
        },
      });

      await tx.pettyCashPeriod.update({
        where: { id: voucher.periodId },
        data: { availableBalance: newAvailableBalance },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'DISBURSE_PETTY_CASH_VOUCHER',
          tableName: 'petty_cash_vouchers',
          recordId: voucherId,
          oldValues: {
            status: voucher.status,
            availableBalance: voucher.period.availableBalance.toString(),
          },
          newValues: {
            status: PettyCashVoucherStatus.DESEMBOLSADO,
            availableBalance: newAvailableBalance,
          },
        },
        tx,
      );

      return { voucher: updatedVoucher, newAvailableBalance };
    });
  }

  /**
   * Rinde un vale desembolsado adjuntando referencia/comprobante y reintegrando el vuelto sobrante (RN-CAJA-03).
   */
  async settleVoucher(
    voucherId: string,
    dto: SettleVoucherDto,
    actor: AuthenticatedUser,
  ) {
    const cleanInvoice = (dto.invoiceReference ?? '').trim();
    if (!cleanInvoice) {
      throw new BadRequestException(
        '[RN-CAJA-03] La referencia de factura o comprobante es obligatoria para rendir el vale.',
      );
    }

    const cleanAttachment = (dto.attachmentUrl ?? '').trim();
    if (!cleanAttachment) {
      throw new BadRequestException(
        '[RN-CAJA-03] El archivo del comprobante es obligatorio para rendir el vale.',
      );
    }

    const voucher = await this.prisma.pettyCashVoucher.findUnique({
      where: { id: voucherId },
      include: { period: true },
    });

    if (!voucher) {
      throw new NotFoundException(`El vale '${voucherId}' no existe.`);
    }

    if (voucher.status !== PettyCashVoucherStatus.DESEMBOLSADO) {
      throw new BadRequestException(
        `[RN-CAJA-03] Solo se pueden rendir vales en estado DESEMBOLSADO (actual: ${voucher.status}).`,
      );
    }

    const settlement = calculateBalanceAfterVoucherSettlement(
      voucher.period.availableBalance.toString(),
      (voucher.disbursedAmount ?? voucher.requestedAmount).toString(),
      dto.settledAmount,
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedVoucher = await tx.pettyCashVoucher.update({
        where: { id: voucherId },
        data: {
          status: PettyCashVoucherStatus.RENDIDO,
          settledAmount: String(dto.settledAmount),
          returnedAmount: settlement.returnedChange,
          invoiceReference: cleanInvoice,
          attachmentUrl: cleanAttachment,
        },
      });

      await tx.pettyCashPeriod.update({
        where: { id: voucher.periodId },
        data: { availableBalance: settlement.newAvailableBalance },
      });

      await this.auditService.recordLog(
        {
          userId: actor.id,
          userRole: actor.role,
          action: 'SETTLE_PETTY_CASH_VOUCHER',
          tableName: 'petty_cash_vouchers',
          recordId: voucherId,
          oldValues: { status: PettyCashVoucherStatus.DESEMBOLSADO },
          newValues: {
            status: PettyCashVoucherStatus.RENDIDO,
            settledAmount: String(dto.settledAmount),
            returnedChange: settlement.returnedChange,
            invoiceReference: cleanInvoice,
          },
        },
        tx,
      );

      return {
        voucher: updatedVoucher,
        newAvailableBalance: settlement.newAvailableBalance,
      };
    });
  }

  /**
   * Cierra el mes de la caja chica congelando el closingBalance para arrastrarlo al mes siguiente (RN-CAJA-04).
   */
  async closeMonthlyPeriod(periodId: string, actor: AuthenticatedUser) {
    const period = await this.prisma.pettyCashPeriod.findUnique({
      where: { id: periodId },
      include: { vouchers: true },
    });

    if (!period) {
      throw new NotFoundException(`El período '${periodId}' no existe.`);
    }

    if (period.status !== PettyCashPeriodStatus.ABIERTO) {
      throw new BadRequestException(
        `[RN-CAJA-04] Solo se puede cerrar un período que se encuentre ABIERTO (actual: ${period.status}).`,
      );
    }

    assertPeriodCanBeClosed(
      period.vouchers.map(
        (v) => v.status as unknown as PettyCashVoucherStatus,
      ),
    );

    const closingBalance = period.availableBalance.toString();

    const closed = await this.prisma.pettyCashPeriod.update({
      where: { id: periodId },
      data: {
        status: PettyCashPeriodStatus.CERRADO,
        closingBalance,
        closedById: actor.id,
        closedAt: new Date(),
      },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CLOSE_PETTY_CASH_PERIOD',
      tableName: 'petty_cash_periods',
      recordId: periodId,
      oldValues: { status: PettyCashPeriodStatus.ABIERTO },
      newValues: {
        status: PettyCashPeriodStatus.CERRADO,
        closingBalanceForNextMonthCarryover: closingBalance,
      },
    });

    return closed;
  }

  /**
   * Cierra definitivamente una caja chica cuando no posee períodos activos
   * (RN-CAJA-01 / RN-CAJA-04).
   */
  async closePettyCash(pettyCashId: string, actor: AuthenticatedUser) {
    const pettyCash = await this.prisma.pettyCash.findUnique({
      where: { id: pettyCashId },
      include: { periods: true },
    });

    if (!pettyCash) {
      throw new NotFoundException(
        `La caja chica con ID '${pettyCashId}' no existe.`,
      );
    }

    if (pettyCash.status === PettyCashStatus.CERRADA) {
      throw new BadRequestException(
        '[RN-CAJA-04] La caja chica ya se encuentra CERRADA.',
      );
    }

    const activePeriod = pettyCash.periods.find(
      (period) =>
        period.status === PettyCashPeriodStatus.SOLICITADO ||
        period.status === PettyCashPeriodStatus.ABIERTO,
    );

    if (activePeriod) {
      throw new BadRequestException(
        `[RN-CAJA-04] No se puede cerrar la caja chica mientras el período ${activePeriod.yearMonth} esté SOLICITADO o ABIERTO.`,
      );
    }

    const updated = await this.prisma.pettyCash.update({
      where: { id: pettyCashId },
      data: { status: PettyCashStatus.CERRADA },
    });

    await this.auditService.recordLog({
      userId: actor.id,
      userRole: actor.role,
      action: 'CLOSE_PETTY_CASH',
      tableName: 'petty_cashes',
      recordId: pettyCashId,
      oldValues: { status: pettyCash.status },
      newValues: { status: PettyCashStatus.CERRADA },
    });

    return updated;
  }

  /**
   * Lista todas las cajas chicas con su proyecto, períodos mensuales y vales asociados (RN-CAJA-01 a 04).
   */
  async findAllPettyCashes() {
    return this.prisma.pettyCash.findMany({
      include: {
        project: true,
        periods: {
          orderBy: { yearMonth: 'desc' },
          include: {
            vouchers: {
              orderBy: { createdAt: 'desc' },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
    });
  }
}
