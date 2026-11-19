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
      <section className="ledger" aria-label="Totales acumulados">
        <div className="ledger__figures">
          <div className="figure">
            <p className="figure__label">Total causado</p>
            <p className="figure__value num">
              {formatUsdCurrency(totalAccruedDisplay)}
            </p>
            <p className="figure__note">
              Suma prorrateada por días activos (RN-CAUS-01 a 03).
            </p>
          </div>
          <div className="figure">
            <p className="figure__label">Total pagado por FIFO</p>
            <p className="figure__value num">
              {formatUsdCurrency(totalPaidDisplay)}
            </p>
            <p className="figure__note">
              Abonos aplicados por antigüedad de la deuda (RN-PAG-02).
            </p>
          </div>
          <div className="figure">
            <p className="figure__label">Deuda pendiente</p>
            <p className="figure__value figure__value--debt num">
              {formatUsdCurrency(totalPendingDisplay)}
            </p>
            <p className="figure__note">
              Obligación neta con el personal de los proyectos.
            </p>
          </div>
        </div>
        <div className="ledger__side">
          <p className="ledger__side-title">Cobertura actual</p>
          <p className="ledger__count">
            <strong className="num">{projects.length}</strong>
            <span>proyectos en catálogo</span>
          </p>
          <p className="ledger__count">
            <strong className="num">{beneficiaries.length}</strong>
            <span>beneficiarios sin usuario</span>
          </p>
          <p className="ledger__count">
            <strong className="num">{accruals.length}</strong>
            <span>causaciones registradas</span>
          </p>
        </div>
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
              className="btn btn--ghost btn--sm"
              onClick={handleDownloadSummaryPdf}
            >
              Descargar estado de cuenta (PDF)
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
