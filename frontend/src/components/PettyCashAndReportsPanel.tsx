import React, { useState } from 'react';
import { UserRole } from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';
import { calculatePettyCashUtilizationPercent } from '../utils/petty-cash.util';
import { LiveProject } from './CatalogsAndAssignmentsWorkspace';

export interface LivePettyCashVoucher {
  id: string;
  code: string;
  beneficiaryName: string;
  concept: string;
  requestedAmount: string | number;
  disbursedAmount?: string | number | null;
  settledAmount?: string | number | null;
  returnedAmount: string | number;
  invoiceReference?: string | null;
  status: string;
}

export interface LivePettyCashPeriod {
  id: string;
  yearMonth: string;
  carryoverBalance: string | number;
  initialReplenishment: string | number;
  availableBalance: string | number;
  closingBalance?: string | number | null;
  status: string;
  vouchers: LivePettyCashVoucher[];
}

export interface LivePettyCash {
  id: string;
  code: string;
  name: string;
  projectId: string;
  authorizedAmount: string | number;
  status: string;
  project?: { code: string; name: string };
  periods: LivePettyCashPeriod[];
}

interface PettyCashProps {
  token: string | null;
  activeRole: UserRole;
  projects: LiveProject[];
  pettyCashes: LivePettyCash[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function PettyCashAndReportsPanel({
  token,
  activeRole,
  projects,
  pettyCashes,
  onRefresh,
  onNotify,
}: PettyCashProps): React.ReactElement {
  const isGenerador = activeRole === UserRole.GENERADOR;
  const isReceptor = activeRole === UserRole.RECEPTOR;

  // 1. Crear Caja Chica
  const [boxCode, setBoxCode] = useState('CC-QUI-2026-02');
  const [boxName, setBoxName] = useState('Caja Chica Reactivos Química FACYT');
  const [boxProjectId, setBoxProjectId] = useState('');
  const [boxAuthAmount, setBoxAuthAmount] = useState('250.00');

  // 2. Abrir Período Mensual
  const [periodPettyCashId, setPeriodPettyCashId] = useState('');
  const [periodYearMonth, setPeriodYearMonth] = useState('2026-03');
  const [periodReplenishment, setPeriodReplenishment] = useState('150.00');

  // 3. Solicitar Vale
  const [voucherPeriodId, setVoucherPeriodId] = useState('');
  const [voucherCode, setVoucherCode] = useState('VALE-2026-009');
  const [voucherBeneficiary, setVoucherBeneficiary] = useState(
    'TSU. Carlos Pérez',
  );
  const [voucherConcept, setVoucherConcept] = useState(
    'Compra urgente de filtros y guantes de nitrilo',
  );
  const [voucherAmount, setVoucherAmount] = useState('45.00');

  // 4. Rendición de Vale con Factura
  const [settleAmount, setSettleAmount] = useState('40.00');
  const [settleInvoice, setSettleInvoice] = useState('FACT-SENIAT-009841');

  const handleCreatePettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = boxProjectId || projects[0]?.id;
    if (!targetProject) {
      onNotify('error', 'Seleccione un proyecto.');
      return;
    }
    try {
      await apiRequest('/petty-cashes', {
        method: 'POST',
        token,
        body: {
          code: boxCode,
          name: boxName,
          projectId: targetProject,
          authorizedAmount: boxAuthAmount,
        },
      });
      onNotify('success', `Caja chica '${boxCode}' creada correctamente.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleOpenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBox = periodPettyCashId || pettyCashes[0]?.id;
    if (!targetBox) {
      onNotify('error', 'Seleccione una caja chica.');
      return;
    }
    try {
      await apiRequest(`/petty-cashes/${targetBox}/periods`, {
        method: 'POST',
        token,
        body: {
          yearMonth: periodYearMonth,
          initialReplenishment: periodReplenishment,
        },
      });
      onNotify(
        'success',
        `Apertura mensual ${periodYearMonth} solicitada arrastrando automáticamente el saldo del mes anterior (RN-CAJA-04).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleApprovePeriod = async (periodId: string) => {
    try {
      await apiRequest(`/petty-cashes/periods/${periodId}/approve`, {
        method: 'PATCH',
        token,
      });
      onNotify('success', 'Apertura mensual APROBADA por Gerencia.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleClosePeriod = async (periodId: string) => {
    try {
      await apiRequest(`/petty-cashes/periods/${periodId}/close`, {
        method: 'PATCH',
        token,
      });
      onNotify(
        'success',
        'Período mensual CERRADO. El saldo final quedó congelado para el arrastre del próximo mes (RN-CAJA-04).',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleRequestVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const openPeriods = pettyCashes
      .flatMap((pc) => pc.periods)
      .filter((per) => per.status === 'ABIERTO');
    const targetPeriod = voucherPeriodId || openPeriods[0]?.id;
    if (!targetPeriod) {
      onNotify('error', 'Seleccione un período mensual ABIERTO.');
      return;
    }
    try {
      await apiRequest(`/petty-cashes/periods/${targetPeriod}/vouchers`, {
        method: 'POST',
        token,
        body: {
          code: voucherCode,
          beneficiaryName: voucherBeneficiary,
          concept: voucherConcept,
          requestedAmount: voucherAmount,
        },
      });
      onNotify('success', `Vale '${voucherCode}' solicitado.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleDisburseVoucher = async (voucherId: string) => {
    try {
      await apiRequest(`/petty-cashes/vouchers/${voucherId}/disburse`, {
        method: 'PATCH',
        token,
      });
      onNotify(
        'success',
        'Vale aprobado y desembolsado. Saldo disponible descontado en tiempo real (RN-CAJA-02).',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSettleVoucher = async (voucherId: string) => {
    try {
      await apiRequest(`/petty-cashes/vouchers/${voucherId}/settle`, {
        method: 'PATCH',
        token,
        body: {
          settledAmount: settleAmount,
          invoiceReference: settleInvoice,
        },
      });
      onNotify(
        'success',
        `Vale rendido con factura '${settleInvoice}'. El vuelto sobrante retornó al disponible de la caja (RN-CAJA-03).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const openPeriodsList = pettyCashes.flatMap((pc) =>
    pc.periods
      .filter((per) => per.status === 'ABIERTO')
      .map((per) => ({ ...per, boxCode: pc.code })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* FORMULARIOS OPERATIVOS PARA GENERADOR */}
      {isGenerador && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
          <section style={cardStyle}>
            <h3 style={subTitleStyle}>1. Crear Caja Chica por Proyecto</h3>
            <form onSubmit={handleCreatePettyCash} style={stackFormStyle}>
              <input
                value={boxCode}
                onChange={(e) => setBoxCode(e.target.value)}
                placeholder="Código (ej. CC-QUI-02)"
                required
                style={inputStyle}
              />
              <input
                value={boxName}
                onChange={(e) => setBoxName(e.target.value)}
                placeholder="Nombre de la Caja Chica"
                required
                style={inputStyle}
              />
              <select
                value={boxProjectId}
                onChange={(e) => setBoxProjectId(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Seleccionar Proyecto --</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} - {p.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={boxAuthAmount}
                onChange={(e) => setBoxAuthAmount(e.target.value)}
                placeholder="Tope Autorizado USD"
                required
                style={inputStyle}
              />
              <button type="submit" style={primaryButtonStyle}>
                + Crear Caja Chica
              </button>
            </form>
          </section>

          <section style={cardStyle}>
            <h3 style={subTitleStyle}>
              2. Solicitar Apertura Mensual (con Arrastre)
            </h3>
            <form onSubmit={handleOpenPeriod} style={stackFormStyle}>
              <select
                value={periodPettyCashId}
                onChange={(e) => setPeriodPettyCashId(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Seleccionar Caja Chica --</option>
                {pettyCashes.map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.code} ({pc.name})
                  </option>
                ))}
              </select>
              <input
                value={periodYearMonth}
                onChange={(e) => setPeriodYearMonth(e.target.value)}
                placeholder="Mes YYYY-MM (ej. 2026-03)"
                required
                style={inputStyle}
              />
              <input
                type="number"
                step="0.01"
                value={periodReplenishment}
                onChange={(e) => setPeriodReplenishment(e.target.value)}
                placeholder="Reposición Inicial USD"
                required
                style={inputStyle}
              />
              <button type="submit" style={primaryButtonStyle}>
                📅 Solicitar Apertura Mensual
              </button>
            </form>
          </section>

          <section style={cardStyle}>
            <h3 style={subTitleStyle}>3. Emitir Solicitud de Vale</h3>
            <form onSubmit={handleRequestVoucher} style={stackFormStyle}>
              <select
                value={voucherPeriodId}
                onChange={(e) => setVoucherPeriodId(e.target.value)}
                style={inputStyle}
              >
                <option value="">-- Período Mensual ABIERTO --</option>
                {openPeriodsList.map((per) => (
                  <option key={per.id} value={per.id}>
                    {per.boxCode} · {per.yearMonth} (Disp: $
                    {per.availableBalance})
                  </option>
                ))}
              </select>
              <input
                value={voucherCode}
                onChange={(e) => setVoucherCode(e.target.value)}
                placeholder="Código Vale (ej. VALE-2026-009)"
                required
                style={inputStyle}
              />
              <input
                value={voucherBeneficiary}
                onChange={(e) => setVoucherBeneficiary(e.target.value)}
                placeholder="Responsable / Beneficiario"
                required
                style={inputStyle}
              />
              <input
                value={voucherConcept}
                onChange={(e) => setVoucherConcept(e.target.value)}
                placeholder="Concepto del Gasto Menor"
                required
                style={inputStyle}
              />
              <input
                type="number"
                step="0.01"
                value={voucherAmount}
                onChange={(e) => setVoucherAmount(e.target.value)}
                placeholder="Monto Solicitado USD"
                required
                style={inputStyle}
              />
              <button type="submit" style={primaryButtonStyle}>
                🧾 Solicitar Vale
              </button>
            </form>
          </section>
        </div>
      )}

      {/* PARÁMETROS RÁPIDOS DE RENDICIÓN CON FACTURA */}
      {isGenerador && (
        <section style={{ ...cardStyle, backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '0.85rem', color: '#0f172a' }}>
              Datos para Rendir Vale Desembolsado (RN-CAJA-03):
            </strong>
            <label style={{ fontSize: '0.82rem' }}>
              Monto Gastado Según Factura (USD):{' '}
              <input
                type="number"
                step="0.01"
                value={settleAmount}
                onChange={(e) => setSettleAmount(e.target.value)}
                style={{ ...inputStyle, width: '110px' }}
              />
            </label>
            <label style={{ fontSize: '0.82rem' }}>
              N° Factura / Comprobante Obligatorio:{' '}
              <input
                value={settleInvoice}
                onChange={(e) => setSettleInvoice(e.target.value)}
                style={{ ...inputStyle, width: '210px' }}
              />
            </label>
          </div>
        </section>
      )}

      {/* LISTADO DETALLADO DE CAJAS CHICAS, PERÍODOS Y VALES */}
      {pettyCashes.map((box) => (
        <section key={box.id} style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>
                {box.code} — {box.name}
              </h2>
              <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                Proyecto: <code>{box.project?.code ?? box.projectId}</code> · Tope Autorizado:{' '}
                <strong>{formatUsdCurrency(Number(box.authorizedAmount))}</strong>
              </span>
            </div>
            <span
              style={{
                padding: '0.25rem 0.6rem',
                borderRadius: '999px',
                fontSize: '0.76rem',
                fontWeight: 700,
                backgroundColor: '#dcfce7',
                color: '#065f46',
              }}
            >
              {box.status}
            </span>
          </div>

          {box.periods.map((per) => {
            const totalOpening =
              Number(per.carryoverBalance) + Number(per.initialReplenishment);
            const usedPercent = calculatePettyCashUtilizationPercent(
              totalOpening,
              Number(per.availableBalance),
            );
            return (
              <div
                key={per.id}
                style={{
                  padding: '0.9rem',
                  marginBottom: '0.85rem',
                  backgroundColor: '#f8fafc',
                  borderRadius: '0.45rem',
                  border: '1px solid #cbd5e1',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.6rem' }}>
                  <div>
                    <strong style={{ fontSize: '0.95rem' }}>
                      Período Mensual {per.yearMonth}
                    </strong>{' '}
                    <span
                      style={{
                        padding: '0.18rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor:
                          per.status === 'ABIERTO'
                            ? '#dcfce7'
                            : per.status === 'SOLICITADO'
                              ? '#fef3c7'
                              : '#e2e8f0',
                        color:
                          per.status === 'ABIERTO'
                            ? '#065f46'
                            : per.status === 'SOLICITADO'
                              ? '#92400e'
                              : '#334155',
                      }}
                    >
                      {per.status}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, color: '#047857', fontSize: '0.92rem' }}>
                      Saldo Disponible: {formatUsdCurrency(Number(per.availableBalance))}
                    </span>
                    {isReceptor && per.status === 'SOLICITADO' && (
                      <button
                        type="button"
                        onClick={() => handleApprovePeriod(per.id)}
                        style={successButtonStyle}
                      >
                        ✅ Aprobar Apertura
                      </button>
                    )}
                    {isReceptor && per.status === 'ABIERTO' && (
                      <button
                        type="button"
                        onClick={() => handleClosePeriod(per.id)}
                        style={secondaryButtonStyle}
                      >
                        🔒 Cerrar Mes y Arrastre
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ fontSize: '0.82rem', color: '#334155', marginBottom: '0.65rem' }}>
                  Arrastre mes anterior:{' '}
                  <strong>{formatUsdCurrency(Number(per.carryoverBalance))}</strong> + Reposición:{' '}
                  <strong>{formatUsdCurrency(Number(per.initialReplenishment))}</strong> = Apertura Total:{' '}
                  <strong>{formatUsdCurrency(totalOpening)}</strong> ({usedPercent}% ejecutado)
                  {per.closingBalance !== null && per.closingBalance !== undefined && (
                    <span>
                      {' '}
                      · Saldo Final Congelado para Próximo Mes:{' '}
                      <strong>{formatUsdCurrency(Number(per.closingBalance))}</strong>
                    </span>
                  )}
                </div>

                {per.vouchers && per.vouchers.length > 0 && (
                  <table style={tableStyle}>
                    <thead>
                      <tr style={theadRowStyle}>
                        <th style={thStyle}>Vale</th>
                        <th style={thStyle}>Responsable / Concepto</th>
                        <th style={thStyle}>Solicitado</th>
                        <th style={thStyle}>Desembolsado</th>
                        <th style={thStyle}>Rendido / Vuelto</th>
                        <th style={thStyle}>Factura</th>
                        <th style={thStyle}>Estado</th>
                        <th style={thStyle}>Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {per.vouchers.map((v) => (
                        <tr key={v.id} style={trStyle}>
                          <td style={{ ...tdStyle, fontWeight: 700 }}>{v.code}</td>
                          <td style={tdStyle}>
                            <strong>{v.beneficiaryName}</strong> — {v.concept}
                          </td>
                          <td style={tdStyle}>
                            {formatUsdCurrency(Number(v.requestedAmount))}
                          </td>
                          <td style={tdStyle}>
                            {v.disbursedAmount
                              ? formatUsdCurrency(Number(v.disbursedAmount))
                              : '—'}
                          </td>
                          <td style={tdStyle}>
                            {v.settledAmount
                              ? `${formatUsdCurrency(Number(v.settledAmount))} (Vuelto: ${formatUsdCurrency(Number(v.returnedAmount))})`
                              : '—'}
                          </td>
                          <td style={tdStyle}>
                            <code>{v.invoiceReference ?? 'Pendiente'}</code>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: 700, fontSize: '0.76rem' }}>
                              {v.status}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            {isReceptor && v.status === 'SOLICITADO' && (
                              <button
                                type="button"
                                onClick={() => handleDisburseVoucher(v.id)}
                                style={successButtonStyle}
                              >
                                💸 Desembolsar
                              </button>
                            )}
                            {isGenerador && v.status === 'DESEMBOLSADO' && (
                              <button
                                type="button"
                                onClick={() => handleSettleVoucher(v.id)}
                                style={primaryButtonStyle}
                              >
                                🧾 Rendir con Factura
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '1.1rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const subTitleStyle: React.CSSProperties = {
  margin: '0 0 0.65rem',
  fontSize: '0.96rem',
  color: '#0f172a',
};

const stackFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};

const inputStyle: React.CSSProperties = {
  padding: '0.42rem 0.6rem',
  borderRadius: '0.35rem',
  border: '1px solid #94a3b8',
  fontSize: '0.84rem',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.45rem 0.75rem',
  borderRadius: '0.35rem',
  border: 'none',
  backgroundColor: '#1e3a8a',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.65rem',
  borderRadius: '0.35rem',
  border: '1px solid #1e40af',
  backgroundColor: '#eff6ff',
  color: '#1e3a8a',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
};

const successButtonStyle: React.CSSProperties = {
  padding: '0.35rem 0.65rem',
  borderRadius: '0.35rem',
  border: 'none',
  backgroundColor: '#047857',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.82rem',
  backgroundColor: '#ffffff',
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  textAlign: 'left',
  borderBottom: '2px solid #cbd5e1',
};

const thStyle: React.CSSProperties = {
  padding: '0.45rem',
  color: '#334155',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: React.CSSProperties = {
  padding: '0.45rem',
};
