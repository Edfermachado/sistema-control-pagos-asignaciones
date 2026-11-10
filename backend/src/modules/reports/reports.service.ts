import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import {
  AccrualStatus,
  PaymentStatus,
} from '../../common/constants/domain.enums';
import { toUsdDecimal } from '../../common/domain/money.helper';
import { PrismaService } from '../../prisma/prisma.service';
import {
  buildSimplePdfBuffer,
  formatConsolidatedRequestLines,
  formatIndividualPaymentReceiptLines,
} from './domain/pdf-document.builder';

export interface BeneficiaryDebtSummary {
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryDni: string;
  totalAccruedUsd: string;
  totalPaidUsd: string;
  totalDebtDueUsd: string;
}

export interface ExecutiveReportSummary {
  totalAccruedUsd: string;
  totalPaidUsd: string;
  totalPendingDebtUsd: string;
  beneficiaryBalances: BeneficiaryDebtSummary[];
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Responde las preguntas clave del enunciado (RN-AUD-01):
   * ¿Cuánto se ha causado? ¿Cuánto se ha pagado? ¿Cuánto se le adeuda a cada persona y por qué proyecto?
   */
  async getExecutiveSummaryAndDebts(
    projectId?: string,
  ): Promise<ExecutiveReportSummary> {
    const accruals = await this.prisma.accrual.findMany({
      where: {
        ...(projectId ? { projectId } : {}),
        status: { not: AccrualStatus.ANULADO },
      },
      include: {
        beneficiary: true,
        project: true,
      },
    });

    let totalAccrued = new Decimal('0.00');
    let totalPaid = new Decimal('0.00');
    let totalDebt = new Decimal('0.00');

    const mapByBeneficiary = new Map<
      string,
      {
        name: string;
        dni: string;
        accrued: Decimal;
        paid: Decimal;
        debt: Decimal;
      }
    >();

    for (const acc of accruals) {
      const accruedDec = toUsdDecimal(acc.proratedAmount.toString());
      const paidDec = toUsdDecimal(acc.paidAmount.toString());
      const debtDec = toUsdDecimal(acc.balanceDue.toString());

      totalAccrued = totalAccrued.plus(accruedDec);
      totalPaid = totalPaid.plus(paidDec);
      totalDebt = totalDebt.plus(debtDec);

      const current = mapByBeneficiary.get(acc.beneficiaryId) ?? {
        name: acc.beneficiary.fullName,
        dni: acc.beneficiary.dni,
        accrued: new Decimal('0.00'),
        paid: new Decimal('0.00'),
        debt: new Decimal('0.00'),
      };

      current.accrued = current.accrued.plus(accruedDec);
      current.paid = current.paid.plus(paidDec);
      current.debt = current.debt.plus(debtDec);
      mapByBeneficiary.set(acc.beneficiaryId, current);
    }

    const beneficiaryBalances: BeneficiaryDebtSummary[] = Array.from(
      mapByBeneficiary.entries(),
    ).map(([beneficiaryId, data]) => ({
      beneficiaryId,
      beneficiaryName: data.name,
      beneficiaryDni: data.dni,
      totalAccruedUsd: data.accrued.toFixed(2),
      totalPaidUsd: data.paid.toFixed(2),
      totalDebtDueUsd: data.debt.toFixed(2),
    }));

    return {
      totalAccruedUsd: totalAccrued.toFixed(2),
      totalPaidUsd: totalPaid.toFixed(2),
      totalPendingDebtUsd: totalDebt.toFixed(2),
      beneficiaryBalances,
    };
  }

  /**
   * Genera el PDF oficial de un Recibo Individual de Pago con su desglose FIFO (RN-AUD-02).
   */
  async generateIndividualReceiptPdf(
    paymentId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        beneficiary: true,
        deliveredBy: true,
        paymentRequest: { include: { project: true } },
        allocations: { include: { accrual: true } },
      },
    });

    if (!payment) {
      throw new NotFoundException(`El pago con ID '${paymentId}' no existe.`);
    }

    const lines = formatIndividualPaymentReceiptLines({
      receiptCode: payment.receiptCode,
      paymentDate: payment.paymentDate.toISOString().slice(0, 10),
      status: payment.status as unknown as PaymentStatus,
      beneficiaryName: payment.beneficiary.fullName,
      beneficiaryDni: payment.beneficiary.dni,
      projectCode: payment.paymentRequest.project.code,
      projectName: payment.paymentRequest.project.name,
      totalPaidUsd: payment.amount.toString(),
      deliveredByName: payment.deliveredBy.fullName,
      allocations: payment.allocations.map((alloc) => ({
        periodStart: alloc.accrual.periodStart.toISOString().slice(0, 10),
        periodEnd: alloc.accrual.periodEnd.toISOString().slice(0, 10),
        allocatedUsd: alloc.allocatedAmount.toString(),
        remainingBalanceUsd: alloc.accrual.balanceDue.toString(),
      })),
    });

    const buffer = buildSimplePdfBuffer(
      `RECIBO INDIVIDUAL DE PAGO: ${payment.receiptCode}`,
      `Proyecto: ${payment.paymentRequest.project.code} - Moneda: USD`,
      lines,
    );

    return {
      filename: `recibo_${payment.receiptCode}.pdf`,
      buffer,
    };
  }

  /**
   * Genera el PDF oficial de una Solicitud Consolidada de Pago agrupada por proyecto (RN-AUD-02).
   */
  async generateConsolidatedRequestPdf(
    paymentRequestId: string,
  ): Promise<{ filename: string; buffer: Buffer }> {
    const request = await this.prisma.paymentRequest.findUnique({
      where: { id: paymentRequestId },
      include: {
        project: true,
        createdBy: true,
        reviewedBy: true,
        items: {
          include: {
            accrual: { include: { beneficiary: true } },
          },
        },
      },
    });

    if (!request) {
      throw new NotFoundException(
        `La solicitud de pago con ID '${paymentRequestId}' no existe.`,
      );
    }

    const lines = formatConsolidatedRequestLines({
      requestCode: request.code,
      projectCode: request.project.code,
      projectName: request.project.name,
      projectArea: request.project.area,
      status: request.status,
      createdByName: request.createdBy.fullName,
      reviewedByName: request.reviewedBy?.fullName ?? null,
      totalRequestedUsd: request.totalAmount.toString(),
      items: request.items.map((item) => ({
        beneficiaryName: item.accrual.beneficiary.fullName,
        beneficiaryDni: item.accrual.beneficiary.dni,
        periodStart: item.accrual.periodStart.toISOString().slice(0, 10),
        periodEnd: item.accrual.periodEnd.toISOString().slice(0, 10),
        requestedUsd: item.requestedAmount.toString(),
      })),
    });

    const buffer = buildSimplePdfBuffer(
      `SOLICITUD CONSOLIDADA DE PAGO: ${request.code}`,
      `Proyecto: ${request.project.code} (${request.project.area})`,
      lines,
    );

    return {
      filename: `solicitud_${request.code}.pdf`,
      buffer,
    };
  }
}
