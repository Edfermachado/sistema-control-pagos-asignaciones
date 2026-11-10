import React, { useState } from 'react';
import {
  AuditLogEntry,
  CatalogAssignment,
  CatalogBeneficiary,
  CatalogProject,
  Periodicity,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from './types/domain.types';
import { formatUsdCurrency } from './utils/currency.util';
import { getRoleDisplayLabel, getRolePermissions } from './utils/rbac.util';

const INITIAL_PROJECTS: CatalogProject[] = [
  {
    id: 'p-1',
    code: 'FIS-2026-01',
    name: 'Espectroscopía Láser y Óptica Cuántica',
    area: ProjectArea.FISICA,
    scope: ProjectScope.INTERNO,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: ProjectStatus.ACTIVO,
  },
  {
    id: 'p-2',
    code: 'QUI-2026-02',
    name: 'Síntesis de Catalizadores Orgánicos',
    area: ProjectArea.QUIMICA,
    scope: ProjectScope.EXTERNO,
    startDate: '2026-02-01',
    endDate: '2026-11-30',
    status: ProjectStatus.ACTIVO,
  },
  {
    id: 'p-3',
    code: 'BIO-2026-03',
    name: 'Genómica de Microorganismos Tropicales',
    area: ProjectArea.BIOLOGIA,
    scope: ProjectScope.INTERNO,
    startDate: '2026-03-01',
    endDate: '2026-12-31',
    status: ProjectStatus.ACTIVO,
  },
];

const INITIAL_BENEFICIARIES: CatalogBeneficiary[] = [
  {
    id: 'b-1',
    dni: 'V-18456789',
    fullName: 'Dr. Alejandro Mendoza (Investigador Física)',
    email: 'amendoza@uc.edu.ve',
    bankInfo: 'Zelle / Cuenta Custodia USD #4401',
    isActive: true,
  },
  {
    id: 'b-2',
    dni: 'V-22987654',
    fullName: 'MSc. Valeria Salazar (Investigadora Química/Biología)',
    email: 'vsalazar@uc.edu.ve',
    bankInfo: 'Zelle / Efectivo Taquilla #1108',
    isActive: true,
  },
];

const INITIAL_ASSIGNMENTS: CatalogAssignment[] = [
  {
    id: 'a-1',
    beneficiaryName: 'Dr. Alejandro Mendoza',
    beneficiaryDni: 'V-18456789',
    projectCode: 'FIS-2026-01',
    projectArea: ProjectArea.FISICA,
    paymentGroupName: 'Quincenal Investigadores',
    periodicity: Periodicity.QUINCENAL,
    amountPerPeriod: 450.0,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  },
  {
    id: 'a-2',
    beneficiaryName: 'MSc. Valeria Salazar',
    beneficiaryDni: 'V-22987654',
    projectCode: 'QUI-2026-02',
    projectArea: ProjectArea.QUIMICA,
    paymentGroupName: 'Mensual Laboratorios',
    periodicity: Periodicity.MENSUAL,
    amountPerPeriod: 780.0,
    startDate: '2026-02-01',
    endDate: '2026-11-30',
  },
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-101',
    userRole: UserRole.ADMIN,
    action: 'CREATE_PAYMENT_GROUP',
    tableName: 'payment_groups',
    recordId: 'pg-quincenal',
    timestamp: '2026-11-09 16:00:00 UTC',
    summary: 'Creación de grupo Quincenal Investigadores (Cortes 15 y último)',
  },
  {
    id: 'log-102',
    userRole: UserRole.GENERADOR,
    action: 'CREATE_ASSIGNMENT',
    tableName: 'assignments',
    recordId: 'a-1',
    timestamp: '2026-11-09 17:15:00 UTC',
    summary: 'Asignación V-18456789 en FIS-2026-01 por $450.00 USD / Quincenal',
  },
];

export function App(): React.ReactElement {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.GENERADOR);
  const [areaFilter, setAreaFilter] = useState<string>('ALL');
  const permissions = getRolePermissions(activeRole);

  const visibleProjects =
    areaFilter === 'ALL'
      ? INITIAL_PROJECTS
      : INITIAL_PROJECTS.filter((p) => p.area === areaFilter);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: '1100px', margin: '0 auto', color: '#0f172a' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
            Sistema de Control de Pagos y Asignaciones (USD)
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
            Etapa 1: Gestión de Catálogos, Segregación de Roles (RN-SEG-02) y Auditoría (RN-AUD-03)
          </p>
        </div>

        <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
          <label htmlFor="role-select" style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '0.25rem' }}>
            Rol Activo en Sesión (RBAC):
          </label>
          <select
            id="role-select"
            value={activeRole}
            onChange={(e) => setActiveRole(e.target.value as UserRole)}
            style={{ padding: '0.4rem', borderRadius: '0.25rem', border: '1px solid #94a3b8', fontWeight: 600 }}
          >
            <option value={UserRole.ADMIN}>ADMIN (Administrador)</option>
            <option value={UserRole.GENERADOR}>GENERADOR (Coordinador)</option>
            <option value={UserRole.RECEPTOR}>RECEPTOR (Gerencia)</option>
          </select>
          <div style={{ fontSize: '0.78rem', color: '#334155', marginTop: '0.25rem' }}>
            {getRoleDisplayLabel(activeRole)}
          </div>
        </div>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: permissions.canManageUsersAndParams ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1' }}>
          <strong>Gestión Usuarios y Grupos Pago:</strong> {permissions.canManageUsersAndParams ? 'Habilitado (ADMIN)' : 'Solo lectura / Bloqueado'}
        </div>
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: permissions.canManageProjectsAndAssignments ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1' }}>
          <strong>Proyectos, Beneficiarios y Asignaciones:</strong> {permissions.canManageProjectsAndAssignments ? 'CRUD Activo (GENERADOR)' : 'Modo Consulta'}
        </div>
        <div style={{ padding: '0.75rem', borderRadius: '0.5rem', backgroundColor: permissions.canApproveAndDeliverFunds ? '#dcfce7' : '#f1f5f9', border: '1px solid #cbd5e1' }}>
          <strong>Aprobación y Pagos FIFO:</strong> {permissions.canApproveAndDeliverFunds ? 'Autorizado (RECEPTOR)' : 'Bloqueado (RN-SEG-02)'}
        </div>
      </section>

      <section style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>Catálogo de Proyectos Científicos (RN-CAT-01)</h2>
          <select value={areaFilter} onChange={(e) => setAreaFilter(e.target.value)} style={{ padding: '0.35rem' }}>
            <option value="ALL">Todas las Áreas (Física, Química, Biología)</option>
            <option value={ProjectArea.FISICA}>Física</option>
            <option value={ProjectArea.QUIMICA}>Química</option>
            <option value={ProjectArea.BIOLOGIA}>Biología</option>
          </select>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '0.5rem' }}>Código</th>
              <th style={{ padding: '0.5rem' }}>Proyecto</th>
              <th style={{ padding: '0.5rem' }}>Área</th>
              <th style={{ padding: '0.5rem' }}>Ámbito</th>
              <th style={{ padding: '0.5rem' }}>Vigencia</th>
              <th style={{ padding: '0.5rem' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visibleProjects.map((p) => (
              <tr key={p.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem', fontWeight: 600 }}>{p.code}</td>
                <td style={{ padding: '0.5rem' }}>{p.name}</td>
                <td style={{ padding: '0.5rem' }}>{p.area}</td>
                <td style={{ padding: '0.5rem' }}>{p.scope}</td>
                <td style={{ padding: '0.5rem' }}>{p.startDate} a {p.endDate}</td>
                <td style={{ padding: '0.5rem' }}>{p.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 0.75rem', fontSize: '1.15rem' }}>
          Asignaciones Activas: Persona × Proyecto × Grupo de Pago (RN-CAT-04 / RN-SEG-01)
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#475569' }}>
          Nota RN-SEG-01: Los {INITIAL_BENEFICIARIES.length} beneficiarios registrados cobran asignaciones en USD pero NO poseen usuario en el sistema.
        </p>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
              <th style={{ padding: '0.5rem' }}>Beneficiario (Sin Usuario)</th>
              <th style={{ padding: '0.5rem' }}>Proyecto</th>
              <th style={{ padding: '0.5rem' }}>Grupo de Pago</th>
              <th style={{ padding: '0.5rem' }}>Monto por Período (USD)</th>
            </tr>
          </thead>
          <tbody>
            {INITIAL_ASSIGNMENTS.map((a) => (
              <tr key={a.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '0.5rem' }}>{a.beneficiaryName} ({a.beneficiaryDni})</td>
                <td style={{ padding: '0.5rem' }}>{a.projectCode} ({a.projectArea})</td>
                <td style={{ padding: '0.5rem' }}>{a.paymentGroupName} ({a.periodicity})</td>
                <td style={{ padding: '0.5rem', fontWeight: 700, color: '#047857' }}>
                  {formatUsdCurrency(a.amountPerPeriod)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {permissions.canViewAuditLog && (
        <section style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem', borderRadius: '0.5rem' }}>
          <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.05rem', color: '#38bdf8' }}>
            Bitácora de Auditoría Inmutable — audit_log (RN-AUD-03)
          </h2>
          {INITIAL_AUDIT_LOGS.map((log) => (
            <div key={log.id} style={{ fontSize: '0.85rem', padding: '0.4rem 0', borderBottom: '1px solid #334155' }}>
              <strong>[{log.timestamp}]</strong> Rol: <code>{log.userRole}</code> · Acción: <code>{log.action}</code> ({log.tableName}) — {log.summary}
            </div>
          ))}
        </section>
      )}
    </main>
  );
}
