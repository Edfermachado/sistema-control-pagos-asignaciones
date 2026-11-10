import React, { useState } from 'react';
import { FinancialEnginePanel } from './components/FinancialEnginePanel';
import { PettyCashAndReportsPanel } from './components/PettyCashAndReportsPanel';
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
    paymentGroupName: 'Quincenal Laboratorios',
    periodicity: Periodicity.QUINCENAL,
    amountPerPeriod: 450.0,
    startDate: '2026-11-11',
    endDate: '2026-11-30',
  },
];

const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-101',
    userRole: UserRole.GENERADOR,
    action: 'GENERATE_ACCRUAL_BATCH',
    tableName: 'accrual_batches',
    recordId: 'LOTE-FIS-10',
    timestamp: '2026-11-09 18:10:00 UTC',
    summary: 'Lote causado por proyecto FIS-2026-01 con prorrateo exacto en USD',
  },
  {
    id: 'log-102',
    userRole: UserRole.RECEPTOR,
    action: 'REGISTER_FIFO_PAYMENT',
    tableName: 'payments',
    recordId: 'REC-2026-001',
    timestamp: '2026-11-09 19:30:00 UTC',
    summary: 'Pago parcial $600.00 aplicado vía FIFO: $450 a Q1 (PAGADO) y $150 a Q2 (PARCIAL)',
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
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '1.5rem', maxWidth: '1120px', margin: '0 auto', color: '#0f172a' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #cbd5e1', paddingBottom: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem' }}>
            Sistema de Control de Pagos y Asignaciones (USD)
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#475569', fontSize: '0.9rem' }}>
            Etapa 2 Completada: Catálogos, Prorrateo Exacto, Solicitudes, Pagos FIFO e Inmutabilidad
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

      <FinancialEnginePanel />
      <PettyCashAndReportsPanel />

      <section style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.15rem' }}>
            Catálogo de Proyectos ({INITIAL_BENEFICIARIES.length} Beneficiarios sin Usuario - RN-SEG-01)
          </h2>
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
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section style={{ marginBottom: '1.5rem', backgroundColor: '#ffffff', padding: '1rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>Asignaciones Base en USD (RN-CAT-04)</h2>
        {INITIAL_ASSIGNMENTS.map((a) => (
          <div key={a.id} style={{ padding: '0.45rem 0', borderBottom: '1px solid #f1f5f9', fontSize: '0.88rem' }}>
            <strong>{a.beneficiaryName}</strong> ({a.beneficiaryDni}) → Proyecto <code>{a.projectCode}</code> · {a.paymentGroupName} · <strong>{formatUsdCurrency(a.amountPerPeriod)}</strong> ({a.startDate} a {a.endDate})
          </div>
        ))}
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
