import React from 'react';
import { formatUsdCurrency } from '../utils/currency.util';
import { calculatePettyCashUtilizationPercent } from '../utils/petty-cash.util';

interface PettyCashDemoBox {
  code: string;
  projectCode: string;
  yearMonth: string;
  carryoverFromPrevMonth: number;
  initialReplenishment: number;
  availableBalance: number;
  settledVouchersCount: number;
}

const DEMO_PETTY_CASHES: PettyCashDemoBox[] = [
  {
    code: 'CC-FIS-01 (Caja Chica Óptica)',
    projectCode: 'FIS-2026-01',
    yearMonth: '2026-11',
    carryoverFromPrevMonth: 65.5,
    initialReplenishment: 134.5,
    availableBalance: 135.0,
    settledVouchersCount: 2,
  },
  {
    code: 'CC-QUI-02 (Caja Chica Catalizadores)',
    projectCode: 'QUI-2026-02',
    yearMonth: '2026-11',
    carryoverFromPrevMonth: 40.0,
    initialReplenishment: 160.0,
    availableBalance: 85.0,
    settledVouchersCount: 3,
  },
];

export function PettyCashAndReportsPanel(): React.ReactElement {
  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
      <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#0f172a' }}>
          Etapa 3A: Control de Cajas Chicas y Arrastre de Saldo (RN-CAJA-01 a 04)
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: '#475569' }}>
          Flujo Segregado: Coordinador solicita/rinde con comprobante · Gerencia aprueba/desembolsa/cierra mes.
        </p>

        {DEMO_PETTY_CASHES.map((box) => {
          const totalOpening = box.carryoverFromPrevMonth + box.initialReplenishment;
          const usedPercent = calculatePettyCashUtilizationPercent(
            totalOpening,
            box.availableBalance,
          );
          return (
            <div key={box.code} style={{ padding: '0.75rem', marginBottom: '0.6rem', backgroundColor: '#f8fafc', borderRadius: '0.4rem', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '0.9rem' }}>
                <span>{box.code} · Período {box.yearMonth}</span>
                <span style={{ color: '#047857' }}>Disponible: {formatUsdCurrency(box.availableBalance)}</span>
              </div>
              <div style={{ fontSize: '0.8rem', color: '#334155', marginTop: '0.35rem' }}>
                Arrastre mes anterior: <strong>{formatUsdCurrency(box.carryoverFromPrevMonth)}</strong> + Reposición: <strong>{formatUsdCurrency(box.initialReplenishment)}</strong> ({usedPercent}% ejecutado en {box.settledVouchersCount} vales rendidos con factura)
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', color: '#0f172a' }}>
          Etapa 3B: Consultas Clave (RN-AUD-01) y Documentos PDF (RN-AUD-02)
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.85rem' }}>
          <div style={{ padding: '0.6rem', backgroundColor: '#f1f5f9', borderRadius: '0.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#475569' }}>Total Causado</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700 }}>{formatUsdCurrency(1050.0)}</div>
          </div>
          <div style={{ padding: '0.6rem', backgroundColor: '#dcfce7', borderRadius: '0.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#065f46' }}>Total Pagado (FIFO)</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#047857' }}>{formatUsdCurrency(600.0)}</div>
          </div>
          <div style={{ padding: '0.6rem', backgroundColor: '#fee2e2', borderRadius: '0.4rem' }}>
            <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Deuda Total Pendiente</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#b91c1c' }}>{formatUsdCurrency(450.0)}</div>
          </div>
        </div>

        <div style={{ fontSize: '0.84rem', color: '#334155', lineHeight: 1.6 }}>
          <div>📄 <strong>Endpoint PDF Recibo Individual (FIFO):</strong> <code>GET /api/reports/payments/:id/pdf</code></div>
          <div>📑 <strong>Endpoint PDF Solicitud Consolidada:</strong> <code>GET /api/reports/payment-requests/:id/pdf</code></div>
          <div>📊 <strong>Endpoint Estado de Cuenta por Persona:</strong> <code>GET /api/reports/summary</code></div>
        </div>
      </div>
    </section>
  );
}
