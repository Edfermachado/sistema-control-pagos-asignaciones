import { UserRole } from '../types/domain.types';

/**
 * Definición única de las rutas de la aplicación.
 * Fuente de verdad para el riel de navegación, los títulos de área y los permisos por ruta
 * (RN-SEG-02: la ruta debe rechazar al rol, no solo ocultar el botón).
 */
export type WorkspaceKey =
  | 'RESUMEN'
  | 'CATALOGOS'
  | 'MOTOR_FINANCIERO'
  | 'CAJA_CHICA'
  | 'AUDITORIA';

export interface WorkspaceDefinition {
  key: WorkspaceKey;
  path: string;
  index: string;
  icon: string;
  navLabel: string;
  title: string;
  lead: string;
  allowedRoles: UserRole[];
}

export const LOGIN_PATH = '/login';
export const HOME_PATH = '/resumen';

export const WORKSPACES: WorkspaceDefinition[] = [
  {
    key: 'RESUMEN',
    path: HOME_PATH,
    index: '1',
    icon: 'dashboard',
    navLabel: 'Resumen y deudas',
    title: 'Resumen ejecutivo y deudas por beneficiario',
    lead: 'Cuánto se ha causado, cuánto se ha pagado por prelación FIFO y cuánto se le adeuda a cada persona, por proyecto científico.',
    allowedRoles: [UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR],
  },
  {
    key: 'CATALOGOS',
    path: '/catalogos',
    index: '2',
    icon: 'folder_shared',
    navLabel: 'Catálogos y asignaciones',
    title: 'Catálogos, beneficiarios y asignaciones',
    lead: 'Proyectos con área, ámbito y vigencia; grupos de pago con fechas de corte; personas que cobran, sin usuario en el sistema (RN-SEG-01).',
    allowedRoles: [UserRole.ADMIN, UserRole.GENERADOR, UserRole.RECEPTOR],
  },
  {
    key: 'MOTOR_FINANCIERO',
    path: '/causacion',
    index: '3',
    icon: 'payments',
    navLabel: 'Causación y pagos',
    title: 'Causación prorrateada, solicitudes y pagos FIFO',
    lead: 'Generación por lote, ciclo de la solicitud, entrega de fondos con prelación por antigüedad y corrección por anulación justificada.',
    allowedRoles: [UserRole.GENERADOR, UserRole.RECEPTOR],
  },
  {
    key: 'CAJA_CHICA',
    path: '/cajas-chicas',
    index: '4',
    icon: 'account_balance_wallet',
    navLabel: 'Cajas chicas',
    title: 'Cajas chicas por proyecto y arrastre mensual',
    lead: 'Apertura mensual, vales con aprobación separada del desembolso, rendición con comprobante y arrastre del saldo al mes siguiente.',
    allowedRoles: [UserRole.GENERADOR, UserRole.RECEPTOR],
  },
  {
    key: 'AUDITORIA',
    path: '/auditoria',
    index: '5',
    icon: 'policy',
    navLabel: 'Usuarios y auditoría',
    title: 'Usuarios, parámetros y bitácora forense',
    lead: 'Cuentas de los tres roles, parámetros globales del sistema y visor de audit_log con los cambios reales de la base de datos.',
    allowedRoles: [UserRole.ADMIN, UserRole.RECEPTOR],
  },
];

/** Busca la definición de ruta por su path exacto. */
export function findWorkspaceByPath(pathname: string): WorkspaceDefinition | undefined {
  return WORKSPACES.find((workspace) => workspace.path === pathname);
}

/** Indica si el rol puede abrir la ruta (RN-SEG-02). */
export function canAccessWorkspace(
  workspace: WorkspaceDefinition,
  role: UserRole,
): boolean {
  return workspace.allowedRoles.includes(role);
}

/** Espacios visibles en el riel para el rol activo. */
export function visibleWorkspaces(role: UserRole): WorkspaceDefinition[] {
  return WORKSPACES.filter((workspace) => canAccessWorkspace(workspace, role));
}

/** Primera ruta permitida: destino de redirección cuando el rol no puede entrar. */
export function firstAllowedPath(role: UserRole): string {
  const [first] = visibleWorkspaces(role);
  return first ? first.path : LOGIN_PATH;
}

/** Ruta de un espacio por su clave. */
export function pathForWorkspace(key: WorkspaceKey): string {
  const workspace = WORKSPACES.find((candidate) => candidate.key === key);
  return workspace ? workspace.path : HOME_PATH;
}
