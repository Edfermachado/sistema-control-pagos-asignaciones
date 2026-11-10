export enum UserRole {
  ADMIN = 'ADMIN',
  GENERADOR = 'GENERADOR',
  RECEPTOR = 'RECEPTOR',
}

export enum ProjectArea {
  FISICA = 'FISICA',
  QUIMICA = 'QUIMICA',
  BIOLOGIA = 'BIOLOGIA',
}

export enum ProjectScope {
  INTERNO = 'INTERNO',
  EXTERNO = 'EXTERNO',
}

export enum ProjectStatus {
  ACTIVO = 'ACTIVO',
  SUSPENDIDO = 'SUSPENDIDO',
  FINALIZADO = 'FINALIZADO',
  INACTIVO = 'INACTIVO',
  CERRADO = 'CERRADO',
}

export enum Periodicity {
  SEMANAL = 'SEMANAL',
  QUINCENAL = 'QUINCENAL',
  MENSUAL = 'MENSUAL',
}

export enum AccrualStatus {
  PENDIENTE = 'PENDIENTE',
  PARCIAL = 'PARCIAL',
  PAGADO = 'PAGADO',
  ANULADO = 'ANULADO',
}

export enum PaymentRequestStatus {
  CREADA = 'CREADA',
  ENVIADA = 'ENVIADA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
  ENTREGADA = 'ENTREGADA',
  CERRADA = 'CERRADA',
  ANULADA = 'ANULADA',
}

export interface CatalogProject {
  id: string;
  code: string;
  name: string;
  area: ProjectArea;
  scope: ProjectScope;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
}

export interface CatalogBeneficiary {
  id: string;
  dni: string;
  fullName: string;
  email: string;
  bankInfo: string;
  isActive: boolean;
}

export interface CatalogAssignment {
  id: string;
  beneficiaryName: string;
  beneficiaryDni: string;
  projectCode: string;
  projectArea: ProjectArea;
  paymentGroupName: string;
  periodicity: Periodicity;
  amountPerPeriod: number;
  startDate: string;
  endDate: string;
}

export interface AccrualLedgerRow {
  id: string;
  periodLabel: string;
  beneficiaryName: string;
  projectCode: string;
  activeDays: number;
  totalPeriodDays: number;
  proratedAmount: number;
  paidAmount: number;
  balanceDue: number;
  status: AccrualStatus;
}

export interface AuditLogEntry {
  id: string;
  userRole: UserRole;
  action: string;
  tableName: string;
  recordId: string;
  timestamp: string;
  summary: string;
}
