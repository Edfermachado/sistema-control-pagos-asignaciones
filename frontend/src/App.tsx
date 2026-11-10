import React, { useCallback, useEffect, useState } from 'react';
import {
  CatalogsAndAssignmentsWorkspace,
  LiveAssignment,
  LiveBeneficiary,
  LivePaymentGroup,
  LiveProject,
} from './components/CatalogsAndAssignmentsWorkspace';
import {
  FinancialEnginePanel,
  LiveAccrual,
  LivePayment,
  LivePaymentRequest,
} from './components/FinancialEnginePanel';
import {
  LivePettyCash,
  PettyCashAndReportsPanel,
} from './components/PettyCashAndReportsPanel';
import {
  LiveAuditRecord,
  LiveUser,
  UsersAndAuditWorkspace,
} from './components/UsersAndAuditWorkspace';
import {
  AccrualStatus,
  Periodicity,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from './types/domain.types';
import { apiRequest } from './utils/api-client.util';
import { formatUsdCurrency } from './utils/currency.util';
import { getRoleDisplayLabel } from './utils/rbac.util';

type WorkspaceTab =
  | 'RESUMEN'
  | 'CATALOGOS'
  | 'MOTOR_FINANCIERO'
  | 'CAJA_CHICA'
  | 'AUDITORIA';

interface ExecutiveSummaryData {
  totalAccruedUsd: string;
  totalPaidUsd: string;
  totalPendingUsd: string;
  beneficiaryCount: number;
  debtsByBeneficiary: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    dni: string;
    totalAccrued: string;
    totalPaid: string;
    pendingBalance: string;
  }>;
}

const DEMO_ROLE_CREDENTIALS: Record<
  UserRole,
  { email: string; password: string; label: string }
> = {
  [UserRole.ADMIN]: {
    email: 'admin@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'ADMIN (admin@uc.edu.ve)',
  },
  [UserRole.GENERADOR]: {
    email: 'coordinador@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'GENERADOR - Coordinador (coordinador@uc.edu.ve)',
  },
  [UserRole.RECEPTOR]: {
    email: 'gerente@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'RECEPTOR - Gerencia (gerente@uc.edu.ve)',
  },
};

const FALLBACK_PROJECTS: LiveProject[] = [
  {
    id: 'p-1',
    code: 'PROY-FIS-2026-01',
    name: 'Espectroscopía Láser de Materiales Cuánticos',
    area: ProjectArea.FISICA,
    scope: ProjectScope.INTERNO,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    budget: '25000.00',
    status: ProjectStatus.ACTIVO,
  },
  {
    id: 'p-2',
    code: 'PROY-QUI-2026-02',
    name: 'Síntesis de Catalizadores Verdes para Polímeros',
    area: ProjectArea.QUIMICA,
    scope: ProjectScope.EXTERNO,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    budget: '40000.00',
    status: ProjectStatus.ACTIVO,
  },
  {
    id: 'p-3',
    code: 'PROY-BIO-2026-03',
    name: 'Biodiversidad Microbiana en Suelos Agrícolas',
    area: ProjectArea.BIOLOGIA,
    scope: ProjectScope.INTERNO,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    budget: '15000.00',
    status: ProjectStatus.ACTIVO,
  },
];

const FALLBACK_PAYMENT_GROUPS: LivePaymentGroup[] = [
  {
    id: 'pg-1',
    name: 'Nómina Quincenal Investigadores',
    periodicity: Periodicity.QUINCENAL,
    description: 'Pagos cada 15/16 días calendario',
    isActive: true,
  },
  {
    id: 'pg-2',
    name: 'Nómina Mensual Coordinadores Técnicos',
    periodicity: Periodicity.MENSUAL,
    description: 'Pagos al cierre de cada mes',
    isActive: true,
  },
];

const FALLBACK_BENEFICIARIES: LiveBeneficiary[] = [
  {
    id: 'b-1',
    dni: 'V-15234567',
    fullName: 'Dr. Alejandro Rivas',
    roleTitle: 'Investigador Principal Física',
    email: 'arivas@uc.edu.ve',
    bankReference: 'Zelle / Cuenta USD #4401',
    isActive: true,
  },
  {
    id: 'b-2',
    dni: 'V-19876543',
    fullName: 'Dra. Sofía Méndez',
    roleTitle: 'Investigadora Asociada Química',
    email: 'smendez@uc.edu.ve',
    bankReference: 'Zelle / Efectivo Taquilla #1108',
    isActive: true,
  },
];

const FALLBACK_ACCRUALS: LiveAccrual[] = [
  {
    id: 'acc-1',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-15',
    activeDays: 15,
    totalPeriodDays: 15,
    proratedAmount: '600.00',
    paidAmount: '450.00',
    balanceDue: '150.00',
    status: AccrualStatus.PARCIAL,
    beneficiaryId: 'b-1',
    projectId: 'p-1',
    beneficiary: { fullName: 'Dr. Alejandro Rivas', dni: 'V-15234567' },
    project: { code: 'PROY-FIS-2026-01', name: 'Espectroscopía Láser' },
  },
  {
    id: 'acc-2',
    periodStart: '2026-01-01',
    periodEnd: '2026-01-15',
    activeDays: 6,
    totalPeriodDays: 15,
    proratedAmount: '180.00',
    paidAmount: '0.00',
    balanceDue: '180.00',
    status: AccrualStatus.PENDIENTE,
    beneficiaryId: 'b-2',
    projectId: 'p-1',
    beneficiary: { fullName: 'Dra. Sofía Méndez', dni: 'V-19876543' },
    project: { code: 'PROY-FIS-2026-01', name: 'Espectroscopía Láser' },
  },
];

export function App(): React.ReactElement {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.GENERADOR);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('RESUMEN');
  const [token, setToken] = useState<string | null>(null);
  const [isConnectedToApi, setIsConnectedToApi] = useState<boolean>(false);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(
    DEMO_ROLE_CREDENTIALS[UserRole.GENERADOR].email,
  );

  // Login manual expandible
  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomLogin, setShowCustomLogin] = useState(false);

  // Notificación global
  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Estado de datos en vivo
  const [projects, setProjects] = useState<LiveProject[]>(FALLBACK_PROJECTS);
  const [paymentGroups, setPaymentGroups] = useState<LivePaymentGroup[]>(
    FALLBACK_PAYMENT_GROUPS,
  );
  const [beneficiaries, setBeneficiaries] = useState<LiveBeneficiary[]>(
    FALLBACK_BENEFICIARIES,
  );
  const [assignments, setAssignments] = useState<LiveAssignment[]>([]);
  const [accruals, setAccruals] = useState<LiveAccrual[]>(FALLBACK_ACCRUALS);
  const [paymentRequests, setPaymentRequests] = useState<LivePaymentRequest[]>(
    [],
  );
  const [payments, setPayments] = useState<LivePayment[]>([]);
  const [pettyCashes, setPettyCashes] = useState<LivePettyCash[]>([]);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [auditLogs, setAuditLogs] = useState<LiveAuditRecord[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [summaryProjectFilter, setSummaryProjectFilter] = useState<string>('');

  const handleNotify = useCallback(
    (type: 'success' | 'error', message: string) => {
      setNotification({ type, message });
    },
    [],
  );

  const loadWorkspaceData = useCallback(
    async (authToken: string, role: UserRole) => {
      try {
        const [projRes, pgRes, benRes, asigRes] = await Promise.all([
          apiRequest<LiveProject[]>('/projects', { token: authToken }),
          apiRequest<LivePaymentGroup[]>('/payment-groups', {
            token: authToken,
          }),
          apiRequest<LiveBeneficiary[]>('/beneficiaries', { token: authToken }),
          apiRequest<LiveAssignment[]>('/assignments', { token: authToken }),
        ]);
        setProjects(projRes);
        setPaymentGroups(pgRes);
        setBeneficiaries(benRes);
        setAssignments(asigRes);

        if (role === UserRole.GENERADOR || role === UserRole.RECEPTOR) {
          const [accRes, reqRes, payRes, pcRes, sumRes] = await Promise.all([
            apiRequest<LiveAccrual[]>('/accruals', { token: authToken }),
            apiRequest<LivePaymentRequest[]>('/payment-requests', {
              token: authToken,
            }),
            apiRequest<LivePayment[]>('/payments', { token: authToken }),
            apiRequest<LivePettyCash[]>('/petty-cashes', { token: authToken }),
            apiRequest<ExecutiveSummaryData>(
              summaryProjectFilter
                ? `/reports/summary?projectId=${summaryProjectFilter}`
                : '/reports/summary',
              { token: authToken },
            ),
          ]);
          setAccruals(accRes);
          setPaymentRequests(reqRes);
          setPayments(payRes);
          setPettyCashes(pcRes);
          setSummary(sumRes);
        }

        if (role === UserRole.ADMIN) {
          const usersRes = await apiRequest<LiveUser[]>('/users', {
            token: authToken,
          });
          setUsers(usersRes);
        }

        if (role === UserRole.ADMIN || role === UserRole.RECEPTOR) {
          const logsRes = await apiRequest<LiveAuditRecord[]>('/audit-logs', {
            token: authToken,
          });
          setAuditLogs(logsRes);
        }
      } catch {
        // Mantiene datos previos si algún endpoint está restringido al rol
      }
    },
    [summaryProjectFilter],
  );

  const loginWithCredentials = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await apiRequest<{
          accessToken: string;
          user: { id: string; email: string; fullName: string; role: UserRole };
        }>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        setToken(res.accessToken);
        setActiveRole(res.user.role);
        setCurrentUserEmail(res.user.email);
        setIsConnectedToApi(true);
        await loadWorkspaceData(res.accessToken, res.user.role);
      } catch {
        setIsConnectedToApi(false);
      }
    },
    [loadWorkspaceData],
  );

  useEffect(() => {
    const creds = DEMO_ROLE_CREDENTIALS[activeRole];
    void loginWithCredentials(creds.email, creds.password);
  }, [activeRole, loginWithCredentials]);

  const handleRoleSwitch = (newRole: UserRole) => {
    setActiveRole(newRole);
    setNotification(null);
    if (newRole === UserRole.ADMIN && activeTab === 'MOTOR_FINANCIERO') {
      setActiveTab('AUDITORIA');
    }
  };

  const handleCustomLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiRequest<{
        accessToken: string;
        user: { id: string; email: string; fullName: string; role: UserRole };
      }>('/auth/login', {
        method: 'POST',
        body: { email: customEmail, password: customPassword },
      });
      setToken(res.accessToken);
      setActiveRole(res.user.role);
      setCurrentUserEmail(res.user.email);
      setIsConnectedToApi(true);
      setShowCustomLogin(false);
      handleNotify(
        'success',
        `Sesión iniciada como ${res.user.fullName} (${res.user.role}).`,
      );
      await loadWorkspaceData(res.accessToken, res.user.role);
    } catch (err) {
      handleNotify('error', (err as Error).message);
    }
  };

  const refreshData = async () => {
    if (token) {
      await loadWorkspaceData(token, activeRole);
    }
  };

  const totalAccruedDisplay = summary
    ? Number(summary.totalAccruedUsd)
    : accruals.reduce((acc, r) => acc + Number(r.proratedAmount), 0);
  const totalPaidDisplay = summary
    ? Number(summary.totalPaidUsd)
    : accruals.reduce((acc, r) => acc + Number(r.paidAmount), 0);
  const totalPendingDisplay = summary
    ? Number(summary.totalPendingUsd)
    : accruals.reduce((acc, r) => acc + Number(r.balanceDue), 0);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', color: '#0f172a' }}>
      {/* BARRA SUPERIOR INSTITUCIONAL FACYT - UC */}
      <header style={{ backgroundColor: '#0f172a', color: '#f8fafc', padding: '1rem 1.5rem', borderBottom: '3px solid #38bdf8' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: '0.76rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#38bdf8', fontWeight: 700 }}>
              Universidad de Carabobo · Facultad Experimental de Ciencias y Tecnología (FACYT)
            </div>
            <h1 style={{ margin: '0.2rem 0 0', fontSize: '1.35rem' }}>
              Sistema de Control de Pagos y Asignaciones (USD)
            </h1>
            <div style={{ marginTop: '0.3rem', display: 'flex', gap: '0.6rem', alignItems: 'center', fontSize: '0.8rem' }}>
              <span
                style={{
                  padding: '0.15rem 0.55rem',
                  borderRadius: '999px',
                  fontWeight: 700,
                  backgroundColor: isConnectedToApi ? '#065f46' : '#92400e',
                  color: '#ffffff',
                }}
              >
                {isConnectedToApi
                  ? '🟢 Conectado en Vivo a API + PostgreSQL'
                  : '🟡 Modo Previsualización Local'}
              </span>
              <span style={{ color: '#cbd5e1' }}>
                Usuario: <strong>{currentUserEmail}</strong> ·{' '}
                {getRoleDisplayLabel(activeRole)}
              </span>
            </div>
          </div>

          {/* SELECTOR RÁPIDO DE ROL RBAC + LOGIN MANUAL */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <label htmlFor="role-select" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#cbd5e1' }}>
                Cambiar Rol (Login JWT Automático):
              </label>
              <select
                id="role-select"
                value={activeRole}
                onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
                style={{
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.35rem',
                  border: '1px solid #38bdf8',
                  backgroundColor: '#1e293b',
                  color: '#f8fafc',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                }}
              >
                <option value={UserRole.GENERADOR}>
                  GENERADOR — Coordinador (coordinador@uc.edu.ve)
                </option>
                <option value={UserRole.RECEPTOR}>
                  RECEPTOR — Gerencia (gerente@uc.edu.ve)
                </option>
                <option value={UserRole.ADMIN}>
                  ADMIN — Administrador (admin@uc.edu.ve)
                </option>
              </select>
              <button
                type="button"
                onClick={() => setShowCustomLogin(!showCustomLogin)}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.35rem',
                  border: '1px solid #64748b',
                  backgroundColor: '#334155',
                  color: '#f8fafc',
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                🔑 Login Manual
              </button>
              <button
                type="button"
                onClick={refreshData}
                style={{
                  padding: '0.4rem 0.65rem',
                  borderRadius: '0.35rem',
                  border: 'none',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                }}
              >
                🔄 Actualizar
              </button>
            </div>
          </div>
        </div>

        {showCustomLogin && (
          <form
            onSubmit={handleCustomLoginSubmit}
            style={{
              maxWidth: '1240px',
              margin: '0.85rem auto 0',
              padding: '0.75rem',
              backgroundColor: '#1e293b',
              borderRadius: '0.4rem',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>
              Autenticación JWT contra /api/auth/login:
            </strong>
            <input
              type="email"
              value={customEmail}
              onChange={(e) => setCustomEmail(e.target.value)}
              placeholder="Correo (ej. coordinador@uc.edu.ve)"
              required
              style={{ padding: '0.38rem 0.6rem', borderRadius: '0.3rem', border: '1px solid #64748b' }}
            />
            <input
              type="password"
              value={customPassword}
              onChange={(e) => setCustomPassword(e.target.value)}
              placeholder="Contraseña (PasswordUC2026!)"
              required
              style={{ padding: '0.38rem 0.6rem', borderRadius: '0.3rem', border: '1px solid #64748b' }}
            />
            <button
              type="submit"
              style={{
                padding: '0.4rem 0.8rem',
                borderRadius: '0.3rem',
                border: 'none',
                backgroundColor: '#10b981',
                color: '#ffffff',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Iniciar Sesión
            </button>
          </form>
        )}
      </header>

      {/* PESTAÑAS DE NAVEGACIÓN PRINCIPAL */}
      <nav style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #cbd5e1', padding: '0 1.5rem' }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          <TabButton
            active={activeTab === 'RESUMEN'}
            onClick={() => setActiveTab('RESUMEN')}
            label="📊 1. Dashboard Ejecutivo y Deudas"
          />
          <TabButton
            active={activeTab === 'CATALOGOS'}
            onClick={() => setActiveTab('CATALOGOS')}
            label="🗂️ 2. Catálogos, Beneficiarios y Asignaciones"
          />
          {activeRole !== UserRole.ADMIN && (
            <TabButton
              active={activeTab === 'MOTOR_FINANCIERO'}
              onClick={() => setActiveTab('MOTOR_FINANCIERO')}
              label="⚙️ 3. Causación Prorrateada, Solicitudes y Pagos FIFO"
            />
          )}
          {activeRole !== UserRole.ADMIN && (
            <TabButton
              active={activeTab === 'CAJA_CHICA'}
              onClick={() => setActiveTab('CAJA_CHICA')}
              label="💵 4. Control de Cajas Chicas y Arrastre Mensual"
            />
          )}
          <TabButton
            active={activeTab === 'AUDITORIA'}
            onClick={() => setActiveTab('AUDITORIA')}
            label="🛡️ 5. Usuarios y Bitácora Forense (audit_log)"
          />
        </div>
      </nav>

      {/* CONTENIDO PRINCIPAL */}
      <main style={{ maxWidth: '1240px', margin: '0 auto', padding: '1.5rem' }}>
        {notification && (
          <div
            style={{
              marginBottom: '1.2rem',
              padding: '0.8rem 1rem',
              borderRadius: '0.45rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor:
                notification.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: notification.type === 'success' ? '#065f46' : '#991b1b',
              border: `1px solid ${notification.type === 'success' ? '#86efac' : '#fca5a5'}`,
              fontWeight: 600,
              fontSize: '0.88rem',
            }}
          >
            <span>
              {notification.type === 'success' ? '✅ ' : '⚠️ '}
              {notification.message}
            </span>
            <button
              type="button"
              onClick={() => setNotification(null)}
              style={{
                background: 'transparent',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                color: 'inherit',
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* PESTAÑA 1: DASHBOARD EJECUTIVO Y CONSULTAS CLAVE */}
        {activeTab === 'RESUMEN' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              <KpiCard
                title="Total Causado Acumulado (USD)"
                value={formatUsdCurrency(totalAccruedDisplay)}
                subtitle="Suma prorrateada por días activos (RN-CAUS-01)"
                bgHex="#ffffff"
                accentHex="#1e3a8a"
              />
              <KpiCard
                title="Total Pagado Vía FIFO (USD)"
                value={formatUsdCurrency(totalPaidDisplay)}
                subtitle="Saldado por orden de antigüedad (RN-PAG-02)"
                bgHex="#f0fdf4"
                accentHex="#047857"
              />
              <KpiCard
                title="Deuda Total Pendiente (USD)"
                value={formatUsdCurrency(totalPendingDisplay)}
                subtitle="Obligación neta con investigadores"
                bgHex="#fef2f2"
                accentHex="#b91c1c"
              />
              <KpiCard
                title="Proyectos y Beneficiarios"
                value={`${projects.length} Proyectos / ${beneficiaries.length} Benef.`}
                subtitle="Física, Química y Biología FACYT"
                bgHex="#ffffff"
                accentHex="#0f172a"
              />
            </div>

            <section style={{ backgroundColor: '#ffffff', padding: '1.15rem', borderRadius: '0.5rem', border: '1px solid #cbd5e1' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.08rem' }}>
                    Consultas Clave del Enunciado: Estado de Cuenta por Persona (RN-AUD-01)
                  </h2>
                  <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#475569' }}>
                    Responde en vivo: ¿Cuánto se ha causado? ¿Cuánto se ha pagado? ¿Cuánto se le adeuda a cada beneficiario?
                  </p>
                </div>
                <select
                  value={summaryProjectFilter}
                  onChange={(e) => setSummaryProjectFilter(e.target.value)}
                  style={{ padding: '0.4rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #94a3b8', fontSize: '0.84rem' }}
                >
                  <option value="">Todos los Proyectos Científicos</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.name} ({p.area})
                    </option>
                  ))}
                </select>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', textAlign: 'left', borderBottom: '2px solid #cbd5e1' }}>
                    <th style={{ padding: '0.55rem' }}>Cédula</th>
                    <th style={{ padding: '0.55rem' }}>Beneficiario (Sin Usuario — RN-SEG-01)</th>
                    <th style={{ padding: '0.55rem' }}>Total Causado (USD)</th>
                    <th style={{ padding: '0.55rem' }}>Total Pagado FIFO (USD)</th>
                    <th style={{ padding: '0.55rem' }}>Saldo Adeudado (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary?.debtsByBeneficiary ?? []).map((row) => (
                    <tr key={row.beneficiaryId} style={{ borderBottom: '1px solid #e2e8f0' }}>
                      <td style={{ padding: '0.55rem', fontWeight: 600 }}>{row.dni}</td>
                      <td style={{ padding: '0.55rem', fontWeight: 600 }}>{row.beneficiaryName}</td>
                      <td style={{ padding: '0.55rem' }}>
                        {formatUsdCurrency(Number(row.totalAccrued))}
                      </td>
                      <td style={{ padding: '0.55rem', color: '#047857', fontWeight: 600 }}>
                        {formatUsdCurrency(Number(row.totalPaid))}
                      </td>
                      <td
                        style={{
                          padding: '0.55rem',
                          color: Number(row.pendingBalance) > 0 ? '#b91c1c' : '#64748b',
                          fontWeight: 700,
                        }}
                      >
                        {formatUsdCurrency(Number(row.pendingBalance))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )}

        {/* PESTAÑA 2: CATÁLOGOS Y ASIGNACIONES */}
        {activeTab === 'CATALOGOS' && (
          <CatalogsAndAssignmentsWorkspace
            token={token}
            activeRole={activeRole}
            projects={projects}
            paymentGroups={paymentGroups}
            beneficiaries={beneficiaries}
            assignments={assignments}
            onRefresh={refreshData}
            onNotify={handleNotify}
          />
        )}

        {/* PESTAÑA 3: MOTOR FINANCIERO (CAUSACIÓN, SOLICITUDES, FIFO Y ANULACIONES) */}
        {activeTab === 'MOTOR_FINANCIERO' && (
          <FinancialEnginePanel
            token={token}
            activeRole={activeRole}
            projects={projects}
            paymentGroups={paymentGroups}
            beneficiaries={beneficiaries}
            accruals={accruals}
            paymentRequests={paymentRequests}
            payments={payments}
            onRefresh={refreshData}
            onNotify={handleNotify}
          />
        )}

        {/* PESTAÑA 4: CAJAS CHICAS Y ARRASTRE MENSUAL */}
        {activeTab === 'CAJA_CHICA' && (
          <PettyCashAndReportsPanel
            token={token}
            activeRole={activeRole}
            projects={projects}
            pettyCashes={pettyCashes}
            onRefresh={refreshData}
            onNotify={handleNotify}
          />
        )}

        {/* PESTAÑA 5: USUARIOS Y BITÁCORA FORENSE AUDIT_LOG */}
        {activeTab === 'AUDITORIA' && (
          <UsersAndAuditWorkspace
            token={token}
            activeRole={activeRole}
            users={users}
            auditLogs={auditLogs}
            onRefresh={refreshData}
            onNotify={handleNotify}
          />
        )}
      </main>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '0.85rem 1rem',
        border: 'none',
        borderBottom: active ? '3px solid #1e3a8a' : '3px solid transparent',
        backgroundColor: active ? '#eff6ff' : 'transparent',
        color: active ? '#1e3a8a' : '#475569',
        fontWeight: active ? 700 : 600,
        fontSize: '0.86rem',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  bgHex,
  accentHex,
}: {
  title: string;
  value: string;
  subtitle: string;
  bgHex: string;
  accentHex: string;
}): React.ReactElement {
  return (
    <div
      style={{
        backgroundColor: bgHex,
        padding: '1rem',
        borderRadius: '0.5rem',
        border: '1px solid #cbd5e1',
        borderLeft: `4px solid ${accentHex}`,
      }}
    >
      <div style={{ fontSize: '0.78rem', color: '#475569', fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: '1.35rem', fontWeight: 800, color: accentHex, margin: '0.25rem 0' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{subtitle}</div>
    </div>
  );
}
