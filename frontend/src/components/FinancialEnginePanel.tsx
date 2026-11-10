import React from 'react';
import {
  AccrualLedgerRow,
  AccrualStatus,
  PaymentRequestStatus,
} from '../types/domain.types';
import { formatUsdCurrency } from '../utils/currency.util';
import {
  getAccrualStatusMeta,
  getPaymentRequestStatusMeta,
} from '../utils/financial-status.util';

const DEMO_ACCRUALS: AccrualLedgerRow[] = [
  {
    id: 'acc-oct-1',
    periodLabel: '2026-10-01 al 2026-10-15 (Quincena 1)',
    beneficiaryName: 'Dr. Alejandro Mendoza',
    projectCode: 'FIS-2026-01',
    activeDays: 15,
    totalPeriodDays: 15,
    proratedAmount: 450.0,
    paidAmount: 450.0,
    balanceDue: 0.0,
    status: AccrualStatus.PAGADO,
  },
  {
    id: 'acc-oct-2',
    periodLabel: '2026-10-16 al 2026-10-31 (Quincena 2)',
    beneficiaryName: 'Dr. Alejandro Mendoza',
    projectCode: 'FIS-2026-01',
    activeDays: 16,
    totalPeriodDays: 16,
    proratedAmount: 450.0,
    paidAmount: 150.0,
    balanceDue: 300.0,
    status: AccrualStatus.PARCIAL,
  },
  {
    id: 'acc-nov-1',
    periodLabel: '2026-11-01 al 2026-11-15 (Ingreso día 11 -> Prorrateado)',
    beneficiaryName: 'MSc. Valeria Salazar',
    projectCode: 'QUI-2026-02',
    activeDays: 5,
    totalPeriodDays: 15,
    proratedAmount: 150.0,
    paidAmount: 0.0,
    balanceDue: 150.0,
    status: AccrualStatus.PENDIENTE,
  },
];

const PIPELINE_STEPS: PaymentRequestStatus[] = [
  PaymentRequestStatus.CREADA,
  PaymentRequestStatus.ENVIADA,
  PaymentRequestStatus.APROBADA,
  PaymentRequestStatus.ENTREGADA,
  PaymentRequestStatus.CERRADA,
];

export function FinancialEnginePanel(): React.ReactElement {
  return (
    <section style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem', color: '#0f172a' }}>
        Etapa 2: Motor de Causación Prorrateada (RN-CAUS) y Prelación FIFO de Pagos Parciales (RN-PAG)
      </h2>
      <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#475569' }}>
        Ejemplo demostrativo: Un pago parcial de <strong>$600.00 USD</strong> al Dr. Mendoza saldó primero el 100% de la Quincena 1 ($450.00) y abonó los $150.00 restantes a la Quincena 2 (FIFO), dejando $300.00 de deuda pendiente.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {PIPELINE_STEPS.map((step) => {
          const meta = getPaymentRequestStatusMeta(step);
          return (
            <span
              key={step}
              style={{
                padding: '0.3rem 0.65rem',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                color: meta.colorHex,
                backgroundColor: meta.backgroundHex,
              }}
            >
              {meta.label}
            </span>
          );
        })}
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <thead>
          <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
            <th style={{ padding: '0.5rem' }}>Período (Orden FIFO)</th>
            <th style={{ padding: '0.5rem' }}>Beneficiario / Proyecto</th>
            <th style={{ padding: '0.5rem' }}>Días Activos (Prorrateo)</th>
            <th style={{ padding: '0.5rem' }}>Causado (USD)</th>
            <th style={{ padding: '0.5rem' }}>Pagado (FIFO)</th>
            <th style={{ padding: '0.5rem' }}>Deuda Pendiente</th>
            <th style={{ padding: '0.5rem' }}>Estado Inmutable</th>
          </tr>
        </thead>
        <tbody>
          {DEMO_ACCRUALS.map((row) => {
            const badge = getAccrualStatusMeta(row.status);
            return (
              <tr key={row.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem' }}>{row.periodLabel}</td>
                <td style={{ padding: '0.5rem' }}>{row.beneficiaryName} ({row.projectCode})</td>
                <td style={{ padding: '0.5rem' }}>{row.activeDays} / {row.totalPeriodDays} días</td>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{formatUsdCurrency(row.proratedAmount)}</td>
                <td style={{ padding: '0.5rem', color: '#047857', fontWeight: 600 }}>{formatUsdCurrency(row.paidAmount)}</td>
                <td style={{ padding: '0.5rem', color: row.balanceDue > 0 ? '#b91c1c' : '#64748b', fontWeight: 700 }}>
                  {formatUsdCurrency(row.balanceDue)}
                </td>
                <td style={{ padding: '0.5rem' }}>
                  <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.25rem', fontSize: '0.78rem', fontWeight: 600, color: badge.colorHex, backgroundColor: badge.backgroundHex }}>
                    {badge.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
