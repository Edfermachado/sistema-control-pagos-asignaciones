/**
 * Utilidades puras para filtrado, búsqueda y paginación en tablas del frontend.
 * Cumple con CC-01 (cero any, tipado estricto) y CC-02 (funciones puras deterministas).
 */

export interface PaginationResult<T> {
  items: T[];
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  startIndex: number;
  endIndex: number;
}

export type FieldResolver<T> =
  | keyof T
  | ((item: T) => string | number | null | undefined);

/**
 * Filtra una lista de elementos buscando coincidencias de texto insensible a mayúsculas/minúsculas
 * sobre uno o varios campos especificados.
 */
export function searchTableItems<T>(
  items: readonly T[],
  query: string,
  fieldResolvers: readonly FieldResolver<T>[],
): T[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [...items];
  }

  return items.filter((item) => {
    return fieldResolvers.some((resolver) => {
      let value: unknown;
      if (typeof resolver === 'function') {
        value = resolver(item);
      } else {
        value = item[resolver];
      }

      if (value === null || value === undefined) {
        return false;
      }

      return String(value).toLowerCase().includes(normalizedQuery);
    });
  });
}

/**
 * Filtra elementos por el valor de una propiedad específica.
 * Si el valor es vacío (''), undefined o 'ALL', devuelve todos los elementos.
 */
export function filterTableByProperty<T, K extends keyof T>(
  items: readonly T[],
  property: K,
  filterValue?: T[K] | '' | 'ALL',
): T[] {
  if (filterValue === undefined || filterValue === '' || filterValue === 'ALL') {
    return [...items];
  }

  return items.filter((item) => item[property] === filterValue);
}

/**
 * Pagina una lista de elementos calculando páginas totales y límites de índice seguros.
 */
export function paginateTableItems<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): PaginationResult<T> {
  const totalItems = items.length;
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(totalItems / safePageSize));
  const currentPage = Math.min(Math.max(1, Math.floor(page)), totalPages);

  const startIndex = (currentPage - 1) * safePageSize;
  const endIndex = Math.min(startIndex + safePageSize, totalItems);
  const pagedItems = items.slice(startIndex, endIndex);

  return {
    items: pagedItems,
    currentPage,
    totalPages,
    totalItems,
    pageSize: safePageSize,
    startIndex: totalItems > 0 ? startIndex + 1 : 0,
    endIndex,
  };
}
