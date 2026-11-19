import React from 'react';

export interface OccupiedAssignmentRange {
  id: string;
  startDate: string;
  endDate: string;
}

export interface FreeAssignmentSubRange {
  startDate: string;
  endDate: string;
}

interface AssignmentAvailabilityBannerProps {
  occupiedRanges: OccupiedAssignmentRange[];
  freeSubRanges: FreeAssignmentSubRange[];
  hasOverlapConflict: boolean;
  onSelectFreeRange: (startDate: string, endDate: string) => void;
}

export function AssignmentAvailabilityBanner({
  occupiedRanges,
  freeSubRanges,
  hasOverlapConflict,
  onSelectFreeRange,
}: AssignmentAvailabilityBannerProps): React.ReactElement | null {
  if (occupiedRanges.length === 0 && !hasOverlapConflict) {
    return null;
  }

  return (
    <div
      className={`availability-panel ${hasOverlapConflict ? 'availability-panel--conflict' : ''}`}
    >
      <div className="row row--between">
        <strong>
          Disponibilidad del beneficiario en este proyecto (RN-CAT-04)
        </strong>
        {hasOverlapConflict ? (
          <span className="badge badge--alert">
            Traslape detectado en el rango propuesto
          </span>
        ) : (
          <span className="badge badge--ok">
            Rango disponible sin conflictos
          </span>
        )}
      </div>
      <div className="row">
        {occupiedRanges.map((occ) => (
          <span key={occ.id} className="chip">
            Ocupado:{' '}
            <strong>
              {occ.startDate} → {occ.endDate}
            </strong>
          </span>
        ))}
      </div>
      {freeSubRanges.length > 0 ? (
        <div className="btn-group">
          {freeSubRanges.map((free) => (
            <button
              key={`${free.startDate}-${free.endDate}`}
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={() => onSelectFreeRange(free.startDate, free.endDate)}
            >
              Usar tramo libre ({free.startDate} → {free.endDate})
            </button>
          ))}
        </div>
      ) : (
        <p className="inline-action-box__hint">
          El beneficiario ya cubre el 100% de la vigencia activa de este proyecto.
        </p>
      )}
    </div>
  );
}

