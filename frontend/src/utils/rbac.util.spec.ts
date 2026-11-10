import { describe, expect, it } from 'vitest';
import { UserRole } from '../types/domain.types';
import { getRoleDisplayLabel, getRolePermissions } from './rbac.util';

describe('rbac.util (RN-SEG-02 Matriz de Segregación de Funciones en UI)', () => {
  describe('getRolePermissions', () => {
    it('debe otorgar a ADMIN permiso para gestionar usuarios y ver auditoría, pero bloquear operaciones de nómina/dinero (Happy Path)', () => {
      // Arrange
      const role = UserRole.ADMIN;

      // Act
      const perms = getRolePermissions(role);

      // Assert
      expect(perms.canManageUsersAndParams).toBe(true);
      expect(perms.canViewAuditLog).toBe(true);
      expect(perms.canManageProjectsAndAssignments).toBe(false);
      expect(perms.canApproveAndDeliverFunds).toBe(false);
    });

    it('debe otorgar a GENERADOR gestión de proyectos/asignaciones y a RECEPTOR aprobación/pagos (Edge Case Segregación)', () => {
      // Arrange & Act
      const genPerms = getRolePermissions(UserRole.GENERADOR);
      const recPerms = getRolePermissions(UserRole.RECEPTOR);

      // Assert
      expect(genPerms.canManageProjectsAndAssignments).toBe(true);
      expect(genPerms.canApproveAndDeliverFunds).toBe(false);
      expect(genPerms.canViewAuditLog).toBe(false);

      expect(recPerms.canApproveAndDeliverFunds).toBe(true);
      expect(recPerms.canManageProjectsAndAssignments).toBe(false);
      expect(recPerms.canViewAuditLog).toBe(true);
    });

    it('debe lanzar Error citando [RN-SEG-02] si se suministra un rol inválido (Violación RN-SEG-02)', () => {
      // Arrange
      const invalidRole = 'BENEFICIARIO' as unknown as UserRole;

      // Act & Assert
      expect(() => getRolePermissions(invalidRole)).toThrow('[RN-SEG-02]');
    });
  });

  describe('getRoleDisplayLabel', () => {
    it('debe retornar la descripción oficial para cada uno de los 3 roles (Happy Path)', () => {
      // Arrange & Act & Assert
      expect(getRoleDisplayLabel(UserRole.ADMIN)).toContain(
        'Administrador del Sistema',
      );
      expect(getRoleDisplayLabel(UserRole.GENERADOR)).toContain(
        'Coordinador General',
      );
    });

    it('debe identificar a RECEPTOR como Gerente de Administración (Edge Case)', () => {
      // Arrange & Act
      const label = getRoleDisplayLabel(UserRole.RECEPTOR);

      // Assert
      expect(label).toContain('Gerente de Administración');
    });

    it('debe lanzar Error si el rol no pertenece al enum UserRole (Caso de Error)', () => {
      // Arrange & Act & Assert
      expect(() => getRoleDisplayLabel('OTRO' as unknown as UserRole)).toThrow(
        '[RN-SEG-02]',
      );
    });
  });
});
