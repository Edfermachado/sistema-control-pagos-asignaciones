import { describe, expect, it } from 'vitest';
import {
  filterTableByProperty,
  paginateTableItems,
  searchTableItems,
} from './table-filter.util';

interface TestItem {
  id: string;
  name: string;
  dni: string;
  status: 'ACTIVO' | 'INACTIVO';
  metadata?: { tag: string };
}

describe('table-filter.util', () => {
  const sampleItems: TestItem[] = [
    { id: '1', name: 'Albert Einstein', dni: 'V-10001', status: 'ACTIVO', metadata: { tag: 'Fisica' } },
    { id: '2', name: 'Marie Curie', dni: 'V-10002', status: 'ACTIVO', metadata: { tag: 'Quimica' } },
    { id: '3', name: 'Charles Darwin', dni: 'V-10003', status: 'INACTIVO', metadata: { tag: 'Biologia' } },
    { id: '4', name: 'Isaac Newton', dni: 'V-10004', status: 'ACTIVO', metadata: { tag: 'Fisica' } },
    { id: '5', name: 'Rosalind Franklin', dni: 'V-10005', status: 'INACTIVO', metadata: { tag: 'Quimica' } },
  ];

  describe('searchTableItems', () => {
    it('debe devolver todos los elementos si el término de búsqueda está vacío (Happy Path vacío)', () => {
      // Arrange
      const query = '   ';

      // Act
      const result = searchTableItems(sampleItems, query, ['name', 'dni']);

      // Assert
      expect(result).toHaveLength(5);
      expect(result).toEqual(sampleItems);
    });

    it('debe filtrar elementos por coincidencia de texto insensible a mayúsculas/minúsculas (Happy Path)', () => {
      // Arrange
      const query = 'curie';

      // Act
      const result = searchTableItems(sampleItems, query, ['name', 'dni']);

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('Marie Curie');
    });

    it('debe buscar coincidencias por función extractora personalizada (Edge Case)', () => {
      // Arrange
      const query = 'quimica';

      // Act
      const result = searchTableItems(sampleItems, query, [
        (item) => item.metadata?.tag,
      ]);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.map((r) => r.name)).toEqual(['Marie Curie', 'Rosalind Franklin']);
    });

    it('debe retornar un arreglo vacío si ningún elemento coincide con la búsqueda', () => {
      // Arrange
      const query = 'Galileo';

      // Act
      const result = searchTableItems(sampleItems, query, ['name', 'dni']);

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe('filterTableByProperty', () => {
    it('debe filtrar correctamente por propiedad específica (Happy Path)', () => {
      // Arrange
      const filter = 'INACTIVO';

      // Act
      const result = filterTableByProperty(sampleItems, 'status', filter);

      // Assert
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.status === 'INACTIVO')).toBe(true);
    });

    it('debe devolver todos los elementos si el valor de filtro es vacío, undefined o ALL (Edge Case)', () => {
      // Act & Assert
      expect(filterTableByProperty(sampleItems, 'status', '')).toHaveLength(5);
      expect(filterTableByProperty(sampleItems, 'status', undefined)).toHaveLength(5);
      expect(filterTableByProperty(sampleItems, 'status', 'ALL')).toHaveLength(5);
    });
  });

  describe('paginateTableItems', () => {
    it('debe paginar correctamente la primera página (Happy Path)', () => {
      // Arrange
      const page = 1;
      const pageSize = 2;

      // Act
      const result = paginateTableItems(sampleItems, page, pageSize);

      // Assert
      expect(result.items).toHaveLength(2);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(3);
      expect(result.totalItems).toBe(5);
      expect(result.startIndex).toBe(1);
      expect(result.endIndex).toBe(2);
      expect(result.items[0].id).toBe('1');
      expect(result.items[1].id).toBe('2');
    });

    it('debe limitar la página actual si se solicita un número mayor a las páginas totales (Edge Case)', () => {
      // Arrange
      const page = 99;
      const pageSize = 2;

      // Act
      const result = paginateTableItems(sampleItems, page, pageSize);

      // Assert
      expect(result.currentPage).toBe(3);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('5');
      expect(result.startIndex).toBe(5);
      expect(result.endIndex).toBe(5);
    });

    it('debe manejar listas vacías de forma segura (Edge Case)', () => {
      // Arrange
      const emptyItems: TestItem[] = [];

      // Act
      const result = paginateTableItems(emptyItems, 1, 10);

      // Assert
      expect(result.items).toHaveLength(0);
      expect(result.currentPage).toBe(1);
      expect(result.totalPages).toBe(1);
      expect(result.totalItems).toBe(0);
      expect(result.startIndex).toBe(0);
      expect(result.endIndex).toBe(0);
    });
  });
});
