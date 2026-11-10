import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  PettyCashPeriodStatus,
  PettyCashVoucherStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PettyCashService } from './petty-cash.service';

describe('PettyCashService (RN-CAJA-01 a RN-CAJA-04 Flujo Segregado y Arrastre de Saldo)', () => {
  let service: PettyCashService;
  let prismaMock: {
    pettyCash: { findUnique: jest.Mock; create: jest.Mock };
    pettyCashPeriod: {
      findFirst: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    pettyCashVoucher: {
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let auditMock: { recordLog: jest.Mock };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen',
    email: 'coord@uc.edu.ve',
    fullName: 'Coordinador',
    role: UserRole.GENERADOR,
  };

  const receptorActor: AuthenticatedUser = {
    id: 'u-rec',
    email: 'gerente@uc.edu.ve',
    fullName: 'Gerente Administración',
    role: UserRole.RECEPTOR,
  };

  beforeEach(() => {
    prismaMock = {
      pettyCash: { findUnique: jest.fn(), create: jest.fn() },
      pettyCashPeriod: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      pettyCashVoucher: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaMock)),
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new PettyCashService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createPettyCash & openMonthlyPeriod', () => {
    it('debe abrir un nuevo período mensual arrastrando automáticamente el closingBalance del mes anterior cerrado (Happy Path)', async () => {
      // Arrange
      prismaMock.pettyCashPeriod.findFirst
        .mockResolvedValueOnce(null) // No hay períodos abiertos
        .mockResolvedValueOnce({
          id: 'per-oct',
          yearMonth: '2026-10',
          closingBalance: '65.50',
        }); // Último período cerrado

      prismaMock.pettyCashPeriod.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'per-nov', ...data }),
      );

      // Act
      const period = await service.openMonthlyPeriod(
        'pc-1',
        { yearMonth: '2026-11', initialReplenishment: '134.50' },
        generadorActor,
      );

      // Assert
      expect(period.carryoverBalance).toBe('65.50');
      expect(period.availableBalance).toBe('200.00');
      expect(period.status).toBe(PettyCashPeriodStatus.SOLICITADO);
    });

    it('debe crear una caja chica asignada a un proyecto validando código único (Edge Case)', async () => {
      // Arrange
      prismaMock.pettyCash.findUnique.mockResolvedValueOnce(null);
      prismaMock.pettyCash.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'pc-1', ...data }),
      );

      // Act
      const pc = await service.createPettyCash(
        {
          code: ' cc-fis-01 ',
          name: 'Caja Chica Laboratorio Óptica',
          projectId: 'proj-1',
          authorizedAmount: '200.00',
        },
        generadorActor,
      );

      // Assert
      expect(pc.code).toBe('CC-FIS-01');
      expect(pc.authorizedAmount).toBe('200.00');
    });

    it('debe lanzar ConflictException si ya existe un período ABIERTO en la misma caja chica (Violación RN-CAJA-02)', async () => {
      // Arrange
      prismaMock.pettyCashPeriod.findFirst.mockResolvedValueOnce({
        id: 'per-activo',
        yearMonth: '2026-10',
      });

      // Act & Assert
      await expect(
        service.openMonthlyPeriod(
          'pc-1',
          { yearMonth: '2026-11', initialReplenishment: '100.00' },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('approvePeriodOpening, requestVoucher & approveAndDisburseVoucher', () => {
    it('debe permitir al RECEPTOR aprobar y desembolsar un vale descontando del saldo disponible (Happy Path)', async () => {
      // Arrange
      prismaMock.pettyCashVoucher.findUnique.mockResolvedValueOnce({
        id: 'v-1',
        periodId: 'per-1',
        requestedAmount: '80.00',
        status: PettyCashVoucherStatus.SOLICITADO,
        period: { id: 'per-1', availableBalance: '200.00' },
      });
      prismaMock.pettyCashVoucher.update.mockResolvedValueOnce({
        id: 'v-1',
        status: PettyCashVoucherStatus.DESEMBOLSADO,
      });
      prismaMock.pettyCashPeriod.update.mockResolvedValueOnce({});

      // Act
      const result = await service.approveAndDisburseVoucher(
        'v-1',
        receptorActor,
      );

      // Assert
      expect(result.voucher.status).toBe(PettyCashVoucherStatus.DESEMBOLSADO);
      expect(result.newAvailableBalance).toBe('120.00');
    });

    it('debe aprobar la apertura mensual cambiando el estado de SOLICITADO a ABIERTO (Edge Case)', async () => {
      // Arrange
      prismaMock.pettyCashPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.SOLICITADO,
      });
      prismaMock.pettyCashPeriod.update.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.ABIERTO,
      });

      // Act
      const approved = await service.approvePeriodOpening('per-1', receptorActor);

      // Assert
      expect(approved.status).toBe(PettyCashPeriodStatus.ABIERTO);
    });

    it('debe lanzar BadRequestException al solicitar un vale que supere el saldo disponible actual (Violación RN-CAJA-02)', async () => {
      // Arrange
      prismaMock.pettyCashPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.ABIERTO,
        availableBalance: '50.00',
      });

      // Act & Assert
      await expect(
        service.requestVoucher(
          'per-1',
          {
            code: 'VALE-01',
            beneficiaryName: 'Técnico Laboratorio',
            concept: 'Reactivos urgentes',
            requestedAmount: '75.00',
          },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('settleVoucher & closeMonthlyPeriod', () => {
    it('debe rendir un vale con factura reintegrando el vuelto al saldo disponible y luego permitir cerrar el mes (Happy Path)', async () => {
      // Arrange (Rendición)
      prismaMock.pettyCashVoucher.findUnique.mockResolvedValueOnce({
        id: 'v-1',
        periodId: 'per-1',
        disbursedAmount: '80.00',
        requestedAmount: '80.00',
        status: PettyCashVoucherStatus.DESEMBOLSADO,
        period: { id: 'per-1', availableBalance: '120.00' },
      });
      prismaMock.pettyCashVoucher.update.mockResolvedValueOnce({
        id: 'v-1',
        status: PettyCashVoucherStatus.RENDIDO,
      });
      prismaMock.pettyCashPeriod.update.mockResolvedValueOnce({});

      // Act (Gasto real = $65.00 de $80.00 -> Vuelto = $15.00 -> Nuevo saldo = $135.00)
      const settled = await service.settleVoucher(
        'v-1',
        {
          settledAmount: '65.00',
          invoiceReference: 'FACT-009812',
          attachmentUrl: '/uploads/fact-009812.pdf',
        },
        generadorActor,
      );

      // Assert
      expect(settled.newAvailableBalance).toBe('135.00');

      // Arrange (Cierre mensual)
      prismaMock.pettyCashPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.ABIERTO,
        availableBalance: '135.00',
        vouchers: [{ status: PettyCashVoucherStatus.RENDIDO }],
      });
      prismaMock.pettyCashPeriod.update.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.CERRADO,
        closingBalance: '135.00',
      });

      const closed = await service.closeMonthlyPeriod('per-1', receptorActor);
      expect(closed.status).toBe(PettyCashPeriodStatus.CERRADO);
      expect(closed.closingBalance).toBe('135.00');
    });

    it('debe lanzar NotFoundException si el vale o período a cerrar no existe (Edge Case)', async () => {
      // Arrange
      prismaMock.pettyCashPeriod.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.closeMonthlyPeriod('inexistente', receptorActor),
      ).rejects.toThrow(NotFoundException);
    });

    it('debe bloquear el cierre mensual si algún vale sigue DESEMBOLSADO sin rendir o si se rinde sin factura (Violación RN-CAJA-03 / RN-CAJA-04)', async () => {
      // Act & Assert (Rendir sin factura)
      await expect(
        service.settleVoucher(
          'v-1',
          { settledAmount: '50.00', invoiceReference: '   ' },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Arrange (Cerrar con vale pendiente)
      prismaMock.pettyCashPeriod.findUnique.mockResolvedValueOnce({
        id: 'per-1',
        status: PettyCashPeriodStatus.ABIERTO,
        availableBalance: '120.00',
        vouchers: [{ status: PettyCashVoucherStatus.DESEMBOLSADO }],
      });

      await expect(
        service.closeMonthlyPeriod('per-1', receptorActor),
      ).rejects.toThrow('[RN-CAJA-04]');
    });
  });
});
