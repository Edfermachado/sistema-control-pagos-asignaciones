import React, { useEffect, useState } from 'react';
import { ProjectStatus, UserRole } from '../types/domain.types';
import {
  apiRequest,
  DEFAULT_API_BASE_URL,
  uploadAuthenticatedFile,
} from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';
import { calculatePettyCashUtilizationPercent } from '../utils/petty-cash.util';
import { getNextSequentialYearMonth } from '../utils/range-validity.util';
import {
  getDefaultVoucherSettlementDraft,
  isConfirmationArmed,
  validateInlineJustification,
} from '../utils/ux-workflows.util';
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
  attachmentUrl?: string | null;
  rejectionReason?: string | null;
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

  // 1. Crear Caja Chica (código autogenerado por el sistema)
  const [boxName, setBoxName] = useState('Caja Chica Reactivos Química FACYT');
  const [boxProjectId, setBoxProjectId] = useState('');
  const [boxAuthAmount, setBoxAuthAmount] = useState('250.00');

  // 2. Abrir Período Mensual
  const [periodPettyCashId, setPeriodPettyCashId] = useState('');
  const [periodYearMonth, setPeriodYearMonth] = useState('2026-12');
  const [periodReplenishment, setPeriodReplenishment] = useState('134.50');

  // 3. Solicitar Vale (código autogenerado por el sistema)
  const [voucherPeriodId, setVoucherPeriodId] = useState('');
  const [voucherBeneficiary, setVoucherBeneficiary] = useState(
    'TSU. Carlos Pérez',
  );
  const [voucherConcept, setVoucherConcept] = useState(
    'Compra urgente de filtros y guantes de nitrilo',
  );
  const [voucherAmount, setVoucherAmount] = useState('45.00');

  // 4. Acciones inline por fila de vale y confirmación en dos pasos (UX #1 y UX #5)
  const [inlineVoucherAction, setInlineVoucherAction] = useState<{
    type: 'SETTLE' | 'REJECT' | 'ANNUL';
    voucherId: string;
    settledAmount: string;
    invoiceReference: string;
    reason: string;
    maxAllowedAmount: number;
  } | null>(null);
  const [inlineSettleFile, setInlineSettleFile] = useState<File | null>(null);
  const [armedConfirmKey, setArmedConfirmKey] = useState<string | null>(null);

  // Proyectos activos para crear caja chica (RN-CAJA-01)
  const activeProjects = projects.filter(
    (p) => p.status === ProjectStatus.ACTIVO,
  );

  // Solo cajas chicas ACTIVAS sin período ABIERTO ni SOLICITADO pueden abrir un nuevo mes (RN-CAJA-02)
  const openableBoxes = pettyCashes.filter(
    (pc) =>
      pc.status === 'ACTIVA' &&
      !pc.periods.some(
        (per) => per.status === 'ABIERTO' || per.status === 'SOLICITADO',
      ),
  );
  const selectedOpenableBox =
    openableBoxes.find((pc) => pc.id === periodPettyCashId) ?? openableBoxes[0];

  const lastClosedPeriodOfSelectedBox = selectedOpenableBox?.periods
    .filter((per) => per.status === 'CERRADO')
    .sort((a, b) => b.yearMonth.localeCompare(a.yearMonth))[0];
  const expectedCarryoverUsd = lastClosedPeriodOfSelectedBox?.closingBalance
    ? Number(lastClosedPeriodOfSelectedBox.closingBalance)
    : 0;
  const maxReplenishmentUsd = selectedOpenableBox
    ? Math.max(
        0,
        Number(selectedOpenableBox.authorizedAmount) - expectedCarryoverUsd,
      )
    : 9999999999.99;

  useEffect(() => {
    if (!selectedOpenableBox) {
      return;
    }
    const nextYm = getNextSequentialYearMonth(
      lastClosedPeriodOfSelectedBox?.yearMonth,
      '2026-11',
    );
    if (periodYearMonth !== nextYm) {
      setPeriodYearMonth(nextYm);
    }
    const recommendedRep = maxReplenishmentUsd.toFixed(2);
    if (Number(periodReplenishment) > maxReplenishmentUsd) {
      setPeriodReplenishment(recommendedRep);
    }
  }, [
    selectedOpenableBox,
    lastClosedPeriodOfSelectedBox?.yearMonth,
    maxReplenishmentUsd,
    periodYearMonth,
    periodReplenishment,
  ]);

  const handleCreatePettyCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProject = boxProjectId || activeProjects[0]?.id;
    if (!targetProject) {
      onNotify('error', 'Seleccione un proyecto activo.');
      return;
    }
    try {
      const created = await apiRequest<LivePettyCash>('/petty-cashes', {
        method: 'POST',
        token,
        body: {
          name: boxName,
          projectId: targetProject,
          authorizedAmount: boxAuthAmount,
        },
      });
      onNotify(
        'success',
        `Caja chica '${created?.code ?? boxName}' creada correctamente.`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleOpenPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBox = selectedOpenableBox?.id;
    if (!targetBox) {
      onNotify(
        'error',
        'No hay cajas chicas disponibles para abrir período (deben estar ACTIVAS y sin período abierto).',
      );
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
      setArmedConfirmKey(null);
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
      const created = await apiRequest<LivePettyCashVoucher>(
        `/petty-cashes/periods/${targetPeriod}/vouchers`,
        {
          method: 'POST',
          token,
          body: {
            beneficiaryName: voucherBeneficiary,
            concept: voucherConcept,
            requestedAmount: voucherAmount,
          },
        },
      );
      onNotify(
        'success',
        `Vale '${created?.code ?? 'GENERADO'}' solicitado.`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleApproveVoucher = async (voucherId: string) => {
    try {
      await apiRequest(`/petty-cashes/vouchers/${voucherId}/approve`, {
        method: 'PATCH',
        token,
      });
      onNotify('success', 'Vale APROBADO por Gerencia. Aún no se mueve saldo.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleRejectVoucher = async (voucherId: string, reason: string) => {
    const cleanReason = reason.trim();
    if (cleanReason.length < 5) {
      onNotify(
        'error',
        'Ingrese un motivo de rechazo de al menos 5 caracteres (RN-CAJA-03).',
      );
      return;
    }
    try {
      await apiRequest(`/petty-cashes/vouchers/${voucherId}/reject`, {
        method: 'PATCH',
        token,
        body: { reason: cleanReason },
      });
      onNotify('success', 'Vale RECHAZADO con motivo registrado.');
      setInlineVoucherAction(null);
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
        'Vale desembolsado. Saldo disponible descontado en tiempo real (RN-CAJA-02).',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSettleVoucher = async (
    voucherId: string,
    settledAmountValue: string,
    invoiceRefValue: string,
  ) => {
    if (!inlineSettleFile) {
      onNotify(
        'error',
        'Adjunte el archivo del comprobante antes de rendir el vale (RN-CAJA-03).',
      );
      return;
    }
    if (!invoiceRefValue.trim()) {
      onNotify('error', 'Ingrese el número de factura o comprobante.');
      return;
    }
    try {
      const uploaded = await uploadAuthenticatedFile(
        '/uploads',
        inlineSettleFile,
        token ?? '',
      );
      await apiRequest(`/petty-cashes/vouchers/${voucherId}/settle`, {
        method: 'PATCH',
        token,
        body: {
          settledAmount: settledAmountValue,
          invoiceReference: invoiceRefValue.trim(),
          attachmentUrl: uploaded.url,
        },
      });
      onNotify(
        'success',
        `Vale rendido con comprobante '${invoiceRefValue.trim()}'. El vuelto sobrante retornó al disponible de la caja (RN-CAJA-03).`,
      );
      setInlineSettleFile(null);
      setInlineVoucherAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleAnnulVoucher = async (voucherId: string, reason: string) => {
    const cleanReason = reason.trim();
    if (cleanReason.length < 10) {
      onNotify(
        'error',
        'Ingrese un motivo de anulación de al menos 10 caracteres (RN-GLOB-04).',
      );
      return;
    }
    try {
      await apiRequest(`/annulments/petty-cash-vouchers/${voucherId}`, {
        method: 'POST',
        token,
        body: { reason: cleanReason },
      });
      onNotify('success', 'Vale anulado y saldo revertido según su estado.');
      setInlineVoucherAction(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleClosePettyCash = async (pettyCashId: string) => {
    try {
      await apiRequest(`/petty-cashes/${pettyCashId}/close`, {
        method: 'PATCH',
        token,
      });
      setArmedConfirmKey(null);
      onNotify('success', 'Caja chica cerrada definitivamente.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const openPeriodsList = pettyCashes.flatMap((pc) =>
    pc.periods
      .filter(
        (per) => per.status === 'ABIERTO' && Number(per.availableBalance) > 0,
      )
      .map((per) => ({ ...per, boxCode: pc.code })),
  );
  const selectedVoucherPeriod =
    openPeriodsList.find((per) => per.id === voucherPeriodId) ??
    openPeriodsList[0];
  const maxVoucherAmountUsd = selectedVoucherPeriod
    ? Number(selectedVoucherPeriod.availableBalance)
    : 9999999999.99;

  const resolveAttachmentUrl = (attachmentUrl: string): string => {
    if (/^https?:\/\//i.test(attachmentUrl)) {
      return attachmentUrl;
    }
    const backendOrigin = DEFAULT_API_BASE_URL.replace(/\/api\/?$/, '');
    return `${backendOrigin}${attachmentUrl}`;
  };

  return (
    <div className="stack stack--lg">
      {isGenerador && (
        <>
          <section className="sheet">
            <div className="sheet__head">
              <div>
                <h2 className="sheet__title">Crear caja chica por proyecto</h2>
                <p className="sheet__hint">
                  Código, nombre, proyecto y tope autorizado de la caja chica
                  (RN-CAJA-01).
                </p>
              </div>
            </div>
            <div className="sheet__body">
              <form className="form-grid" onSubmit={handleCreatePettyCash}>
                <div className="field">
                  <label className="field__label" htmlFor="box-code">
                    Código de la caja (sistema)
                  </label>
                  <input
                    id="box-code"
                    className="input"
                    value="Autogenerado por el sistema"
                    readOnly
                    disabled
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="box-name">
                    Nombre de la caja chica
                  </label>
                  <input
                    id="box-name"
                    className="input"
                    value={boxName}
                    onChange={(e) => setBoxName(e.target.value)}
                    placeholder="Caja chica de reactivos"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="box-project">
                    Proyecto activo
                  </label>
                  <select
                    id="box-project"
                    className="select"
                    value={boxProjectId || activeProjects[0]?.id || ''}
                    onChange={(e) => setBoxProjectId(e.target.value)}
                  >
                    {activeProjects.length === 0 && (
                      <option value="">Sin proyectos activos</option>
                    )}
                    {activeProjects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="box-auth-amount">
                    Tope autorizado (USD)
                  </label>
                  <input
                    id="box-auth-amount"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max="9999999999.99"
                    value={boxAuthAmount}
                    onChange={(e) => setBoxAuthAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <button type="submit" className="btn">
                  Crear caja chica
                </button>
              </form>
            </div>
          </section>

          <section className="sheet">
            <div className="sheet__head">
              <div>
                <h2 className="sheet__title">
                  Solicitar apertura mensual (con arrastre)
                </h2>
                <p className="sheet__hint">
                  Apertura mensual con arrastre automático del saldo del mes
                  anterior (RN-CAJA-02).
                </p>
              </div>
            </div>
            <div className="sheet__body">
              <form className="form-grid" onSubmit={handleOpenPeriod}>
                <div className="field">
                  <label className="field__label" htmlFor="period-box">
                    Caja chica disponible para apertura
                  </label>
                  <select
                    id="period-box"
                    className="select"
                    value={selectedOpenableBox?.id ?? ''}
                    onChange={(e) => setPeriodPettyCashId(e.target.value)}
                  >
                    {openableBoxes.length === 0 && (
                      <option value="">
                        Sin cajas disponibles (cierre el mes activo primero)
                      </option>
                    )}
                    {openableBoxes.map((pc) => (
                      <option key={pc.id} value={pc.id}>
                        {pc.code} ({pc.name} · Tope:{' '}
                        {formatUsdCurrency(Number(pc.authorizedAmount))})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="period-year-month">
                    Mes siguiente válido (YYYY-MM)
                  </label>
                  <input
                    id="period-year-month"
                    className="input"
                    value={periodYearMonth}
                    onChange={(e) => setPeriodYearMonth(e.target.value)}
                    placeholder="2026-12"
                    required
                  />
                </div>
                <div className="field">
                  <label
                    className="field__label"
                    htmlFor="period-replenishment"
                  >
                    Reposición inicial (Máx:{' '}
                    {formatUsdCurrency(maxReplenishmentUsd)})
                  </label>
                  <input
                    id="period-replenishment"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0"
                    max={maxReplenishmentUsd.toFixed(2)}
                    value={periodReplenishment}
                    onChange={(e) => setPeriodReplenishment(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn"
                  disabled={openableBoxes.length === 0}
                >
                  Solicitar apertura mensual
                </button>
              </form>
            </div>
          </section>

          <section className="sheet">
            <div className="sheet__head">
              <div>
                <h2 className="sheet__title">Emitir solicitud de vale</h2>
                <p className="sheet__hint">
                  Solicitud de vale sobre un período abierto, con beneficiario,
                  concepto y monto estimado (RN-CAJA-03).
                </p>
              </div>
            </div>
            <div className="sheet__body">
              <form className="form-grid" onSubmit={handleRequestVoucher}>
                <div className="field">
                  <label className="field__label" htmlFor="voucher-period">
                    Período mensual abierto con saldo
                  </label>
                  <select
                    id="voucher-period"
                    className="select"
                    value={selectedVoucherPeriod?.id ?? ''}
                    onChange={(e) => setVoucherPeriodId(e.target.value)}
                  >
                    {openPeriodsList.length === 0 && (
                      <option value="">
                        Sin períodos abiertos con saldo disponible
                      </option>
                    )}
                    {openPeriodsList.map((per) => (
                      <option key={per.id} value={per.id}>
                        {per.boxCode} - {per.yearMonth} (Disp:{' '}
                        {formatUsdCurrency(Number(per.availableBalance))})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="voucher-code">
                    Código del vale (sistema)
                  </label>
                  <input
                    id="voucher-code"
                    className="input"
                    value="Autogenerado por el sistema"
                    readOnly
                    disabled
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="voucher-beneficiary">
                    Responsable / beneficiario
                  </label>
                  <input
                    id="voucher-beneficiary"
                    className="input"
                    value={voucherBeneficiary}
                    onChange={(e) => setVoucherBeneficiary(e.target.value)}
                    placeholder="TSU. Carlos Pérez"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="voucher-concept">
                    Concepto del gasto menor
                  </label>
                  <input
                    id="voucher-concept"
                    className="input"
                    value={voucherConcept}
                    onChange={(e) => setVoucherConcept(e.target.value)}
                    placeholder="Compra urgente de insumos"
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="voucher-amount">
                    Monto solicitado (Máx:{' '}
                    {formatUsdCurrency(maxVoucherAmountUsd)})
                  </label>
                  <input
                    id="voucher-amount"
                    className="input"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={maxVoucherAmountUsd.toFixed(2)}
                    value={voucherAmount}
                    onChange={(e) => setVoucherAmount(e.target.value)}
                    placeholder="0.00"
                    required
                  />
                </div>
                <button type="submit" className="btn">
                  Solicitar vale
                </button>
              </form>
            </div>
          </section>
        </>
      )}

      {pettyCashes.length === 0 && (
        <div className="empty">
          <strong>Sin cajas chicas registradas</strong>
          Aún no hay cajas chicas. Un generador debe crear una caja por proyecto
          y solicitar la apertura de su período mensual.
        </div>
      )}

      {pettyCashes.map((box) => {
        const availableBalance = box.periods
          .filter((period) => period.status === 'ABIERTO')
          .reduce((sum, period) => sum + Number(period.availableBalance), 0);
        const allVouchers = box.periods.flatMap((period) =>
          (period.vouchers ?? []).map((voucher) => ({
            voucher,
            yearMonth: period.yearMonth,
          })),
        );

        return (
          <section className="sheet" key={box.id}>
            <div className="sheet__head">
              <div>
                <h2 className="sheet__title">
                  {box.code} — {box.name}
                </h2>
                <p className="sheet__hint">
                  Proyecto: {box.project?.code ?? box.projectId}. Tope
                  autorizado: {formatUsdCurrency(Number(box.authorizedAmount))}{' '}
                  (RN-CAJA-01).
                </p>
              </div>
              <div className="btn-group">
                <span className={`badge ${badgeClassForStatus(box.status)}`}>
                  {box.status}
                </span>
                {isReceptor &&
                  box.status === 'ACTIVA' &&
                  (isConfirmationArmed(
                    armedConfirmKey,
                    `CLOSE_BOX:${box.id}`,
                  ) ? (
                    <>
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        onClick={() => handleClosePettyCash(box.id)}
                      >
                        ¿Confirmar cierre definitivo?
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
                      className="btn btn--danger btn--sm"
                      onClick={() => setArmedConfirmKey(`CLOSE_BOX:${box.id}`)}
                    >
                      Cerrar caja chica
                    </button>
                  ))}
              </div>
            </div>

            <div className="sheet__body stack">
              <div className="figure">
                <p className="figure__label">Saldo disponible</p>
                <p className="figure__value num">
                  {formatUsdCurrency(availableBalance)}
                </p>
                <p className="figure__note">
                  Disponible consolidado de los períodos abiertos de la caja
                  (RN-CAJA-02).
                </p>
              </div>

              <div className="subsheet">
                <h3 className="subsheet__title">Períodos mensuales</h3>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Mes</th>
                        <th scope="col" className="num">
                          Arrastre
                        </th>
                        <th scope="col" className="num">
                          Reposición
                        </th>
                        <th scope="col" className="num">
                          Disponible
                        </th>
                        <th scope="col" className="num">
                          Ejecución
                        </th>
                        <th scope="col" className="num">
                          Saldo final
                        </th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {box.periods.length === 0 && (
                        <tr className="table__empty">
                          <td colSpan={8}>
                            Sin períodos mensuales. Solicite la apertura de un
                            período para esta caja.
                          </td>
                        </tr>
                      )}
                      {box.periods.map((per) => {
                        const totalOpening =
                          Number(per.carryoverBalance) +
                          Number(per.initialReplenishment);
                        const usedPercent =
                          calculatePettyCashUtilizationPercent(
                            totalOpening,
                            Number(per.availableBalance),
                          );
                        return (
                          <tr key={per.id}>
                            <td className="nowrap table__strong">
                              {per.yearMonth}
                            </td>
                            <td className="num">
                              {formatUsdCurrency(Number(per.carryoverBalance))}
                            </td>
                            <td className="num">
                              {formatUsdCurrency(
                                Number(per.initialReplenishment),
                              )}
                            </td>
                            <td className="num table__strong">
                              {formatUsdCurrency(Number(per.availableBalance))}
                            </td>
                            <td className="num">{usedPercent}%</td>
                            <td className="num">
                              {per.closingBalance !== null &&
                                per.closingBalance !== undefined
                                ? formatUsdCurrency(Number(per.closingBalance))
                                : '—'}
                            </td>
                            <td>
                              <span
                                className={`badge ${badgeClassForStatus(
                                  per.status,
                                )}`}
                              >
                                {per.status}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group">
                                {isReceptor &&
                                  per.status === 'SOLICITADO' && (
                                    <button
                                      type="button"
                                      className="btn btn--sm"
                                      onClick={() =>
                                        handleApprovePeriod(per.id)
                                      }
                                    >
                                      Aprobar apertura
                                    </button>
                                  )}
                                {isReceptor &&
                                  per.status === 'ABIERTO' &&
                                  (isConfirmationArmed(
                                    armedConfirmKey,
                                    `CLOSE_PERIOD:${per.id}`,
                                  ) ? (
                                    <>
                                      <button
                                        type="button"
                                        className="btn btn--sm"
                                        onClick={() =>
                                          handleClosePeriod(per.id)
                                        }
                                      >
                                        ¿Confirmar cierre mensual?
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
                                        setArmedConfirmKey(
                                          `CLOSE_PERIOD:${per.id}`,
                                        )
                                      }
                                    >
                                      Cerrar mes y arrastre
                                    </button>
                                  ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="subsheet">
                <h3 className="subsheet__title">Vales</h3>
                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Período</th>
                        <th scope="col">Vale</th>
                        <th scope="col">Beneficiario</th>
                        <th scope="col">Concepto</th>
                        <th scope="col" className="num">
                          Solicitado
                        </th>
                        <th scope="col" className="num">
                          Desembolsado
                        </th>
                        <th scope="col" className="num">
                          Rendido
                        </th>
                        <th scope="col">Comprobante</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allVouchers.length === 0 && (
                        <tr className="table__empty">
                          <td colSpan={10}>
                            Sin vales registrados. Emita una solicitud de vale
                            sobre un período abierto.
                          </td>
                        </tr>
                      )}
                      {allVouchers.map(({ voucher: v, yearMonth }) => (
                        <tr key={v.id}>
                          <td className="nowrap">{yearMonth}</td>
                          <td className="nowrap table__strong">{v.code}</td>
                          <td className="table__strong">
                            {v.beneficiaryName}
                          </td>
                          <td>{v.concept}</td>
                          <td className="num">
                            {formatUsdCurrency(Number(v.requestedAmount))}
                          </td>
                          <td className="num">
                            {v.disbursedAmount
                              ? formatUsdCurrency(Number(v.disbursedAmount))
                              : '—'}
                          </td>
                          <td className="num">
                            {v.settledAmount
                              ? `${formatUsdCurrency(
                                Number(v.settledAmount),
                              )} (Vuelto: ${formatUsdCurrency(
                                Number(v.returnedAmount),
                              )})`
                              : '—'}
                          </td>
                          <td>
                            <div>{v.invoiceReference ?? 'Pendiente'}</div>
                            {v.attachmentUrl && (
                              <a
                                href={resolveAttachmentUrl(v.attachmentUrl)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Ver comprobante
                              </a>
                            )}
                            {v.rejectionReason && (
                              <div className="muted">
                                Rechazo: {v.rejectionReason}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`badge ${badgeClassForStatus(
                                v.status,
                              )}`}
                            >
                              {v.status}
                            </span>
                          </td>
                          <td>
                            <div className="btn-group">
                              {isReceptor && v.status === 'SOLICITADO' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => handleApproveVoucher(v.id)}
                                  >
                                    Aprobar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--danger btn--sm"
                                    onClick={() => {
                                      setArmedConfirmKey(null);
                                      setInlineVoucherAction({
                                        type: 'REJECT',
                                        voucherId: v.id,
                                        settledAmount: '',
                                        invoiceReference: '',
                                        reason: '',
                                        maxAllowedAmount: 0,
                                      });
                                    }}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {isReceptor && v.status === 'APROBADO' && (
                                <>
                                  <button
                                    type="button"
                                    className="btn btn--sm"
                                    onClick={() => handleDisburseVoucher(v.id)}
                                  >
                                    Desembolsar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn--danger btn--sm"
                                    onClick={() => {
                                      setArmedConfirmKey(null);
                                      setInlineVoucherAction({
                                        type: 'REJECT',
                                        voucherId: v.id,
                                        settledAmount: '',
                                        invoiceReference: '',
                                        reason: '',
                                        maxAllowedAmount: 0,
                                      });
                                    }}
                                  >
                                    Rechazar
                                  </button>
                                </>
                              )}
                              {isGenerador && v.status === 'DESEMBOLSADO' && (
                                <button
                                  type="button"
                                  className="btn btn--sm"
                                  onClick={() => {
                                    const draft =
                                      getDefaultVoucherSettlementDraft(v);
                                    setArmedConfirmKey(null);
                                    setInlineSettleFile(null);
                                    setInlineVoucherAction({
                                      type: 'SETTLE',
                                      voucherId: v.id,
                                      settledAmount: draft.settledAmount,
                                      invoiceReference: 'FACT-SENIAT-',
                                      reason: '',
                                      maxAllowedAmount: draft.maxAllowedAmount,
                                    });
                                  }}
                                >
                                  Rendir con comprobante
                                </button>
                              )}
                              {((isGenerador &&
                                (v.status === 'SOLICITADO' ||
                                  v.status === 'APROBADO')) ||
                                (isReceptor &&
                                  (v.status === 'DESEMBOLSADO' ||
                                    v.status === 'RENDIDO'))) && (
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() => {
                                    setArmedConfirmKey(null);
                                    setInlineVoucherAction({
                                      type: 'ANNUL',
                                      voucherId: v.id,
                                      settledAmount: '',
                                      invoiceReference: '',
                                      reason: '',
                                      maxAllowedAmount: 0,
                                    });
                                  }}
                                >
                                  Anular
                                </button>
                              )}
                            </div>

                            {inlineVoucherAction?.voucherId === v.id &&
                              inlineVoucherAction.type === 'SETTLE' && (
                                <div className="inline-action-box">
                                  <div className="field">
                                    <label
                                      className="field__label"
                                      htmlFor={`inline-settle-amount-${v.id}`}
                                    >
                                      Monto gastado según factura (Máx:{' '}
                                      {formatUsdCurrency(
                                        inlineVoucherAction.maxAllowedAmount,
                                      )}
                                      )
                                    </label>
                                    <input
                                      id={`inline-settle-amount-${v.id}`}
                                      className="input"
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      max={inlineVoucherAction.maxAllowedAmount.toFixed(
                                        2,
                                      )}
                                      value={inlineVoucherAction.settledAmount}
                                      onChange={(e) =>
                                        setInlineVoucherAction({
                                          ...inlineVoucherAction,
                                          settledAmount: e.target.value,
                                        })
                                      }
                                    />
                                  </div>
                                  <span className="inline-action-box__hint">
                                    Vuelto a retornar a caja:{' '}
                                    {formatUsdCurrency(
                                      Math.max(
                                        0,
                                        inlineVoucherAction.maxAllowedAmount -
                                          Number(
                                            inlineVoucherAction.settledAmount ||
                                              0,
                                          ),
                                      ),
                                    )}
                                  </span>
                                  <div className="field">
                                    <label
                                      className="field__label"
                                      htmlFor={`inline-settle-invoice-${v.id}`}
                                    >
                                      N° factura / comprobante
                                    </label>
                                    <input
                                      id={`inline-settle-invoice-${v.id}`}
                                      className="input"
                                      value={
                                        inlineVoucherAction.invoiceReference
                                      }
                                      onChange={(e) =>
                                        setInlineVoucherAction({
                                          ...inlineVoucherAction,
                                          invoiceReference: e.target.value,
                                        })
                                      }
                                      placeholder="FACT-SENIAT-009841"
                                    />
                                  </div>
                                  <div className="field">
                                    <label
                                      className="field__label"
                                      htmlFor={`inline-settle-file-${v.id}`}
                                    >
                                      Comprobante (PDF/PNG/JPEG)
                                    </label>
                                    <input
                                      id={`inline-settle-file-${v.id}`}
                                      className="input"
                                      type="file"
                                      accept="application/pdf,image/png,image/jpeg"
                                      onChange={(e) =>
                                        setInlineSettleFile(
                                          e.target.files?.[0] ?? null,
                                        )
                                      }
                                    />
                                  </div>
                                  <div className="btn-group">
                                    <button
                                      type="button"
                                      className="btn btn--sm"
                                      onClick={() =>
                                        handleSettleVoucher(
                                          v.id,
                                          inlineVoucherAction.settledAmount,
                                          inlineVoucherAction.invoiceReference,
                                        )
                                      }
                                    >
                                      Confirmar rendición
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => {
                                        setInlineVoucherAction(null);
                                        setInlineSettleFile(null);
                                      }}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              )}

                            {inlineVoucherAction?.voucherId === v.id &&
                              (inlineVoucherAction.type === 'REJECT' ||
                                inlineVoucherAction.type === 'ANNUL') &&
                              (() => {
                                const minLen =
                                  inlineVoucherAction.type === 'REJECT'
                                    ? 5
                                    : 10;
                                const validation = validateInlineJustification(
                                  inlineVoucherAction.reason,
                                  minLen,
                                );
                                return (
                                  <div className="inline-action-box">
                                    <input
                                      className="input"
                                      value={inlineVoucherAction.reason}
                                      onChange={(e) =>
                                        setInlineVoucherAction({
                                          ...inlineVoucherAction,
                                          reason: e.target.value,
                                        })
                                      }
                                      placeholder={
                                        inlineVoucherAction.type === 'REJECT'
                                          ? 'Motivo de rechazo de este vale...'
                                          : 'Motivo de anulación de este vale...'
                                      }
                                    />
                                    <span className="inline-action-box__hint">
                                      {validation.valid
                                        ? 'Motivo válido. Confirme esta acción.'
                                        : `Faltan ${validation.remainingChars} caracteres (mín. ${minLen}).`}
                                    </span>
                                    <div className="btn-group">
                                      <button
                                        type="button"
                                        className="btn btn--danger btn--sm"
                                        disabled={!validation.valid}
                                        onClick={() =>
                                          inlineVoucherAction.type === 'REJECT'
                                            ? handleRejectVoucher(
                                                v.id,
                                                validation.trimmed,
                                              )
                                            : handleAnnulVoucher(
                                                v.id,
                                                validation.trimmed,
                                              )
                                        }
                                      >
                                        {inlineVoucherAction.type === 'REJECT'
                                          ? 'Confirmar rechazo'
                                          : 'Confirmar anulación'}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn--ghost btn--sm"
                                        onClick={() =>
                                          setInlineVoucherAction(null)
                                        }
                                      >
                                        Cancelar
                                      </button>
                                    </div>
                                  </div>
                                );
                              })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}

function badgeClassForStatus(status: string): string {
  switch (status) {
    case 'ACTIVA':
    case 'ABIERTO':
    case 'APROBADO':
    case 'DESEMBOLSADO':
    case 'RENDIDO':
      return 'badge--ok';
    case 'SOLICITADO':
      return 'badge--warn';
    case 'RECHAZADO':
    case 'ANULADO':
      return 'badge--alert';
    default:
      return 'badge--plain';
  }
}
