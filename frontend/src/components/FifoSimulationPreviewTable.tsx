import React from 'react';
import { AccrualStatus } from '../types/domain.types';
import { formatUsdCurrency } from '../utils/currency.util';

export interface FifoSimulationStepView {
  accrualId: string;
  periodStart: string;
  periodEnd: string;
  previousBalanceUsd: number;
  allocatedUsd: number;
  newBalanceUsd: number;
  resultingStatus: AccrualStatus;
}

export interface FifoSimulationPreviewData {
  isValidAmount: boolean;
  remainingDebtAfterPaymentUsd: number;
  steps: FifoSimulationStepView[];
}

function getAccrualStatusBadgeClass(status: AccrualStatus): string {
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

interface FifoSimulationPreviewTableProps {
  preview: FifoSimulationPreviewData;
}

export function FifoSimulationPreviewTable({
  preview,
}: FifoSimulationPreviewTableProps): React.ReactElement | null {
  if (preview.steps.length === 0) {
    return null;
  }

  return (
    <div className="subsheet">
      <div className="row row--between">
        <h3 className="subsheet__title">
          Previsualización de imputación FIFO en tiempo real (RN-PAG-02)
        </h3>
        <span
          className={`badge ${preview.isValidAmount ? 'badge--ok' : 'badge--alert'}`}
        >
          {preview.isValidAmount
            ? `Deuda restante tras abono: ${formatUsdCurrency(preview.remainingDebtAfterPaymentUsd)}`
            : 'Monto inválido o superior al saldo pendiente'}
        </span>
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th scope="col">Período (FIFO)</th>
              <th scope="col" className="num">
                Deuda actual
              </th>
              <th scope="col" className="num">
                Abono proyectado
              </th>
              <th scope="col" className="num">
                Saldo final
              </th>
              <th scope="col">Estado resultante</th>
            </tr>
          </thead>
          <tbody>
            {preview.steps.map((step) => (
              <tr key={step.accrualId}>
                <td className="nowrap">
                  {step.periodStart || '—'} al {step.periodEnd || '—'}
                </td>
                <td className="num">
                  {formatUsdCurrency(step.previousBalanceUsd)}
                </td>
                <td className="num table__strong">
                  {formatUsdCurrency(step.allocatedUsd)}
                </td>
                <td className="num">
                  {formatUsdCurrency(step.newBalanceUsd)}
                </td>
                <td>
                  <span className={getAccrualStatusBadgeClass(step.resultingStatus)}>
                    {step.resultingStatus}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

