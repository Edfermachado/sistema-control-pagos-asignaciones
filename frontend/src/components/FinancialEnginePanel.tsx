import React, { useEffect, useState } from 'react';
import {
  AccrualStatus,
  PaymentRequestStatus,
  UserRole,
} from '../types/domain.types';
import {
  apiRequest,
  downloadAuthenticatedPdf,
} from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';
import {
  getAccrualStatusMeta,
  getPaymentRequestStatusMeta,
} from '../utils/financial-status.util';
import {
  LiveBeneficiary,
  LivePaymentGroup,
  LivePaymentGroupPeriod,
  LiveProject,
} from './CatalogsAndAssignmentsWorkspace';

export interface LiveAccrual {
  id: string;
  periodStart: string;
  periodEnd: string;
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: string | number;
  paidAmount: string | number;
  balanceDue: string | number;
  status: AccrualStatus;
  beneficiaryId: string;
  projectId: string;
  beneficiary?: { fullName: string; dni: string };
  project?: { code: string; name: string };
  batch?: { code: string };
}

export interface LiveAccrualBatch {
  id: string;
  code: string;
  projectId: string;
  paymentGroupId: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  totalAmount: string | number;
  status: string;
  project?: { code: string; name: string };
  paymentGroup?: { name: string; periodicity: string };
  accruals?: Array<{ id: string; paidAmount: string | number }>;
}

export interface LivePaymentRequest {
  id: string;
  code: string;
  projectId: string;
  totalAmount: string | number;
  paidAmount: string | number;
  status: PaymentRequestStatus;
  rejectionReason?: string | null;
  project?: { code: string; name: string };
}

export interface LivePayment {
  id: string;
  receiptCode: string;
  paymentRequestId: string;
  beneficiaryId: string;
  amount: string | number;
  paymentDate: string;
  reference?: string | null;
  status: string;
  beneficiary?: { fullName: string; dni: string };
  paymentRequest?: { code: string };
}

interface PreviewItem {
  assignmentId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: string;
}

interface BatchPreviewResponse {
  totalPeriodDays: number;
  totalBatchAmount: string;
  items: PreviewItem[];
}

interface FinancialProps {
  token: string | null;
  activeRole: UserRole;
  projects: LiveProject[];
  paymentGroups: LivePaymentGroup[];
  beneficiaries: LiveBeneficiary[];
  accruals: LiveAccrual[];
  accrualBatches: LiveAccrualBatch[];
  paymentRequests: LivePaymentRequest[];
  payments: LivePayment[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const PIPELINE_STEPS: PaymentRequestStatus[] = [
  PaymentRequestStatus.CREADA,
  PaymentRequestStatus.ENVIADA,
  PaymentRequestStatus.APROBADA,
  PaymentRequestStatus.ENTREGADA,
  PaymentRequestStatus.CERRADA,
];

export function FinancialEnginePanel({
  token,
  activeRole,
  projects,
  paymentGroups,
  beneficiaries,
  accruals,
  accrualBatches,
  paymentRequests,
  payments,
  onRefresh,
  onNotify,
}: FinancialProps): React.ReactElement {
  const isGenerador = activeRole === UserRole.GENERADOR;
  const isReceptor = activeRole === UserRole.RECEPTOR;

  // 1. Estado Lote de Causación
  const [batchCode, setBatchCode] = useState('LOTE-QUI-2026-11A');
  const [batchProjectId, setBatchProjectId] = useState('');
  const [batchGroupId, setBatchGroupId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-02-01');
  const [periodEnd, setPeriodEnd] = useState('2026-02-15');
  const [batchPeriods, setBatchPeriods] = useState<LivePaymentGroupPeriod[]>([]);
  const [batchPeriodId, setBatchPeriodId] = useState('');
  const [previewResult, setPreviewResult] =
    useState<BatchPreviewResponse | null>(null);

  const effectiveBatchGroupId = batchGroupId || paymentGroups[0]?.id || '';

  useEffect(() => {
    const loadBatchPeriods = async () => {
      if (!effectiveBatchGroupId) {
        setBatchPeriods([]);
        return;
      }
      try {
        const response = await apiRequest<LivePaymentGroupPeriod[]>(
          `/payment-groups/${effectiveBatchGroupId}/periods`,
          { token },
        );
        setBatchPeriods(response);
      } catch {
        setBatchPeriods([]);
      }
    };

    void loadBatchPeriods();
  }, [effectiveBatchGroupId, token]);

  // 2. Estado Nueva Solicitud de Pago
  const [reqCode, setReqCode] = useState('SOL-2026-0009');
  const [reqProjectId, setReqProjectId] = useState('');
  const [reqAccrualIds, setReqAccrualIds] = useState<string[]>([]);

  // 3. Estado Ejecución de Pago FIFO
  const [payReceiptCode, setPayReceiptCode] = useState('REC-2026-0009');
  const [payRequestId, setPayRequestId] = useState('');
  const [payBeneficiaryId, setPayBeneficiaryId] = useState('');
  const [payAmount, setPayAmount] = useState('300.00');
  const [payReference, setPayReference] = useState('ZELLE-FACYT-9981');
  const [payDate, setPayDate] = useState('2026-02-20');

  // 4. Motivo para Anulaciones Justificadas Inmutables
  const [annulReason, setAnnulReason] = useState(
    'Corrección contable autorizada por Gerencia Administrativa FACYT (RN-PAG-03)',
  );

  const hasPendingBalance = (accrual: LiveAccrual): boolean =>
    (accrual.status === AccrualStatus.PENDIENTE ||
      accrual.status === AccrualStatus.PARCIAL) &&
    Number(accrual.balanceDue) > 0;

  const firstProjectWithPendingAccruals = projects.find((p) =>
    accruals.some((a) => a.projectId === p.id && hasPendingBalance(a)),
  );
  const effectiveReqProjectId =
    reqProjectId || firstProjectWithPendingAccruals?.id || projects[0]?.id || '';
  const eligibleRequestAccruals = accruals.filter(
    (a) => a.projectId === effectiveReqProjectId && hasPendingBalance(a),
  );
  const selectedRequestedTotal = eligibleRequestAccruals
    .filter((a) => reqAccrualIds.includes(a.id))
    .reduce((total, a) => total + Number(a.balanceDue), 0);

  const toggleRequestAccrual = (accrualId: string) => {
    setReqAccrualIds((current) =>
      current.includes(accrualId)
        ? current.filter((id) => id !== accrualId)
        : [...current, accrualId],
    );
  };

  const handlePreviewBatch = async () => {
    const targetProject = batchProjectId || projects[0]?.id;
    const targetGroup = batchGroupId || paymentGroups[0]?.id;
    if (!targetProject || !targetGroup) {
      onNotify('error', 'Seleccione proyecto y grupo de pago.');
      return;
    }
    try {
      const res = await apiRequest<BatchPreviewResponse>(
        '/accruals/batches/preview',
        {
          method: 'POST',
          token,
          body: {
            code: batchCode,
            projectId: targetProject,
            paymentGroupId: targetGroup,
            periodStart,
            periodEnd,
          },
        },
      );
      setPreviewResult(res);
      onNotify(
        'success',
        `Previsualización calculada: ${res.items.length} asignaciones por un total de $${res.totalBatchAmount} USD.`,
      );
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = batchProjectId || projects[0]?.id;
    const targetGroup = batchGroupId || paymentGroups[0]?.id;
    if (!targetProject || !targetGroup) {
      onNotify('error', 'Seleccione proyecto y grupo de pago.');
      return;
    }
    try {
      await apiRequest('/accruals/batches', {
        method: 'POST',
        token,
        body: {
          code: batchCode,
          projectId: targetProject,
          paymentGroupId: targetGroup,
          periodStart,
          periodEnd,
        },
      });
      setPreviewResult(null);
      onNotify(
        'success',
        `Lote '${batchCode}' causado y persistido con prorrateo exacto (RN-CAUS-01).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCreatePaymentRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = effectiveReqProjectId;
    if (!targetProject) {
      onNotify('error', 'Seleccione un proyecto.');
      return;
    }
    if (reqAccrualIds.length === 0) {
      onNotify(
        'error',
        'Seleccione al menos una causación con saldo pendiente para consolidar la solicitud.',
      );
      return;
    }
    try {
      await apiRequest('/payment-requests', {
        method: 'POST',
        token,
        body: {
          code: reqCode,
          projectId: targetProject,
          accrualIds: reqAccrualIds,
        },
      });
      onNotify(
        'success',
        `Solicitud '${reqCode}' creada por $${selectedRequestedTotal.toFixed(2)} USD.`,
      );
      setReqAccrualIds([]);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSendRequest = async (id: string) => {
    try {
      await apiRequest(`/payment-requests/${id}/send`, {
        method: 'PATCH',
        token,
      });
      onNotify('success', 'Solicitud enviada a Gerencia (ENVIADA).');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleReviewRequest = async (
    id: string,
    decision: 'APROBADA' | 'RECHAZADA',
  ) => {
    try {
      await apiRequest(`/payment-requests/${id}/review`, {
        method: 'PATCH',
        token,
        body:
          decision === 'APROBADA'
            ? { decision: 'APROBADA' }
            : {
                decision: 'RECHAZADA',
                rejectionReason:
                  'Observación presupuestaria de Gerencia (RN-PAG-01)',
              },
      });
      onNotify(
        'success',
        decision === 'APROBADA'
          ? 'Solicitud APROBADA por Gerencia.'
          : 'Solicitud RECHAZADA con motivo registrado.',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCloseRequest = async (id: string) => {
    try {
      await apiRequest(`/payment-requests/${id}/close`, {
        method: 'PATCH',
        token,
      });
      onNotify('success', 'Solicitud CERRADA formalmente.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleExecuteFifoPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const approvedRequests = paymentRequests.filter(
      (r) =>
        r.status === PaymentRequestStatus.APROBADA ||
        r.status === PaymentRequestStatus.ENTREGADA,
    );
    const targetRequest = payRequestId || approvedRequests[0]?.id;
    const targetBeneficiary = payBeneficiaryId || beneficiaries[0]?.id;

    if (!targetRequest || !targetBeneficiary) {
      onNotify(
        'error',
        'Debe existir una Solicitud APROBADA y seleccionar un Beneficiario con deuda pendiente.',
      );
      return;
    }

    try {
      await apiRequest('/payments', {
        method: 'POST',
        token,
        body: {
          receiptCode: payReceiptCode,
          paymentRequestId: targetRequest,
          beneficiaryId: targetBeneficiary,
          amount: payAmount,
          paymentDate: payDate,
          reference: payReference,
        },
      });
      onNotify(
        'success',
        `Pago '${payReceiptCode}' por $${payAmount} USD aplicado automáticamente por orden de antigüedad FIFO (RN-PAG-02).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulPayment = async (paymentId: string) => {
    if (!annulReason || annulReason.trim().length < 10) {
      onNotify(
        'error',
        'Ingrese un motivo de anulación de al menos 10 caracteres (RN-PAG-03).',
      );
      return;
    }
    try {
      await apiRequest(`/annulments/payments/${paymentId}`, {
        method: 'POST',
        token,
        body: { reason: annulReason },
      });
      onNotify(
        'success',
        'Pago anulado transaccionalmente. La deuda retornó a las causaciones originales (RN-PAG-03).',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulAccrual = async (accrualId: string) => {
    if (!annulReason || annulReason.trim().length < 10) {
      onNotify(
        'error',
        'Ingrese un motivo de anulación de al menos 10 caracteres (RN-PAG-03).',
      );
      return;
    }
    try {
      await apiRequest(`/annulments/accruals/${accrualId}`, {
        method: 'POST',
        token,
        body: { reason: annulReason },
      });
      onNotify('success', 'Causación anulada con justificación en bitácora.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulBatch = async (batchId: string) => {
    if (!annulReason || annulReason.trim().length < 10) {
      onNotify(
        'error',
        'Ingrese un motivo de anulación de al menos 10 caracteres (RN-GLOB-04).',
      );
      return;
    }
    try {
      await apiRequest(`/annulments/accrual-batches/${batchId}`, {
        method: 'POST',
        token,
        body: { reason: annulReason },
      });
      onNotify('success', 'Lote de causación anulado con justificación.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulRequest = async (requestId: string) => {
    if (!annulReason || annulReason.trim().length < 10) {
      onNotify(
        'error',
        'Ingrese un motivo de anulación de al menos 10 caracteres (RN-GLOB-04).',
      );
      return;
    }
    try {
      await apiRequest(`/annulments/payment-requests/${requestId}`, {
        method: 'POST',
        token,
        body: { reason: annulReason },
      });
      onNotify('success', 'Solicitud de pago anulada con justificación.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleDownloadPdf = async (path: string, filename: string) => {
    if (!token) {
      onNotify('error', 'Inicie sesión en el backend para descargar el PDF.');
      return;
    }
    try {
      await downloadAuthenticatedPdf(path, filename, token);
      onNotify('success', `Descargando ${filename}...`);
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* BLOQUE 1: MOTOR DE CAUSACIÓN Y PRORRATEO */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          1. Motor de Causación por Lote y Prorrateo Exacto en USD (RN-CAUS-01 a RN-CAUS-04)
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: '#475569' }}>
          Fórmula: <code>Monto Causado = Monto Asignado × (Días Activos en el Período / Días Totales del Período)</code> con redondeo financiero <code>ROUND_HALF_UP</code> a 2 decimales.
        </p>

        {isGenerador && (
          <form onSubmit={handleGenerateBatch} style={formGridStyle}>
            <input
              value={batchCode}
              onChange={(e) => setBatchCode(e.target.value)}
              placeholder="Código de Lote"
              required
              style={inputStyle}
            />
            <select
              value={batchProjectId}
              onChange={(e) => setBatchProjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Proyecto --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <select
              value={batchGroupId}
              onChange={(e) => {
                setBatchGroupId(e.target.value);
                setBatchPeriodId('');
              }}
              style={inputStyle}
            >
              <option value="">-- Grupo de Pago --</option>
              {paymentGroups.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.name} ({pg.periodicity})
                </option>
              ))}
            </select>
            <select
              value={batchPeriodId}
              onChange={(e) => {
                const selected = batchPeriods.find(
                  (period) => period.id === e.target.value,
                );
                setBatchPeriodId(e.target.value);
                if (selected) {
                  setPeriodStart(String(selected.periodStart).slice(0, 10));
                  setPeriodEnd(String(selected.periodEnd).slice(0, 10));
                }
              }}
              style={inputStyle}
            >
              <option value="">-- Fecha de Corte Configurada --</option>
              {batchPeriods.map((period) => (
                <option key={period.id} value={period.id}>
                  {String(period.periodStart).slice(0, 10)} al{' '}
                  {String(period.periodEnd).slice(0, 10)}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
              style={inputStyle}
            />
            <button
              type="button"
              onClick={handlePreviewBatch}
              style={secondaryButtonStyle}
            >
              🔍 1. Previsualizar Prorrateo
            </button>
            <button type="submit" style={primaryButtonStyle}>
              ⚡ 2. Ejecutar Lote Causación
            </button>
          </form>
        )}

        {previewResult && (
          <div style={{ marginBottom: '1rem', padding: '0.85rem', backgroundColor: '#eff6ff', borderRadius: '0.4rem', border: '1px solid #93c5fd' }}>
            <strong style={{ color: '#1e3a8a', fontSize: '0.88rem' }}>
              Vista Previa del Lote ({previewResult.totalPeriodDays} días calendario) — Total a Causar: {formatUsdCurrency(Number(previewResult.totalBatchAmount))}
            </strong>
            <ul style={{ margin: '0.4rem 0 0', paddingLeft: '1.2rem', fontSize: '0.84rem' }}>
              {previewResult.items.map((item) => (
                <li key={item.assignmentId}>
                  <strong>{item.beneficiaryName}</strong>: {item.activeDays} / {item.totalPeriodDays} días activos →{' '}
                  <strong>{formatUsdCurrency(Number(item.proratedAmount))}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Período (Orden FIFO)</th>
              <th style={thStyle}>Beneficiario / Proyecto</th>
              <th style={thStyle}>Días Activos (Prorrateo)</th>
              <th style={thStyle}>Causado (USD)</th>
              <th style={thStyle}>Pagado (FIFO)</th>
              <th style={thStyle}>Deuda Pendiente</th>
              <th style={thStyle}>Estado Inmutable</th>
              {(isGenerador || isReceptor) && <th style={thStyle}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {accruals.map((row) => {
              const badge = getAccrualStatusMeta(row.status);
              return (
                <tr key={row.id} style={trStyle}>
                  <td style={tdStyle}>
                    {String(row.periodStart).slice(0, 10)} al{' '}
                    {String(row.periodEnd).slice(0, 10)}
                  </td>
                  <td style={tdStyle}>
                    <strong>{row.beneficiary?.fullName ?? row.beneficiaryId}</strong>{' '}
                    (<code>{row.project?.code ?? row.projectId}</code>)
                  </td>
                  <td style={tdStyle}>
                    {row.activeDays} / {row.totalPeriodDays} días
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>
                    {formatUsdCurrency(Number(row.proratedAmount))}
                  </td>
                  <td style={{ ...tdStyle, color: '#047857', fontWeight: 600 }}>
                    {formatUsdCurrency(Number(row.paidAmount))}
                  </td>
                  <td
                    style={{
                      ...tdStyle,
                      color: Number(row.balanceDue) > 0 ? '#b91c1c' : '#64748b',
                      fontWeight: 700,
                    }}
                  >
                    {formatUsdCurrency(Number(row.balanceDue))}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.76rem',
                        fontWeight: 700,
                        color: badge.colorHex,
                        backgroundColor: badge.backgroundHex,
                      }}
                    >
                      {badge.label}
                    </span>
                  </td>
                  {(isGenerador || isReceptor) && (
                    <td style={tdStyle}>
                      {isGenerador &&
                        row.status === AccrualStatus.PENDIENTE &&
                        Number(row.paidAmount) === 0 && (
                          <button
                            type="button"
                            onClick={() => handleAnnulAccrual(row.id)}
                            style={dangerOutlineButtonStyle}
                          >
                            Anular Causación
                          </button>
                        )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* BLOQUE 1B: LOTES DE CAUSACIÓN Y ANULACIÓN JUSTIFICADA */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          1B. Lotes de Causación Emitidos (RN-CAUS-04 / RN-GLOB-04)
        </h2>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Lote</th>
              <th style={thStyle}>Proyecto</th>
              <th style={thStyle}>Período</th>
              <th style={thStyle}>Total (USD)</th>
              <th style={thStyle}>Estado</th>
              {isGenerador && <th style={thStyle}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {accrualBatches.map((batch) => (
              <tr key={batch.id} style={trStyle}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{batch.code}</td>
                <td style={tdStyle}>
                  <code>{batch.project?.code ?? batch.projectId}</code>
                </td>
                <td style={tdStyle}>
                  {String(batch.periodStart).slice(0, 10)} al{' '}
                  {String(batch.periodEnd).slice(0, 10)}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {formatUsdCurrency(Number(batch.totalAmount))}
                </td>
                <td style={tdStyle}>{batch.status}</td>
                {isGenerador && (
                  <td style={tdStyle}>
                    {batch.status === 'GENERADO' &&
                      !(batch.accruals ?? []).some(
                        (accrual) => Number(accrual.paidAmount) > 0,
                      ) && (
                        <button
                          type="button"
                          onClick={() => handleAnnulBatch(batch.id)}
                          style={dangerOutlineButtonStyle}
                        >
                          Anular Lote
                        </button>
                      )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* BLOQUE 2: CICLO DE SOLICITUDES DE PAGO */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          2. Ciclo de Solicitudes de Pago y Autorización Segregada (RN-PAG-01)
        </h2>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem' }}>
          {PIPELINE_STEPS.map((step) => {
            const meta = getPaymentRequestStatusMeta(step);
            return (
              <span
                key={step}
                style={{
                  padding: '0.28rem 0.65rem',
                  borderRadius: '999px',
                  fontSize: '0.76rem',
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

        {isGenerador && (
          <form onSubmit={handleCreatePaymentRequest} style={formGridStyle}>
            <input
              value={reqCode}
              onChange={(e) => setReqCode(e.target.value)}
              placeholder="Código Solicitud (ej. SOL-2026-002)"
              required
              style={inputStyle}
            />
            <select
              value={effectiveReqProjectId}
              onChange={(e) => {
                setReqProjectId(e.target.value);
                setReqAccrualIds([]);
              }}
              style={inputStyle}
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <div
              style={{
                gridColumn: '1 / -1',
                padding: '0.6rem',
                borderRadius: '0.35rem',
                border: '1px solid #cbd5e1',
                backgroundColor: '#ffffff',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.35rem' }}>
                Causaciones con saldo pendiente del proyecto (
                {formatUsdCurrency(selectedRequestedTotal)} seleccionados)
              </div>
              {eligibleRequestAccruals.length === 0 ? (
                <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Este proyecto no tiene causaciones pendientes.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  {eligibleRequestAccruals.map((a) => (
                    <label
                      key={a.id}
                      style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', fontSize: '0.8rem' }}
                    >
                      <input
                        type="checkbox"
                        checked={reqAccrualIds.includes(a.id)}
                        onChange={() => toggleRequestAccrual(a.id)}
                      />
                      {String(a.periodStart).slice(0, 10)} al{' '}
                      {String(a.periodEnd).slice(0, 10)} ·{' '}
                      {a.beneficiary?.fullName ?? a.beneficiaryId} · Saldo{' '}
                      {formatUsdCurrency(Number(a.balanceDue))}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <button type="submit" style={primaryButtonStyle}>
              + Crear Solicitud (CREADA)
            </button>
          </form>
        )}

        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Proyecto</th>
              <th style={thStyle}>Solicitado</th>
              <th style={thStyle}>Pagado</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Acciones por Rol y Reporte PDF</th>
            </tr>
          </thead>
          <tbody>
            {paymentRequests.map((req) => {
              const meta = getPaymentRequestStatusMeta(req.status);
              return (
                <tr key={req.id} style={trStyle}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{req.code}</td>
                  <td style={tdStyle}>
                    <code>{req.project?.code ?? req.projectId}</code>
                  </td>
                  <td style={tdStyle}>
                    {formatUsdCurrency(Number(req.totalAmount))}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 700, color: '#047857' }}>
                    {formatUsdCurrency(Number(req.paidAmount))}
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '0.2rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        color: meta.colorHex,
                        backgroundColor: meta.backgroundHex,
                      }}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {isGenerador && req.status === PaymentRequestStatus.CREADA && (
                      <button
                        type="button"
                        onClick={() => handleSendRequest(req.id)}
                        style={secondaryButtonStyle}
                      >
                        📤 Enviar a Gerencia
                      </button>
                    )}
                    {isReceptor && req.status === PaymentRequestStatus.ENVIADA && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReviewRequest(req.id, 'APROBADA')}
                          style={successButtonStyle}
                        >
                          ✅ Aprobar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewRequest(req.id, 'RECHAZADA')}
                          style={dangerOutlineButtonStyle}
                        >
                          ❌ Rechazar
                        </button>
                      </>
                    )}
                    {isReceptor &&
                      req.status === PaymentRequestStatus.ENTREGADA &&
                      Number(req.paidAmount) >= Number(req.totalAmount) && (
                        <button
                          type="button"
                          onClick={() => handleCloseRequest(req.id)}
                          style={secondaryButtonStyle}
                        >
                          🔒 Cerrar Solicitud
                        </button>
                      )}
                    {isGenerador &&
                      Number(req.paidAmount) === 0 &&
                      req.status !== PaymentRequestStatus.CERRADA &&
                      req.status !== PaymentRequestStatus.RECHAZADA &&
                      req.status !== PaymentRequestStatus.ANULADA && (
                        <button
                          type="button"
                          onClick={() => handleAnnulRequest(req.id)}
                          style={dangerOutlineButtonStyle}
                        >
                          🚫 Anular Solicitud
                        </button>
                      )}
                    <button
                      type="button"
                      onClick={() =>
                        handleDownloadPdf(
                          `/reports/payment-requests/${req.id}/pdf`,
                          `solicitud_${req.code}.pdf`,
                        )
                      }
                      style={pdfButtonStyle}
                    >
                      📑 PDF Consolidado
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      {/* BLOQUE 3: EJECUCIÓN DE PAGOS CON PRELACIÓN FIFO Y ANULACIONES JUSTIFICADAS */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          3. Entrega de Fondos con Prelación Automática FIFO e Inmutabilidad (RN-PAG-02 y RN-PAG-03)
        </h2>

        {isReceptor && (
          <form onSubmit={handleExecuteFifoPayment} style={formGridStyle}>
            <input
              value={payReceiptCode}
              onChange={(e) => setPayReceiptCode(e.target.value)}
              placeholder="Código Recibo (ej. REC-2026-002)"
              required
              style={inputStyle}
            />
            <select
              value={payRequestId}
              onChange={(e) => setPayRequestId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Solicitud Aprobada --</option>
              {paymentRequests
                .filter(
                  (r) =>
                    r.status === PaymentRequestStatus.APROBADA ||
                    r.status === PaymentRequestStatus.ENTREGADA,
                )
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.code} (Total: ${r.totalAmount} · Pagado: ${r.paidAmount})
                  </option>
                ))}
            </select>
            <select
              value={payBeneficiaryId}
              onChange={(e) => setPayBeneficiaryId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Beneficiario a Pagar --</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName} ({b.dni})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
              placeholder="Monto a Entregar USD"
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={payDate}
              onChange={(e) => setPayDate(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              value={payReference}
              onChange={(e) => setPayReference(e.target.value)}
              placeholder="Referencia Bancaria / Zelle"
              style={inputStyle}
            />
            <button type="submit" style={successButtonStyle}>
              💵 Registrar Pago FIFO
            </button>
          </form>
        )}

        <div style={{ marginBottom: '0.85rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#334155' }}>
            Motivo para Anulación Justificada Inmutable (RN-PAG-03):
          </label>
          <input
            value={annulReason}
            onChange={(e) => setAnnulReason(e.target.value)}
            style={{ ...inputStyle, flex: 1, minWidth: '280px' }}
          />
        </div>

        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Recibo</th>
              <th style={thStyle}>Solicitud</th>
              <th style={thStyle}>Beneficiario</th>
              <th style={thStyle}>Monto Entregado</th>
              <th style={thStyle}>Fecha / Referencia</th>
              <th style={thStyle}>Estado</th>
              <th style={thStyle}>Recibo PDF y Anulación</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} style={trStyle}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{p.receiptCode}</td>
                <td style={tdStyle}>
                  <code>{p.paymentRequest?.code ?? p.paymentRequestId}</code>
                </td>
                <td style={tdStyle}>
                  {p.beneficiary?.fullName ?? p.beneficiaryId}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#047857' }}>
                  {formatUsdCurrency(Number(p.amount))}
                </td>
                <td style={tdStyle}>
                  {String(p.paymentDate).slice(0, 10)} · ({p.reference ?? 'S/R'})
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor:
                        p.status === 'VALIDO' ? '#dcfce7' : '#fee2e2',
                      color: p.status === 'VALIDO' ? '#065f46' : '#991b1b',
                    }}
                  >
                    {p.status}
                  </span>
                </td>
                <td style={{ ...tdStyle, display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() =>
                      handleDownloadPdf(
                        `/reports/payments/${p.id}/pdf`,
                        `recibo_${p.receiptCode}.pdf`,
                      )
                    }
                    style={pdfButtonStyle}
                  >
                    📄 Recibo PDF (FIFO)
                  </button>
                  {isReceptor && p.status === 'VALIDO' && (
                    <button
                      type="button"
                      onClick={() => handleAnnulPayment(p.id)}
                      style={dangerOutlineButtonStyle}
                    >
                      🚫 Anular con Reversión FIFO
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '1.15rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.5rem',
  fontSize: '1.08rem',
  color: '#0f172a',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
  gap: '0.6rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  backgroundColor: '#f8fafc',
  borderRadius: '0.4rem',
  border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  borderRadius: '0.35rem',
  border: '1px solid #94a3b8',
  fontSize: '0.85rem',
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
  padding: '0.4rem 0.7rem',
  borderRadius: '0.35rem',
  border: '1px solid #1e40af',
  backgroundColor: '#eff6ff',
  color: '#1e3a8a',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const successButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.7rem',
  borderRadius: '0.35rem',
  border: 'none',
  backgroundColor: '#047857',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.8rem',
  cursor: 'pointer',
};

const pdfButtonStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: '0.3rem',
  border: '1px solid #334155',
  backgroundColor: '#f8fafc',
  color: '#0f172a',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
};

const dangerOutlineButtonStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: '0.3rem',
  border: '1px solid #dc2626',
  backgroundColor: '#fef2f2',
  color: '#b91c1c',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  textAlign: 'left',
  borderBottom: '2px solid #cbd5e1',
};

const thStyle: React.CSSProperties = {
  padding: '0.55rem',
  color: '#334155',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: React.CSSProperties = {
  padding: '0.55rem',
};
