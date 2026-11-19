import React from 'react';
import { TableFilterBar } from '../components/TableFilterBar';
import { TablePagination } from '../components/TablePagination';
import { useWorkspace } from '../context/WorkspaceContext';
import { downloadAuthenticatedPdf } from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';

export function ResumenPage(): React.ReactElement {
  const {
    token,
    notify,
    projects,
    beneficiaries,
    accruals,
    summaryProjectFilter,
    setSummaryProjectFilter,
    summarySearchQuery,
    setSummarySearchQuery,
    setSummaryPage,
    totalAccruedDisplay,
    totalPaidDisplay,
    totalPendingDisplay,
    rawBalanceRows,
    filteredBalanceRows,
    paginatedBalanceData,
    summaryPaymentHistory,
  } = useWorkspace();

  const handleDownloadSummaryPdf = async () => {
    if (!token) {
      notify('error', 'Inicie sesión en el sistema para descargar el PDF.');
      return;
    }
    try {
      const path = summaryProjectFilter
        ? `/reports/summary/pdf?projectId=${summaryProjectFilter}`
        : '/reports/summary/pdf';
      const filename = summaryProjectFilter
        ? 'estado_cuenta_proyecto.pdf'
        : 'estado_cuenta_general.pdf';
      await downloadAuthenticatedPdf(path, filename, token);
      notify('success', `Descargando ${filename}...`);
    } catch (err) {
      notify('error', (err as Error).message);
    }
  };

  return (
    <>
      <section className="metrics-grid" aria-label="Métricas de control financiero">
        <article className="card-metric">
          <header className="card-metric__header">
            <span className="card-metric__label">Total Causado (Acumulado)</span>
            <span className="material-symbols-outlined card-metric__icon" aria-hidden="true">
              payments
            </span>
          </header>
          <div className="card-metric__body">
            <p className="card-metric__value num">{formatUsdCurrency(totalAccruedDisplay)}</p>
          </div>
          <div className="card-metric__footer">
            <span className="card-metric__trend card-metric__trend--success">
              <span className="material-symbols-outlined" aria-hidden="true">arrow_upward</span>
              Prorrateado
            </span>
            <span className="card-metric__meta">Días activos (RN-CAUS)</span>
          </div>
        </article>

        <article className="card-metric">
          <header className="card-metric__header">
            <span className="card-metric__label">Total Pagado por FIFO</span>
            <span className="material-symbols-outlined card-metric__icon" aria-hidden="true">
              check_circle
            </span>
          </header>
          <div className="card-metric__body">
            <p className="card-metric__value num">{formatUsdCurrency(totalPaidDisplay)}</p>
          </div>
          <div className="card-metric__footer">
            <span className="card-metric__trend card-metric__trend--success">
              <span className="material-symbols-outlined" aria-hidden="true">check</span>
              Liquidado
            </span>
            <span className="card-metric__meta">Prelación FIFO (RN-PAG-02)</span>
          </div>
        </article>

        <article className="card-metric">
          <header className="card-metric__header">
            <span className="card-metric__label">Deuda Pendiente Neta</span>
            <span className="material-symbols-outlined card-metric__icon" aria-hidden="true">
              pending_actions
            </span>
          </header>
          <div className="card-metric__body">
            <p className="card-metric__value card-metric__value--debt num">
              {formatUsdCurrency(totalPendingDisplay)}
            </p>
          </div>
          <div className="card-metric__footer">
            <span className="card-metric__trend card-metric__trend--pending">
              <span className="material-symbols-outlined" aria-hidden="true">lock_clock</span>
              Saldo exigible
            </span>
            <span className="card-metric__meta">Personal de proyectos</span>
          </div>
        </article>

        <article className="card-metric">
          <header className="card-metric__header">
            <span className="card-metric__label">Cobertura de Proyectos</span>
            <span className="material-symbols-outlined card-metric__icon" aria-hidden="true">
              shield
            </span>
          </header>
          <div className="card-metric__body">
            <p className="card-metric__value num">{projects.length} Proyectos</p>
          </div>
          <div className="card-metric__footer">
            <span className="card-metric__trend card-metric__trend--success">
              <span className="material-symbols-outlined" aria-hidden="true">verified</span>
              Catálogo activo
            </span>
            <span className="card-metric__meta">
              {beneficiaries.length} pers. · {accruals.length} caus.
            </span>
          </div>
        </article>
      </section>

      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Estado de cuenta por beneficiario</h2>
            <p className="sheet__hint">
              Consultas clave del enunciado (RN-AUD-01): causado, pagado y adeudado
              por persona, con antigüedad de la deuda y filtro por proyecto.
            </p>
          </div>
          <div className="ws-tools">
            <div className="field">
              <label className="field__label" htmlFor="project-filter">
                Proyecto
              </label>
              <select
                id="project-filter"
                className="select"
                value={summaryProjectFilter}
                onChange={(e) => {
                  setSummaryProjectFilter(e.target.value);
                  setSummaryPage(1);
                }}
              >
                <option value="">Todos los proyectos</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.code} — {project.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={handleDownloadSummaryPdf}
            >
              <span className="material-symbols-outlined">file_download</span>
              <span>Descargar estado de cuenta (PDF)</span>
            </button>
          </div>
        </div>
        <div className="sheet__body sheet__body--flush">
          <TableFilterBar
            searchPlaceholder="Buscar por cédula o beneficiario..."
            searchQuery={summarySearchQuery}
            onSearchChange={(query) => {
              setSummarySearchQuery(query);
              setSummaryPage(1);
            }}
            resultCount={filteredBalanceRows.length}
            totalCount={rawBalanceRows.length}
            onReset={() => {
              setSummarySearchQuery('');
              setSummaryPage(1);
            }}
          />
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Cédula</th>
                  <th scope="col">Beneficiario</th>
                  <th scope="col" className="num">
                    Causado (USD)
                  </th>
                  <th scope="col" className="num">
                    Pagado FIFO (USD)
                  </th>
                  <th scope="col" className="num">
                    Saldo adeudado (USD)
                  </th>
                  <th scope="col">Antigüedad de deuda</th>
                </tr>
              </thead>
              <tbody>
                {paginatedBalanceData.items.length === 0 && (
                  <tr className="table__empty">
                    <td colSpan={6}>
                      {rawBalanceRows.length === 0
                        ? 'Sin causaciones registradas para el filtro actual. Genere un lote de causación en el espacio 3.'
                        : 'No se encontraron beneficiarios que coincidan con la búsqueda.'}
                    </td>
                  </tr>
                )}
                {paginatedBalanceData.items.map((row) => (
                  <tr key={row.beneficiaryId}>
                    <td className="nowrap">{row.beneficiaryDni}</td>
                    <td className="table__strong">{row.beneficiaryName}</td>
                    <td className="num">
                      {formatUsdCurrency(Number(row.totalAccruedUsd))}
                    </td>
                    <td className="num">
                      {formatUsdCurrency(Number(row.totalPaidUsd))}
                    </td>
                    <td className="num table__strong">
                      {formatUsdCurrency(Number(row.totalDebtDueUsd))}
                    </td>
                    <td className="nowrap">
                      {Number(row.totalDebtDueUsd) > 0 && row.oldestUnpaidPeriodStart
                        ? `Desde ${row.oldestUnpaidPeriodStart} (${
                            row.pendingAccrualsCount ?? 1
                          } per.)`
                        : 'Al día (sin deuda)'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            currentPage={paginatedBalanceData.currentPage}
            totalPages={paginatedBalanceData.totalPages}
            totalItems={paginatedBalanceData.totalItems}
            startIndex={paginatedBalanceData.startIndex}
            endIndex={paginatedBalanceData.endIndex}
            onPageChange={setSummaryPage}
          />
        </div>
      </section>

      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">
              Historial de pagos ejecutados (RN-AUD-01)
            </h2>
            <p className="sheet__hint">
              Consulta consolidada de pagos emitidos (cuándo, a quién, por qué
              proyecto y monto en USD), disponible en solo lectura para todos los
              roles autorizados.
            </p>
          </div>
        </div>
        <div className="sheet__body sheet__body--flush">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Recibo</th>
                  <th scope="col">Beneficiario</th>
                  <th scope="col">Proyecto / Solicitud</th>
                  <th scope="col" className="num">
                    Monto (USD)
                  </th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {summaryPaymentHistory.length === 0 && (
                  <tr className="table__empty">
                    <td colSpan={6}>
                      Sin pagos registrados para el filtro seleccionado.
                    </td>
                  </tr>
                )}
                {summaryPaymentHistory.map((pay) => (
                  <tr key={pay.id}>
                    <td className="nowrap">{pay.paymentDate}</td>
                    <td className="nowrap table__strong">{pay.receiptCode}</td>
                    <td>
                      <span className="table__strong">
                        {pay.beneficiaryName}
                      </span>{' '}
                      <span className="muted">({pay.beneficiaryDni})</span>
                    </td>
                    <td className="nowrap">
                      {pay.projectCode} · {pay.requestCode}
                    </td>
                    <td className="num table__strong">
                      {formatUsdCurrency(Number(pay.amountUsd))}
                    </td>
                    <td>
                      <span
                        className={`badge ${pay.status === 'VALIDO' ? 'badge--ok' : 'badge--alert'}`}
                      >
                        {pay.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </>
  );
}
