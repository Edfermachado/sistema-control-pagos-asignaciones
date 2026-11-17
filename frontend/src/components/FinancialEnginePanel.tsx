import React, { useEffect, useState } from 'react';
import {
  AccrualStatus,
  PaymentRequestStatus,
  ProjectStatus,
  UserRole,
} from '../types/domain.types';
import {
  apiRequest,
  downloadAuthenticatedPdf,
} from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';
import {
  doDateRangesIntersect,
  filterValidCutoffPeriodsForProject,
  getPayableBeneficiariesForRequest,
  toIsoDateSlice,
} from '../utils/range-validity.util';
import {
  isConfirmationArmed,
  simulateFifoPaymentPreview,
  summarizeAccrualSelection,
  toggleAllEligibleAccruals,
  validateInlineJustification,
} from '../utils/ux-workflows.util';
import {
  LiveAssignment,
  LiveBeneficiary,
  LivePaymentGroup,
  LivePaymentGroupPeriod,
  LiveProject,
} from './CatalogsAndAssignmentsWorkspace';
import { FifoSimulationPreviewTable } from './FifoSimulationPreviewTable';

const JUSTIFICATION_HINT =
  'Escriba el motivo (mínimo 10 caracteres) para habilitar esta acción justificada (RN-PAG-01/03)';

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
  items?: Array<{
    id: string;
    accrualId: string;
    requestedAmount: string | number;
    accrual?: {
      id: string;
      beneficiaryId: string;
      balanceDue: string | number;
      beneficiary?: { fullName: string; dni: string };
    };
  }>;
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
  assignments?: LiveAssignment[];
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

function accrualBadgeClass(status: AccrualStatus): string {
  switch (status) {
    case AccrualStatus.PAGADO:
      return 'badge badge--ok';
    case AccrualStatus.ANULADO:
      return 'badge badge--alert';
    case AccrualStatus.PENDIENTE:
    case AccrualStatus.PARCIAL:
      return 'badge badge--warn';
    default:
      return 'badge';
  }
}

function requestBadgeClass(status: PaymentRequestStatus): string {
  switch (status) {
    case PaymentRequestStatus.APROBADA:
    case PaymentRequestStatus.ENTREGADA:
      return 'badge badge--ok';
    case PaymentRequestStatus.RECHAZADA:
    case PaymentRequestStatus.ANULADA:
      return 'badge badge--alert';
    case PaymentRequestStatus.ENVIADA:
      return 'badge badge--warn';
    default:
      return 'badge badge--plain';
  }
}

function batchBadgeClass(status: string): string {
  return status === 'GENERADO' ? 'badge badge--ok' : 'badge badge--alert';
}

function paymentBadgeClass(status: string): string {
  return status === 'VALIDO' ? 'badge badge--ok' : 'badge badge--alert';
}

export function FinancialEnginePanel({
  token,
  activeRole,
  projects,
  paymentGroups,
  beneficiaries,
  assignments = [],
  accruals,
  accrualBatches,
  paymentRequests,
  payments,
  onRefresh,
  onNotify,
}: FinancialProps): React.ReactElement {
  const isGenerador = activeRole === UserRole.GENERADOR;
  const isReceptor = activeRole === UserRole.RECEPTOR;

  // 1. Estado Lote de Causación (código autogenerado por el sistema)
  const [batchProjectId, setBatchProjectId] = useState('');
  const [batchGroupId, setBatchGroupId] = useState('');
  const [periodStart, setPeriodStart] = useState('2026-11-01');
  const [periodEnd, setPeriodEnd] = useState('2026-11-15');
  const [batchPeriods, setBatchPeriods] = useState<LivePaymentGroupPeriod[]>([]);
  const [batchPeriodId, setBatchPeriodId] = useState('');
  const [previewResult, setPreviewResult] =
    useState<BatchPreviewResponse | null>(null);

  // Solo proyectos activos (y con asignaciones activas cuando están disponibles)
  const activeProjectsForBatch = projects.filter(
    (p) =>
      p.status === ProjectStatus.ACTIVO &&
      (assignments.length === 0 ||
        assignments.some(
          (a) =>
            a.projectId === p.id &&
            a.isActive &&
            a.beneficiary?.isActive !== false,
        )),
  );
  const effectiveBatchProject =
    activeProjectsForBatch.find((p) => p.id === batchProjectId) ??
    activeProjectsForBatch[0] ??
    projects.find((p) => p.status === ProjectStatus.ACTIVO) ??
    projects[0];

  // Solo grupos de pago activos que tengan asignaciones en el proyecto seleccionado
  const activePaymentGroupsForProject = paymentGroups.filter(
    (pg) =>
      pg.isActive &&
      (assignments.length === 0 ||
        !effectiveBatchProject ||
        assignments.some(
          (a) =>
            a.projectId === effectiveBatchProject.id &&
            a.paymentGroupId === pg.id &&
            a.isActive &&
            a.beneficiary?.isActive !== false,
        )),
  );
  const effectiveBatchGroupId =
    activePaymentGroupsForProject.find((pg) => pg.id === batchGroupId)?.id ??
    activePaymentGroupsForProject[0]?.id ??
    paymentGroups.find((pg) => pg.isActive)?.id ??
    paymentGroups[0]?.id ??
    '';

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

  // Filtra solo los períodos de corte válidos dentro de la vigencia activa del proyecto y aún no causados
  const validBatchPeriods = filterValidCutoffPeriodsForProject({
    periods: batchPeriods,
    project: effectiveBatchProject,
    paymentGroupId: effectiveBatchGroupId,
    assignments,
    existingBatches: accrualBatches,
  });

  useEffect(() => {
    if (validBatchPeriods.length === 0) {
      return;
    }
    const currentSelected = validBatchPeriods.find(
      (per) => per.id === batchPeriodId,
    );
    const chosen = currentSelected ?? validBatchPeriods[0];
    if (chosen) {
      const startIso = toIsoDateSlice(chosen.periodStart);
      const endIso = toIsoDateSlice(chosen.periodEnd);
      if (batchPeriodId !== chosen.id) {
        setBatchPeriodId(chosen.id);
      }
      if (periodStart !== startIso) {
        setPeriodStart(startIso);
      }
      if (periodEnd !== endIso) {
        setPeriodEnd(endIso);
      }
    }
  }, [validBatchPeriods, batchPeriodId, periodStart, periodEnd]);

  // 2. Estado Nueva Solicitud de Pago (código autogenerado por el sistema)
  const [reqProjectId, setReqProjectId] = useState('');
  const [reqAccrualIds, setReqAccrualIds] = useState<string[]>([]);

  // 3. Estado Ejecución de Pago FIFO (código de recibo autogenerado por el sistema)
  const [payRequestId, setPayRequestId] = useState('');
  const [payBeneficiaryId, setPayBeneficiaryId] = useState('');
  const [payAmount, setPayAmount] = useState('300.00');
  const [payReference, setPayReference] = useState('ZELLE-FACYT-9981');
  const [payDate, setPayDate] = useState('2026-11-10');

  // 4. Motivos y acciones inline por fila / confirmación en dos pasos (UX #1 y UX #5, RN-PAG-01/03).
  type InlineFinancialActionType =
    | 'ANNUL_ACCRUAL'
    | 'ANNUL_BATCH'
    | 'REJECT_REQUEST'
    | 'ANNUL_REQUEST'
    | 'ANNUL_PAYMENT';

  const [inlineRowAction, setInlineRowAction] = useState<{
    type: InlineFinancialActionType;
    targetId: string;
    reason: string;
  } | null>(null);
  const [armedConfirmKey, setArmedConfirmKey] = useState<string | null>(null);

  const openInlineRowAction = (
    type: InlineFinancialActionType,
    targetId: string,
  ) => {
    setArmedConfirmKey(null);
    setInlineRowAction({
      type,
      targetId,
      reason: '',
    });
  };

  const activeRequestAccrualIds = new Set(
    paymentRequests
      .filter((r) =>
        [
          PaymentRequestStatus.CREADA,
          PaymentRequestStatus.ENVIADA,
          PaymentRequestStatus.APROBADA,
          PaymentRequestStatus.ENTREGADA,
        ].includes(r.status),
      )
      .flatMap((r) => (r.items ?? []).map((item) => item.accrualId)),
  );

  const isAccrualEligibleForRequest = (accrual: LiveAccrual): boolean => {
    if (
      (accrual.status !== AccrualStatus.PENDIENTE &&
        accrual.status !== AccrualStatus.PARCIAL) ||
      Number(accrual.balanceDue) <= 0 ||
      activeRequestAccrualIds.has(accrual.id)
    ) {
      return false;
    }
    const proj = projects.find((p) => p.id === accrual.projectId);
    if (!proj) {
      return true;
    }
    return doDateRangesIntersect(
      accrual.periodStart,
      accrual.periodEnd,
      proj.startDate,
      proj.endDate,
    );
  };

  // Solo proyectos que poseen causaciones con saldo pendiente dentro de sus rangos válidos
  const projectsWithEligibleAccruals = projects.filter((p) =>
    accruals.some(
      (a) => a.projectId === p.id && isAccrualEligibleForRequest(a),
    ),
  );
  const effectiveReqProjectId =
    projectsWithEligibleAccruals.find((p) => p.id === reqProjectId)?.id ??
    projectsWithEligibleAccruals[0]?.id ??
    projects[0]?.id ??
    '';
  const eligibleRequestAccruals = accruals.filter(
    (a) =>
      a.projectId === effectiveReqProjectId && isAccrualEligibleForRequest(a),
  );
  const accrualSelectionSummary = summarizeAccrualSelection(
    eligibleRequestAccruals,
    reqAccrualIds,
  );
  const selectedRequestedTotal = accrualSelectionSummary.totalSelectedUsd;

  // Solicitudes con saldo pendiente real para pagos FIFO y beneficiarios incluidos en la solicitud
  const payableRequests = paymentRequests.filter(
    (r) =>
      (r.status === PaymentRequestStatus.APROBADA ||
        r.status === PaymentRequestStatus.ENTREGADA) &&
      Number(r.totalAmount) - Number(r.paidAmount) > 0,
  );
  const selectedPayableRequest =
    payableRequests.find((r) => r.id === payRequestId) ?? payableRequests[0];
  const payableBeneficiaryEntries = getPayableBeneficiariesForRequest(
    selectedPayableRequest,
    beneficiaries,
  );
  const selectedPayableBeneficiaryEntry =
    payableBeneficiaryEntries.find(
      (entry) => entry.beneficiary.id === payBeneficiaryId,
    ) ?? payableBeneficiaryEntries[0];
  const maxPayableUsd = selectedPayableBeneficiaryEntry
    ? selectedPayableBeneficiaryEntry.pendingInRequestUsd
    : selectedPayableRequest
      ? Math.max(
          0,
          Number(selectedPayableRequest.totalAmount) -
            Number(selectedPayableRequest.paidAmount),
        )
      : 9999999999.99;

  const fifoPreview = simulateFifoPaymentPreview({
    paymentAmount: payAmount,
    requestItems: selectedPayableRequest?.items,
    allAccruals: accruals,
    beneficiaryId: selectedPayableBeneficiaryEntry?.beneficiary.id ?? '',
  });

  useEffect(() => {
    if (!selectedPayableBeneficiaryEntry) {
      return;
    }
    if (payBeneficiaryId !== selectedPayableBeneficiaryEntry.beneficiary.id) {
      setPayBeneficiaryId(selectedPayableBeneficiaryEntry.beneficiary.id);
    }
    if (Number(payAmount) > selectedPayableBeneficiaryEntry.pendingInRequestUsd) {
      setPayAmount(
        selectedPayableBeneficiaryEntry.pendingInRequestUsd.toFixed(2),
      );
    }
  }, [selectedPayableBeneficiaryEntry, payBeneficiaryId, payAmount]);

  const toggleRequestAccrual = (accrualId: string) => {
    setReqAccrualIds((current) =>
      current.includes(accrualId)
        ? current.filter((id) => id !== accrualId)
        : [...current, accrualId],
    );
  };

  const handlePreviewBatch = async () => {
    const targetProject = effectiveBatchProject?.id;
    const targetGroup = effectiveBatchGroupId;
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
    const targetProject = effectiveBatchProject?.id;
    const targetGroup = effectiveBatchGroupId;
    if (!targetProject || !targetGroup) {
      onNotify('error', 'Seleccione proyecto y grupo de pago.');
      return;
    }
    try {
      const created = await apiRequest<{ batch?: { code?: string } }>(
        '/accruals/batches',
        {
          method: 'POST',
          token,
          body: {
            projectId: targetProject,
            paymentGroupId: targetGroup,
            periodStart,
            periodEnd,
          },
        },
      );
      setPreviewResult(null);
      onNotify(
        'success',
        `Lote '${created?.batch?.code ?? 'GENERADO'}' causado y persistido con prorrateo exacto (RN-CAUS-01).`,
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
      const created = await apiRequest<LivePaymentRequest>(
        '/payment-requests',
        {
          method: 'POST',
          token,
          body: {
            projectId: targetProject,
            accrualIds: reqAccrualIds,
          },
        },
      );
      onNotify(
        'success',
        `Solicitud '${created?.code ?? 'GENERADA'}' creada por $${selectedRequestedTotal.toFixed(2)} USD.`,
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
    overrideReason = '',
  ) => {
    const effectiveReason = overrideReason.trim();
    if (decision === 'RECHAZADA' && effectiveReason.length < 5) {
      onNotify(
        'error',
        'Ingrese un motivo de rechazo de al menos 5 caracteres (RN-PAG-01).',
      );
      return;
    }
    try {
      await apiRequest(`/payment-requests/${id}/review`, {
        method: 'PATCH',
        token,
        body:
          decision === 'APROBADA'
            ? { decision: 'APROBADA' }
            : {
              decision: 'RECHAZADA',
              rejectionReason: effectiveReason,
            },
      });
      onNotify(
        'success',
        decision === 'APROBADA'
          ? 'Solicitud APROBADA por Gerencia.'
          : 'Solicitud RECHAZADA con motivo registrado.',
      );
      setInlineRowAction(null);
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
      setArmedConfirmKey(null);
      onNotify('success', 'Solicitud CERRADA formalmente.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleExecuteFifoPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetRequest = selectedPayableRequest?.id;
    const targetBeneficiary =
      selectedPayableBeneficiaryEntry?.beneficiary.id ??
      payBeneficiaryId ??
      beneficiaries[0]?.id;

    if (!targetRequest || !targetBeneficiary) {
      onNotify(
        'error',
        'Debe existir una Solicitud APROBADA y seleccionar un Beneficiario con deuda pendiente.',
      );
      return;
    }

    try {
      const created = await apiRequest<{ payment?: { receiptCode?: string } }>(
        '/payments',
        {
          method: 'POST',
          token,
          body: {
            paymentRequestId: targetRequest,
            beneficiaryId: targetBeneficiary,
            amount: payAmount,
            paymentDate: payDate,
            reference: payReference,
          },
        },
      );
      onNotify(
        'success',
        `Pago '${created?.payment?.receiptCode ?? 'GENERADO'}' por $${payAmount} USD aplicado automáticamente por orden de antigüedad FIFO (RN-PAG-02).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulPayment = async (
    paymentId: string,
    overrideReason = '',
  ) => {
    const effectiveReason = overrideReason.trim();
    if (effectiveReason.length < 10) {
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
        body: { reason: effectiveReason },
      });
      onNotify(
        'success',
        'Pago anulado transaccionalmente. La deuda retornó a las causaciones originales (RN-PAG-03).',
      );
      setInlineRowAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulAccrual = async (
    accrualId: string,
    overrideReason = '',
  ) => {
    const effectiveReason = overrideReason.trim();
    if (effectiveReason.length < 10) {
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
        body: { reason: effectiveReason },
      });
      onNotify('success', 'Causación anulada con justificación en bitácora.');
      setInlineRowAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulBatch = async (
    batchId: string,
    overrideReason = '',
  ) => {
    const effectiveReason = overrideReason.trim();
    if (effectiveReason.length < 10) {
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
        body: { reason: effectiveReason },
      });
      onNotify('success', 'Lote de causación anulado con justificación.');
      setInlineRowAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulRequest = async (
    requestId: string,
    overrideReason = '',
  ) => {
    const effectiveReason = overrideReason.trim();
    if (effectiveReason.length < 10) {
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
        body: { reason: effectiveReason },
      });
      onNotify('success', 'Solicitud de pago anulada con justificación.');
      setInlineRowAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const renderInlineJustificationBox = (params: {
    type: InlineFinancialActionType;
    targetId: string;
    minLength: number;
    confirmLabel: string;
    placeholder: string;
    onConfirm: (reason: string) => void;
  }) => {
    if (
      !inlineRowAction ||
      inlineRowAction.type !== params.type ||
      inlineRowAction.targetId !== params.targetId
    ) {
      return null;
    }
    const validation = validateInlineJustification(
      inlineRowAction.reason,
      params.minLength,
    );
    return (
      <div className="inline-action-box">
        <input
          className="input"
          value={inlineRowAction.reason}
          onChange={(e) =>
            setInlineRowAction({ ...inlineRowAction, reason: e.target.value })
          }
          placeholder={params.placeholder}
          aria-label={params.confirmLabel}
        />
        <span className="inline-action-box__hint">
          {validation.valid
            ? 'Motivo válido. Confirme esta operación irreversible.'
            : `Faltan ${validation.remainingChars} caracteres (mín. ${params.minLength}).`}
        </span>
        <div className="btn-group">
          <button
            type="button"
            className="btn btn--danger btn--sm"
            disabled={!validation.valid}
            onClick={() => params.onConfirm(validation.trimmed)}
          >
            {params.confirmLabel}
          </button>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={() => setInlineRowAction(null)}
          >
            Cancelar
          </button>
        </div>
      </div>
    );
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
    <>
      {/* 1. MOTOR DE CAUSACIÓN Y PRORRATEO */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">
              Causación por lote y prorrateo exacto en USD
            </h2>
            <p className="sheet__hint">
              Monto causado = monto asignado × (días activos / días totales del
              período), con redondeo financiero a 2 decimales. RN-CAUS-01 a
              RN-CAUS-04.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            {isGenerador && (
              <form onSubmit={handleGenerateBatch} className="stack">
                <div className="form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="batch-code">
                      Código de lote (sistema)
                    </label>
                    <input
                      id="batch-code"
                      className="input"
                      value="Autogenerado por el sistema"
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="batch-project">
                      Proyecto activo (vigencia)
                    </label>
                    <select
                      id="batch-project"
                      className="select"
                      value={effectiveBatchProject?.id ?? ''}
                      onChange={(e) => {
                        setBatchProjectId(e.target.value);
                        setBatchGroupId('');
                        setBatchPeriodId('');
                        setPreviewResult(null);
                      }}
                    >
                      {activeProjectsForBatch.length === 0 && (
                        <option value="">
                          Sin proyectos activos con asignaciones
                        </option>
                      )}
                      {activeProjectsForBatch.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name} ({toIsoDateSlice(p.startDate)} →{' '}
                          {toIsoDateSlice(p.endDate)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="batch-group">
                      Grupo de pago con asignaciones
                    </label>
                    <select
                      id="batch-group"
                      className="select"
                      value={effectiveBatchGroupId}
                      onChange={(e) => {
                        setBatchGroupId(e.target.value);
                        setBatchPeriodId('');
                        setPreviewResult(null);
                      }}
                    >
                      {activePaymentGroupsForProject.length === 0 && (
                        <option value="">
                          Sin grupos asignados en este proyecto
                        </option>
                      )}
                      {activePaymentGroupsForProject.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name} ({pg.periodicity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="batch-period">
                      Período válido disponible ({validBatchPeriods.length})
                    </label>
                    <select
                      id="batch-period"
                      className="select"
                      value={batchPeriodId}
                      onChange={(e) => {
                        const selected = validBatchPeriods.find(
                          (period) => period.id === e.target.value,
                        );
                        setBatchPeriodId(e.target.value);
                        setPreviewResult(null);
                        if (selected) {
                          setPeriodStart(toIsoDateSlice(selected.periodStart));
                          setPeriodEnd(toIsoDateSlice(selected.periodEnd));
                        }
                      }}
                    >
                      {validBatchPeriods.length === 0 && (
                        <option value="">
                          Sin períodos disponibles por causar en este rango
                        </option>
                      )}
                      {validBatchPeriods.map((period) => (
                        <option key={period.id} value={period.id}>
                          {toIsoDateSlice(period.periodStart)} al{' '}
                          {toIsoDateSlice(period.periodEnd)}
                          {period.label ? ` — ${period.label}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="period-start">
                      Inicio del período
                    </label>
                    <input
                      id="period-start"
                      className="input"
                      type="date"
                      min={
                        effectiveBatchProject
                          ? toIsoDateSlice(effectiveBatchProject.startDate)
                          : undefined
                      }
                      max={
                        effectiveBatchProject
                          ? toIsoDateSlice(effectiveBatchProject.endDate)
                          : undefined
                      }
                      value={periodStart}
                      onChange={(e) => setPeriodStart(e.target.value)}
                      readOnly={batchPeriods.length > 0}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="period-end">
                      Fin del período
                    </label>
                    <input
                      id="period-end"
                      className="input"
                      type="date"
                      min={
                        periodStart ||
                        (effectiveBatchProject
                          ? toIsoDateSlice(effectiveBatchProject.startDate)
                          : undefined)
                      }
                      max={
                        effectiveBatchProject
                          ? toIsoDateSlice(effectiveBatchProject.endDate)
                          : undefined
                      }
                      value={periodEnd}
                      onChange={(e) => setPeriodEnd(e.target.value)}
                      readOnly={batchPeriods.length > 0}
                      required
                    />
                  </div>
                </div>
                <div className="btn-group">
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={handlePreviewBatch}
                  >
                    Previsualizar prorrateo
                  </button>
                  <button type="submit" className="btn">
                    Ejecutar lote de causación
                  </button>
                </div>
              </form>
            )}

            {previewResult && (
              <div className="subsheet">
                <h3 className="subsheet__title">Vista previa del lote</h3>
                <p className="sheet__hint">
                  {previewResult.totalPeriodDays} días calendario en el período.
                  Total a causar:{' '}
                  {formatUsdCurrency(Number(previewResult.totalBatchAmount))}.
                </p>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Beneficiario</th>
                        <th scope="col" className="num">
                          Días activos
                        </th>
                        <th scope="col" className="num">
                          Días totales
                        </th>
                        <th scope="col" className="num">
                          Monto prorrateado (USD)
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewResult.items.map((item) => (
                        <tr key={item.assignmentId}>
                          <td className="table__strong">
                            {item.beneficiaryName}
                          </td>
                          <td className="num">{item.activeDays}</td>
                          <td className="num">{item.totalPeriodDays}</td>
                          <td className="num">
                            {formatUsdCurrency(Number(item.proratedAmount))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Período</th>
                    <th scope="col">Beneficiario</th>
                    <th scope="col">Proyecto</th>
                    <th scope="col">Días activos / totales</th>
                    <th scope="col" className="num">
                      Causado (USD)
                    </th>
                    <th scope="col" className="num">
                      Pagado FIFO (USD)
                    </th>
                    <th scope="col" className="num">
                      Deuda pendiente (USD)
                    </th>
                    <th scope="col">Estado</th>
                    {(isGenerador || isReceptor) && (
                      <th scope="col">Acción</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {accruals.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={isGenerador || isReceptor ? 9 : 8}>
                        Sin causaciones registradas. Genere un lote de causación
                        con el formulario superior.
                      </td>
                    </tr>
                  )}
                  {accruals.map((row) => (
                    <tr key={row.id}>
                      <td className="nowrap">
                        {String(row.periodStart).slice(0, 10)} al{' '}
                        {String(row.periodEnd).slice(0, 10)}
                      </td>
                      <td className="table__strong">
                        {row.beneficiary?.fullName ?? row.beneficiaryId}
                      </td>
                      <td className="nowrap">
                        {row.project?.code ?? row.projectId}
                      </td>
                      <td>
                        {row.activeDays} / {row.totalPeriodDays}
                      </td>
                      <td className="num">
                        {formatUsdCurrency(Number(row.proratedAmount))}
                      </td>
                      <td className="num">
                        {formatUsdCurrency(Number(row.paidAmount))}
                      </td>
                      <td className="num table__strong">
                        {formatUsdCurrency(Number(row.balanceDue))}
                      </td>
                      <td>
                        <span className={accrualBadgeClass(row.status)}>
                          {row.status}
                        </span>
                      </td>
                      {(isGenerador || isReceptor) && (
                        <td>
                          {isGenerador &&
                            row.status === AccrualStatus.PENDIENTE &&
                            Number(row.paidAmount) === 0 && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() =>
                                    openInlineRowAction('ANNUL_ACCRUAL', row.id)
                                  }
                                  title={JUSTIFICATION_HINT}
                                >
                                  Anular causación
                                </button>
                                {renderInlineJustificationBox({
                                  type: 'ANNUL_ACCRUAL',
                                  targetId: row.id,
                                  minLength: 10,
                                  confirmLabel: 'Confirmar anulación',
                                  placeholder:
                                    'Motivo de anulación de esta causación...',
                                  onConfirm: (reason) =>
                                    void handleAnnulAccrual(row.id, reason),
                                })}
                              </>
                            )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 2. LOTES DE CAUSACIÓN EMITIDOS */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Lotes de causación emitidos</h2>
            <p className="sheet__hint">
              Lotes generados y persistidos, con su total y anulación
              justificada. RN-CAUS-04 y RN-GLOB-04.
            </p>
          </div>
        </div>
        <div className="sheet__body sheet__body--flush">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Lote</th>
                  <th scope="col">Proyecto</th>
                  <th scope="col">Período</th>
                  <th scope="col" className="num">
                    Total (USD)
                  </th>
                  <th scope="col">Estado</th>
                  {isGenerador && <th scope="col">Acción</th>}
                </tr>
              </thead>
              <tbody>
                {accrualBatches.length === 0 && (
                  <tr className="table__empty">
                    <td colSpan={isGenerador ? 6 : 5}>
                      Sin lotes emitidos. Genere un lote desde el folio de
                      causación.
                    </td>
                  </tr>
                )}
                {accrualBatches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="nowrap table__strong">{batch.code}</td>
                    <td className="nowrap">
                      {batch.project?.code ?? batch.projectId}
                    </td>
                    <td className="nowrap">
                      {String(batch.periodStart).slice(0, 10)} al{' '}
                      {String(batch.periodEnd).slice(0, 10)}
                    </td>
                    <td className="num">
                      {formatUsdCurrency(Number(batch.totalAmount))}
                    </td>
                    <td>
                      <span className={batchBadgeClass(batch.status)}>
                        {batch.status}
                      </span>
                    </td>
                    {isGenerador && (
                      <td>
                        {batch.status === 'GENERADO' &&
                          !(batch.accruals ?? []).some(
                            (accrual) => Number(accrual.paidAmount) > 0,
                          ) && (
                            <>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() =>
                                  openInlineRowAction('ANNUL_BATCH', batch.id)
                                }
                                title={JUSTIFICATION_HINT}
                              >
                                Anular lote
                              </button>
                              {renderInlineJustificationBox({
                                type: 'ANNUL_BATCH',
                                targetId: batch.id,
                                minLength: 10,
                                confirmLabel: 'Confirmar anulación de lote',
                                placeholder:
                                  'Motivo de anulación de este lote...',
                                onConfirm: (reason) =>
                                  void handleAnnulBatch(batch.id, reason),
                              })}
                            </>
                          )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* 3. CICLO DE SOLICITUDES DE PAGO */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Ciclo de solicitudes de pago</h2>
            <p className="sheet__hint">
              Creación, envío a Gerencia, aprobación o rechazo y cierre, con
              segregación de funciones. RN-PAG-01.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            <div className="row" aria-label="Flujo de la solicitud">
              {PIPELINE_STEPS.map((step) => (
                <span key={step} className={requestBadgeClass(step)}>
                  {step}
                </span>
              ))}
            </div>

            {isGenerador && (
              <form onSubmit={handleCreatePaymentRequest} className="stack">
                <div className="form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="req-code">
                      Código de solicitud (sistema)
                    </label>
                    <input
                      id="req-code"
                      className="input"
                      value="Autogenerado por el sistema"
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="req-project">
                      Proyecto con causaciones disponibles
                    </label>
                    <select
                      id="req-project"
                      className="select"
                      value={effectiveReqProjectId}
                      onChange={(e) => {
                        setReqProjectId(e.target.value);
                        setReqAccrualIds([]);
                      }}
                    >
                      {projectsWithEligibleAccruals.length === 0 && (
                        <option value="">
                          Sin proyectos con causaciones libres para consolidar
                        </option>
                      )}
                      {projectsWithEligibleAccruals.map((p) => {
                        const projEligible = accruals.filter(
                          (a) =>
                            a.projectId === p.id &&
                            isAccrualEligibleForRequest(a),
                        );
                        const projSum = projEligible.reduce(
                          (sum, a) => sum + Number(a.balanceDue),
                          0,
                        );
                        return (
                          <option key={p.id} value={p.id}>
                            {p.code} - {p.name} ({projEligible.length} disp. ·{' '}
                            {formatUsdCurrency(projSum)})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
                <div className="field">
                  <span className="field__label">
                    Causaciones con saldo pendiente del proyecto
                  </span>
                  <div className="subsheet">
                    <div className="selection-toolbar">
                      <div className="selection-toolbar__chips">
                        <span className="chip">
                          Seleccionadas:{' '}
                          <strong>
                            {accrualSelectionSummary.selectedCount} de{' '}
                            {accrualSelectionSummary.totalEligibleCount}
                          </strong>
                        </span>
                        <span className="chip">
                          Beneficiarios:{' '}
                          <strong>
                            {accrualSelectionSummary.uniqueBeneficiariesCount}
                          </strong>
                        </span>
                        <span className="chip">
                          Total a solicitar:{' '}
                          <strong>
                            {formatUsdCurrency(selectedRequestedTotal)} USD
                          </strong>
                        </span>
                      </div>
                      {eligibleRequestAccruals.length > 0 && (
                        <button
                          type="button"
                          className="btn btn--ghost btn--sm"
                          onClick={() =>
                            setReqAccrualIds((current) =>
                              toggleAllEligibleAccruals(
                                eligibleRequestAccruals,
                                current,
                              ),
                            )
                          }
                        >
                          {accrualSelectionSummary.allSelected
                            ? 'Limpiar selección'
                            : `Seleccionar todas (${accrualSelectionSummary.totalEligibleCount})`}
                        </button>
                      )}
                    </div>
                    {eligibleRequestAccruals.length === 0 ? (
                      <p className="muted">
                        Este proyecto no tiene causaciones con saldo pendiente.
                      </p>
                    ) : (
                      <div className="stack">
                        {eligibleRequestAccruals.map((a) => (
                          <label key={a.id} className="row">
                            <input
                              type="checkbox"
                              checked={reqAccrualIds.includes(a.id)}
                              onChange={() => toggleRequestAccrual(a.id)}
                            />
                            <span>
                              {a.beneficiary?.fullName ?? a.beneficiaryId}
                            </span>
                            <span className="muted">
                              saldo {formatUsdCurrency(Number(a.balanceDue))}
                            </span>
                            <span className="muted">
                              {String(a.periodStart).slice(0, 10)} al{' '}
                              {String(a.periodEnd).slice(0, 10)}
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="btn-group">
                  <button type="submit" className="btn">
                    Crear solicitud
                  </button>
                </div>
              </form>
            )}

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Proyecto</th>
                    <th scope="col" className="num">
                      Solicitado (USD)
                    </th>
                    <th scope="col" className="num">
                      Pagado (USD)
                    </th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {paymentRequests.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={6}>
                        Sin solicitudes de pago. Cree una solicitud
                        seleccionando causaciones con saldo pendiente.
                      </td>
                    </tr>
                  )}
                  {paymentRequests.map((req) => (
                    <tr key={req.id}>
                      <td className="nowrap table__strong">{req.code}</td>
                      <td className="nowrap">
                        {req.project?.code ?? req.projectId}
                      </td>
                      <td className="num">
                        {formatUsdCurrency(Number(req.totalAmount))}
                      </td>
                      <td className="num">
                        {formatUsdCurrency(Number(req.paidAmount))}
                      </td>
                      <td>
                        <span className={requestBadgeClass(req.status)}>
                          {req.status}
                        </span>
                        {req.rejectionReason && (
                          <div className="muted">
                            Rechazo: {req.rejectionReason}
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="btn-group">
                          {isGenerador &&
                            req.status === PaymentRequestStatus.CREADA && (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() => handleSendRequest(req.id)}
                              >
                                Enviar a Gerencia
                              </button>
                            )}
                          {isReceptor &&
                            req.status === PaymentRequestStatus.ENVIADA && (
                              <>
                                <button
                                  type="button"
                                  className="btn btn--sm"
                                  onClick={() =>
                                    handleReviewRequest(req.id, 'APROBADA')
                                  }
                                >
                                  Aprobar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() =>
                                    openInlineRowAction(
                                      'REJECT_REQUEST',
                                      req.id,
                                    )
                                  }
                                  title={JUSTIFICATION_HINT}
                                >
                                  Rechazar
                                </button>
                              </>
                            )}
                          {isReceptor &&
                            req.status === PaymentRequestStatus.ENTREGADA &&
                            Number(req.paidAmount) >= Number(req.totalAmount) &&
                            (isConfirmationArmed(
                              armedConfirmKey,
                              `CLOSE_REQ:${req.id}`,
                            ) ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn--sm"
                                  onClick={() => handleCloseRequest(req.id)}
                                >
                                  ¿Confirmar cierre?
                                </button>
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  onClick={() => setArmedConfirmKey(null)}
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="btn btn--ghost btn--sm"
                                onClick={() =>
                                  setArmedConfirmKey(`CLOSE_REQ:${req.id}`)
                                }
                              >
                                Cerrar solicitud
                              </button>
                            ))}
                          {isGenerador &&
                            Number(req.paidAmount) === 0 &&
                            req.status !== PaymentRequestStatus.CERRADA &&
                            req.status !== PaymentRequestStatus.RECHAZADA &&
                            req.status !== PaymentRequestStatus.ANULADA && (
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() =>
                                  openInlineRowAction('ANNUL_REQUEST', req.id)
                                }
                                title={JUSTIFICATION_HINT}
                              >
                                Anular solicitud
                              </button>
                            )}
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() =>
                              handleDownloadPdf(
                                `/reports/payment-requests/${req.id}/pdf`,
                                `solicitud_${req.code}.pdf`,
                              )
                            }
                          >
                            PDF consolidado
                          </button>
                        </div>
                        {renderInlineJustificationBox({
                          type: 'REJECT_REQUEST',
                          targetId: req.id,
                          minLength: 5,
                          confirmLabel: 'Confirmar rechazo',
                          placeholder:
                            'Motivo de rechazo de esta solicitud...',
                          onConfirm: (reason) =>
                            void handleReviewRequest(
                              req.id,
                              'RECHAZADA',
                              reason,
                            ),
                        })}
                        {renderInlineJustificationBox({
                          type: 'ANNUL_REQUEST',
                          targetId: req.id,
                          minLength: 10,
                          confirmLabel: 'Confirmar anulación de solicitud',
                          placeholder:
                            'Motivo de anulación de esta solicitud...',
                          onConfirm: (reason) =>
                            void handleAnnulRequest(req.id, reason),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* 4. ENTREGA DE FONDOS FIFO Y ANULACIONES */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">
              Entrega de fondos con prelación FIFO
            </h2>
            <p className="sheet__hint">
              Pagos aplicados por antigüedad de la deuda y anulación con
              reversión contable. RN-PAG-02 y RN-PAG-03.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            {isReceptor && (
              <form onSubmit={handleExecuteFifoPayment} className="stack">
                <div className="form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="pay-receipt">
                      Código de recibo (sistema)
                    </label>
                    <input
                      id="pay-receipt"
                      className="input"
                      value="Autogenerado por el sistema"
                      readOnly
                      disabled
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="pay-request">
                      Solicitud aprobada con saldo pendiente
                    </label>
                    <select
                      id="pay-request"
                      className="select"
                      value={selectedPayableRequest?.id ?? ''}
                      onChange={(e) => {
                        setPayRequestId(e.target.value);
                        setPayBeneficiaryId('');
                      }}
                    >
                      {payableRequests.length === 0 && (
                        <option value="">
                          Sin solicitudes aprobadas con saldo por pagar
                        </option>
                      )}
                      {payableRequests.map((r) => {
                        const pending = Math.max(
                          0,
                          Number(r.totalAmount) - Number(r.paidAmount),
                        );
                        return (
                          <option key={r.id} value={r.id}>
                            {r.code} — Pendiente: {formatUsdCurrency(pending)}{' '}
                            (Total: {formatUsdCurrency(Number(r.totalAmount))})
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="pay-beneficiary">
                      Beneficiario incluido en la solicitud
                    </label>
                    <select
                      id="pay-beneficiary"
                      className="select"
                      value={
                        selectedPayableBeneficiaryEntry?.beneficiary.id ?? ''
                      }
                      onChange={(e) => {
                        const nextBenId = e.target.value;
                        setPayBeneficiaryId(nextBenId);
                        const match = payableBeneficiaryEntries.find(
                          (entry) => entry.beneficiary.id === nextBenId,
                        );
                        if (match) {
                          setPayAmount(match.pendingInRequestUsd.toFixed(2));
                        }
                      }}
                    >
                      {payableBeneficiaryEntries.length === 0 && (
                        <option value="">
                          Sin beneficiarios con deuda en esta solicitud
                        </option>
                      )}
                      {payableBeneficiaryEntries.map(
                        ({ beneficiary: b, pendingInRequestUsd }) => (
                          <option key={b.id} value={b.id}>
                            {b.fullName} ({b.dni}) — Deuda en solicitud:{' '}
                            {formatUsdCurrency(pendingInRequestUsd)}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="pay-amount">
                      Monto a entregar (Máx: {formatUsdCurrency(maxPayableUsd)})
                    </label>
                    <input
                      id="pay-amount"
                      className="input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={maxPayableUsd.toFixed(2)}
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="pay-date">
                      Fecha de pago
                    </label>
                    <input
                      id="pay-date"
                      className="input"
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="pay-reference">
                      Referencia bancaria
                    </label>
                    <input
                      id="pay-reference"
                      className="input"
                      value={payReference}
                      onChange={(e) => setPayReference(e.target.value)}
                    />
                  </div>
                </div>
                {selectedPayableRequest && (
                  <FifoSimulationPreviewTable preview={fifoPreview} />
                )}
                <div className="btn-group">
                  <button
                    type="submit"
                    className="btn"
                    disabled={
                      Boolean(selectedPayableRequest) &&
                      fifoPreview.steps.length > 0 &&
                      !fifoPreview.isValidAmount
                    }
                  >
                    Registrar pago
                  </button>
                </div>
              </form>
            )}

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Recibo</th>
                    <th scope="col">Solicitud</th>
                    <th scope="col">Beneficiario</th>
                    <th scope="col" className="num">
                      Monto entregado (USD)
                    </th>
                    <th scope="col">Fecha / referencia</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Recibo PDF y anulación</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={7}>
                        Sin pagos registrados. Registre un pago con prelación
                        FIFO sobre una solicitud aprobada.
                      </td>
                    </tr>
                  )}
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <td className="nowrap table__strong">
                        {p.receiptCode}
                      </td>
                      <td className="nowrap">
                        {p.paymentRequest?.code ?? p.paymentRequestId}
                      </td>
                      <td className="table__strong">
                        {p.beneficiary?.fullName ?? p.beneficiaryId}
                      </td>
                      <td className="num">
                        {formatUsdCurrency(Number(p.amount))}
                      </td>
                      <td className="nowrap">
                        {String(p.paymentDate).slice(0, 10)} ({p.reference ??
                          'S/R'})
                      </td>
                      <td>
                        <span className={paymentBadgeClass(p.status)}>
                          {p.status}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() =>
                              handleDownloadPdf(
                                `/reports/payments/${p.id}/pdf`,
                                `recibo_${p.receiptCode}.pdf`,
                              )
                            }
                          >
                            Recibo PDF
                          </button>
                          {isReceptor && p.status === 'VALIDO' && (
                            <button
                              type="button"
                              className="btn btn--danger btn--sm"
                              onClick={() =>
                                openInlineRowAction('ANNUL_PAYMENT', p.id)
                              }
                              title={JUSTIFICATION_HINT}
                            >
                              Anular con reversión FIFO
                            </button>
                          )}
                        </div>
                        {renderInlineJustificationBox({
                          type: 'ANNUL_PAYMENT',
                          targetId: p.id,
                          minLength: 10,
                          confirmLabel: 'Confirmar reversión FIFO',
                          placeholder:
                            'Motivo de anulación de este pago...',
                          onConfirm: (reason) =>
                            void handleAnnulPayment(p.id, reason),
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
