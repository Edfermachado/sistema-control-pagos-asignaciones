import React from 'react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface TableFilterBarProps {
  searchPlaceholder?: string;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  filterLabel?: string;
  filterValue?: string;
  filterOptions?: FilterOption[];
  onFilterChange?: (value: string) => void;
  resultCount?: number;
  totalCount?: number;
  onReset?: () => void;
}

export function TableFilterBar({
  searchPlaceholder = 'Buscar...',
  searchQuery,
  onSearchChange,
  filterLabel,
  filterValue,
  filterOptions,
  onFilterChange,
  resultCount,
  totalCount,
  onReset,
}: TableFilterBarProps): React.ReactElement {
  const isFiltered = Boolean(
    searchQuery.trim() ||
      (filterValue && filterValue !== '' && filterValue !== 'ALL'),
  );

  return (
    <div className="table-toolbar" role="search" aria-label="Filtros de tabla">
      <div className="table-toolbar__group">
        <input
          type="search"
          className="input table-toolbar__search"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          aria-label={searchPlaceholder}
        />

        {filterOptions && onFilterChange && (
          <label className="field field--inline table-toolbar__filter">
            {filterLabel && <span className="field__label">{filterLabel}</span>}
            <select
              className="select"
              value={filterValue || 'ALL'}
              onChange={(e) => onFilterChange(e.target.value)}
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {isFiltered && onReset && (
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            onClick={onReset}
            title="Restablecer filtros"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {resultCount !== undefined && totalCount !== undefined && (
        <span className="table-toolbar__count">
          {resultCount} de {totalCount} resultado{totalCount === 1 ? '' : 's'}
        </span>
      )}
    </div>
  );
}
