import { UserRole } from '../types/domain.types';

export interface RolePermissionsMatrix {
  canManageUsersAndParams: boolean;
  canManageProjectsAndAssignments: boolean;
  canApproveAndDeliverFunds: boolean;
  canViewAuditLog: boolean;
}

/**
 * Calcula los permisos de interfaz para un rol dado respetando la matriz RN-SEG-02.
 */
export function getRolePermissions(role: UserRole): RolePermissionsMatrix {
  if (!Object.values(UserRole).includes(role)) {
    throw new Error(`[RN-SEG-02] El rol '${String(role)}' no es válido en el sistema.`);
  }

  return {
    canManageUsersAndParams: role === UserRole.ADMIN,
    canManageProjectsAndAssignments: role === UserRole.GENERADOR,
    canApproveAndDeliverFunds: role === UserRole.RECEPTOR,
    canViewAuditLog: role === UserRole.ADMIN || role === UserRole.RECEPTOR,
  };
}

/**
 * Devuelve la etiqueta descriptiva oficial del rol según el enunciado (RF 2.1).
 */
export function getRoleDisplayLabel(role: UserRole): string {
  switch (role) {
    case UserRole.ADMIN:
      return 'Administrador del Sistema (Sin operaciones de dinero)';
    case UserRole.GENERADOR:
      return 'Generador de Nómina (Coordinador General)';
    case UserRole.RECEPTOR:
      return 'Receptor de Nómina (Gerente de Administración)';
    default:
      throw new Error(`[RN-SEG-02] Rol desconocido: ${String(role)}`);
  }
}
