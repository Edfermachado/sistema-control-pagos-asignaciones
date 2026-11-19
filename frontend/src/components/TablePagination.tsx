import React from 'react';

export interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (newPage: number) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
}: TablePaginationProps): React.ReactElement | null {
  if (totalItems <= 0) {
    return null;
  }

  return (
    <div className="table-pagination" aria-label="Controles de paginación">
      <div className="table-pagination__info">
        <span>Mostrando</span>
        <strong className="num">{startIndex}</strong>
        <span>–</span>
        <strong className="num">{endIndex}</strong>
        <span>de</span>
        <strong className="num">{totalItems}</strong>
        <span>registros</span>
      </div>

      {totalPages > 1 && (
        <div className="table-pagination__actions">
          <button
            type="button"
            className="table-pagination__btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            aria-label="Página anterior"
          >
            Anterior
          </button>
          {Array.from({ length: totalPages }, (_, idx) => idx + 1)
            .filter(
              (p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1,
            )
            .map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`table-pagination__btn table-pagination__btn--num ${
                  pageNumber === currentPage ? 'table-pagination__btn--active' : ''
                }`}
                onClick={() => onPageChange(pageNumber)}
                aria-current={pageNumber === currentPage ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            ))}
          <button
            type="button"
            className="table-pagination__btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            aria-label="Página siguiente"
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
}
