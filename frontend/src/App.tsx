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
  LiveAccrualBatch,
  LivePayment,
  LivePaymentRequest,
} from './components/FinancialEnginePanel';
import {
  LivePettyCash,
  PettyCashAndReportsPanel,
} from './components/PettyCashAndReportsPanel';
import {
  LiveAuditRecord,
  LiveSystemParameter,
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
  totalPendingDebtUsd: string;
  beneficiaryBalances: Array<{
    beneficiaryId: string;
    beneficiaryName: string;
    beneficiaryDni: string;
    totalAccruedUsd: string;
    totalPaidUsd: string;
    totalDebtDueUsd: string;
  }>;
}

interface WorkspaceMeta {
  index: string;
  label: string;
  title: string;
  lead: string;
}

const WORKSPACE_META: Record<WorkspaceTab, WorkspaceMeta> = {
  RESUMEN: {
    index: '1',
    label: 'Resumen y deudas',
    title: 'Resumen ejecutivo y deudas por beneficiario',
    lead:
      'Cuánto se ha causado, cuánto se ha pagado por prelación FIFO y cuánto se le adeuda a cada persona, por proyecto científico.',
  },
  CATALOGOS: {
    index: '2',
    label: 'Catálogos y asignaciones',
    title: 'Catálogos, beneficiarios y asignaciones',
    lead:
      'Proyectos con área, ámbito y vigencia; grupos de pago con fechas de corte; personas que cobran, sin usuario en el sistema (RN-SEG-01).',
  },
  MOTOR_FINANCIERO: {
    index: '3',
    label: 'Causación y pagos',
    title: 'Causación prorrateada, solicitudes y pagos FIFO',
    lead:
      'Generación por lote, ciclo de la solicitud, entrega de fondos con prelación por antigüedad y corrección por anulación justificada.',
  },
  CAJA_CHICA: {
    index: '4',
    label: 'Cajas chicas',
    title: 'Cajas chicas por proyecto y arrastre mensual',
    lead:
      'Apertura mensual, vales con aprobación separada del desembolso, rendición con comprobante y arrastre del saldo al mes siguiente.',
  },
  AUDITORIA: {
    index: '5',
    label: 'Usuarios y auditoría',
    title: 'Usuarios, parámetros y bitácora forense',
    lead:
      'Cuentas de los tres roles, parámetros globales del sistema y visor de audit_log con los cambios reales de la base de datos.',
  },
};

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

const TAB_ORDER: WorkspaceTab[] = [
  'RESUMEN',
  'CATALOGOS',
  'MOTOR_FINANCIERO',
  'CAJA_CHICA',
  'AUDITORIA',
];

const FALLBACK_PROJECTS: LiveProject[] = [
  {
    id: 'p-1',
    code: 'PROY-FIS-2026-01',
    name: 'Espectroscopía Láser de Materiales Cuánticos',
    area: ProjectArea.FISICA,
    scope: ProjectScope.INTERNO,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
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
    status: ProjectStatus.ACTIVO,
  },
];

const FALLBACK_PAYMENT_GROUPS: LivePaymentGroup[] = [
  {
    id: 'pg-1',
    name: 'Nómina Quincenal Investigadores',
    periodicity: Periodicity.QUINCENAL,
    cutoffRules: 'Pagos cada 15/16 días calendario',
    isActive: true,
  },
  {
    id: 'pg-2',
    name: 'Nómina Mensual Coordinadores Técnicos',
    periodicity: Periodicity.MENSUAL,
    cutoffRules: 'Pagos al cierre de cada mes',
    isActive: true,
  },
];

const FALLBACK_BENEFICIARIES: LiveBeneficiary[] = [
  {
    id: 'b-1',
    dni: 'V-15234567',
    fullName: 'Dr. Alejandro Rivas',
    email: 'arivas@uc.edu.ve',
    bankInfo: 'Zelle / Cuenta USD #4401',
    isActive: true,
  },
  {
    id: 'b-2',
    dni: 'V-19876543',
    fullName: 'Dra. Sofía Méndez',
    email: 'smendez@uc.edu.ve',
    bankInfo: 'Zelle / Efectivo Taquilla #1108',
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

  const [customEmail, setCustomEmail] = useState('');
  const [customPassword, setCustomPassword] = useState('');
  const [showCustomLogin, setShowCustomLogin] = useState(false);

  const [notification, setNotification] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [projects, setProjects] = useState<LiveProject[]>(FALLBACK_PROJECTS);
  const [paymentGroups, setPaymentGroups] = useState<LivePaymentGroup[]>(
    FALLBACK_PAYMENT_GROUPS,
  );
  const [beneficiaries, setBeneficiaries] = useState<LiveBeneficiary[]>(
    FALLBACK_BENEFICIARIES,
  );
  const [assignments, setAssignments] = useState<LiveAssignment[]>([]);
  const [accruals, setAccruals] = useState<LiveAccrual[]>(FALLBACK_ACCRUALS);
  const [accrualBatches, setAccrualBatches] = useState<LiveAccrualBatch[]>([]);
  const [paymentRequests, setPaymentRequests] = useState<LivePaymentRequest[]>(
    [],
  );
  const [payments, setPayments] = useState<LivePayment[]>([]);
  const [pettyCashes, setPettyCashes] = useState<LivePettyCash[]>([]);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [parameters, setParameters] = useState<LiveSystemParameter[]>([]);
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
        const [projRes, pgRes, benRes] = await Promise.all([
          apiRequest<LiveProject[]>('/projects', { token: authToken }),
          apiRequest<LivePaymentGroup[]>('/payment-groups', {
            token: authToken,
          }),
          apiRequest<LiveBeneficiary[]>('/beneficiaries', { token: authToken }),
        ]);
        setProjects(projRes);
        setPaymentGroups(pgRes);
        setBeneficiaries(benRes);

        // RN-SEG-02: ADMIN no gestiona ni consulta asignaciones.
        if (role === UserRole.ADMIN) {
          setAssignments([]);
        } else {
          const asigRes = await apiRequest<LiveAssignment[]>('/assignments', {
            token: authToken,
          });
          setAssignments(asigRes);
        }

        if (role === UserRole.GENERADOR || role === UserRole.RECEPTOR) {
          const [accRes, batchRes, reqRes, payRes, pcRes, sumRes] =
            await Promise.all([
              apiRequest<LiveAccrual[]>('/accruals', { token: authToken }),
              apiRequest<LiveAccrualBatch[]>('/accruals/batches', {
                token: authToken,
              }),
              apiRequest<LivePaymentRequest[]>('/payment-requests', {
                token: authToken,
              }),
              apiRequest<LivePayment[]>('/payments', { token: authToken }),
              apiRequest<LivePettyCash[]>('/petty-cashes', {
                token: authToken,
              }),
              apiRequest<ExecutiveSummaryData>(
                summaryProjectFilter
                  ? `/reports/summary?projectId=${summaryProjectFilter}`
                  : '/reports/summary',
                { token: authToken },
              ),
            ]);
          setAccruals(accRes);
          setAccrualBatches(batchRes);
          setPaymentRequests(reqRes);
          setPayments(payRes);
          setPettyCashes(pcRes);
          setSummary(sumRes);
        }

        if (role === UserRole.ADMIN) {
          const [usersRes, parametersRes] = await Promise.all([
            apiRequest<LiveUser[]>('/users', { token: authToken }),
            apiRequest<LiveSystemParameter[]>('/parameters', {
              token: authToken,
            }),
          ]);
          setUsers(usersRes);
          setParameters(parametersRes);
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
    // RN-SEG-02: al cambiar de rol, el espacio activo debe seguir siendo válido para ese rol.
    const allowedTabs: WorkspaceTab[] =
      newRole === UserRole.ADMIN
        ? ['RESUMEN', 'CATALOGOS', 'AUDITORIA']
        : TAB_ORDER;
    if (!allowedTabs.includes(activeTab)) {
      setActiveTab('RESUMEN');
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
    ? Number(summary.totalPendingDebtUsd)
    : accruals.reduce((acc, r) => acc + Number(r.balanceDue), 0);

  const visibleTabs = TAB_ORDER.filter(
    (tab) =>
      activeRole !== UserRole.ADMIN ||
      (tab !== 'MOTOR_FINANCIERO' && tab !== 'CAJA_CHICA'),
  );
  const meta = WORKSPACE_META[activeTab];
  const balanceRows = summary?.beneficiaryBalances ?? [];

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <p className="brand__org">
            Universidad de Carabobo
            <br />
            FACYT · Ciencias y Tecnología
          </p>
          <p className="brand__name">Control de Pagos</p>
          <p className="brand__sub">
            Asignaciones en USD · Sistemas de Información
          </p>
        </div>

        <nav className="nav" aria-label="Espacios de trabajo">
          <p className="nav__label">Espacios de trabajo</p>
          {visibleTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              className="nav__item"
              aria-current={activeTab === tab ? 'page' : undefined}
              onClick={() => setActiveTab(tab)}
            >
              <span className="nav__index" aria-hidden="true">
                {WORKSPACE_META[tab].index}
              </span>
              <span>{WORKSPACE_META[tab].label}</span>
            </button>
          ))}
        </nav>

        <div className="rail__foot">
          <div>
            <div className="rail__foot-label">Sesión activa</div>
            <div className="rail__session">{currentUserEmail}</div>
            <div>{getRoleDisplayLabel(activeRole)}</div>
          </div>
          <div>
            <div className="rail__foot-label">Normas del dominio</div>
            <div>RN-CAUS · RN-PAG · RN-CAJA · RN-AUD</div>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="ws-head">
          <div>
            <h1 className="ws-title">{meta.title}</h1>
            <p className="ws-lead">{meta.lead}</p>
          </div>

          <div className="ws-tools">
            <span
              className={`badge ${
                isConnectedToApi ? 'badge--ok' : 'badge--warn'
              }`}
              title={
                isConnectedToApi
                  ? 'Sesión JWT activa contra la API y PostgreSQL'
                  : 'Sin respuesta de la API: se muestran datos de demostración'
              }
            >
              {isConnectedToApi ? 'API conectada' : 'Sin conexión a la API'}
            </span>
            <label className="field field--inline" htmlFor="role-select">
              <span className="field__label">Rol</span>
              <select
                id="role-select"
                className="select"
                value={activeRole}
                onChange={(e) => handleRoleSwitch(e.target.value as UserRole)}
              >
                <option value={UserRole.GENERADOR}>
                  GENERADOR — Coordinador
                </option>
                <option value={UserRole.RECEPTOR}>RECEPTOR — Gerencia</option>
                <option value={UserRole.ADMIN}>ADMIN — Administrador</option>
              </select>
            </label>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={() => setShowCustomLogin((current) => !current)}
                aria-expanded={showCustomLogin}
              >
                {showCustomLogin ? 'Ocultar login' : 'Login manual'}
              </button>
              <button
                type="button"
                className="btn btn--sm"
                onClick={refreshData}
              >
                Actualizar datos
              </button>
            </div>
          </div>

          {showCustomLogin && (
            <form
              className="form-row ws-login"
              onSubmit={handleCustomLoginSubmit}
            >
              <div className="field">
                <label className="field__label" htmlFor="custom-email">
                  Correo institucional
                </label>
                <input
                  id="custom-email"
                  className="input"
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  placeholder="coordinador@uc.edu.ve"
                  autoComplete="username"
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="custom-password">
                  Contraseña
                </label>
                <input
                  id="custom-password"
                  className="input"
                  type="password"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="PasswordUC2026!"
                  autoComplete="current-password"
                  required
                />
              </div>
              <button type="submit" className="btn">
                Iniciar sesión
              </button>
            </form>
          )}
        </header>

        <div className="ws-body">
          {notification && (
            <div
              className={`notice ${
                notification.type === 'success' ? 'notice--ok' : 'notice--error'
              }`}
              role="status"
            >
              <span>{notification.message}</span>
              <button
                type="button"
                className="notice__close"
                onClick={() => setNotification(null)}
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          )}

          {activeTab === 'RESUMEN' && (
            <>
              <section className="ledger" aria-label="Totales acumulados">
                <div className="ledger__figures">
                  <div className="figure">
                    <p className="figure__label">Total causado</p>
                    <p className="figure__value num">
                      {formatUsdCurrency(totalAccruedDisplay)}
                    </p>
                    <p className="figure__note">
                      Suma prorrateada por días activos (RN-CAUS-01 a 03).
                    </p>
                  </div>
                  <div className="figure">
                    <p className="figure__label">Total pagado por FIFO</p>
                    <p className="figure__value num">
                      {formatUsdCurrency(totalPaidDisplay)}
                    </p>
                    <p className="figure__note">
                      Abonos aplicados por antigüedad de la deuda (RN-PAG-02).
                    </p>
                  </div>
                  <div className="figure">
                    <p className="figure__label">Deuda pendiente</p>
                    <p className="figure__value figure__value--debt num">
                      {formatUsdCurrency(totalPendingDisplay)}
                    </p>
                    <p className="figure__note">
                      Obligación neta con el personal de los proyectos.
                    </p>
                  </div>
                </div>
                <div className="ledger__side">
                  <p className="ledger__side-title">Cobertura actual</p>
                  <p className="ledger__count">
                    <strong className="num">{projects.length}</strong>
                    <span>proyectos en catálogo</span>
                  </p>
                  <p className="ledger__count">
                    <strong className="num">{beneficiaries.length}</strong>
                    <span>beneficiarios sin usuario</span>
                  </p>
                  <p className="ledger__count">
                    <strong className="num">{accruals.length}</strong>
                    <span>causaciones registradas</span>
                  </p>
                </div>
              </section>

              <section className="sheet">
                <div className="sheet__head">
                  <div>
                    <h2 className="sheet__title">
                      Estado de cuenta por beneficiario
                    </h2>
                    <p className="sheet__hint">
                      Consultas clave del enunciado (RN-AUD-01): causado, pagado
                      y adeudado por persona, con filtro por proyecto científico.
                    </p>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="project-filter">
                      Proyecto
                    </label>
                    <select
                      id="project-filter"
                      className="select"
                      value={summaryProjectFilter}
                      onChange={(e) => setSummaryProjectFilter(e.target.value)}
                    >
                      <option value="">Todos los proyectos</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} — {p.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="sheet__body sheet__body--flush">
                  <div className="table-scroll">
                    <table className="table">
                      <thead>
                        <tr>
                          <th scope="col">Cédula</th>
                          <th scope="col">Beneficiario</th>
                          <th scope="col" className="num">
                            Causado (USD)
                          </th>
                          <th scope="col" className="num">
                            Pagado FIFO (USD)
                          </th>
                          <th scope="col" className="num">
                            Saldo adeudado (USD)
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {balanceRows.length === 0 && (
                          <tr className="table__empty">
                            <td colSpan={5}>
                              Sin causaciones registradas para el filtro actual.
                              Genere un lote de causación en el espacio 3.
                            </td>
                          </tr>
                        )}
                        {balanceRows.map((row) => (
                          <tr key={row.beneficiaryId}>
                            <td className="nowrap">{row.beneficiaryDni}</td>
                            <td className="table__strong">
                              {row.beneficiaryName}
                            </td>
                            <td className="num">
                              {formatUsdCurrency(Number(row.totalAccruedUsd))}
                            </td>
                            <td className="num">
                              {formatUsdCurrency(Number(row.totalPaidUsd))}
                            </td>
                            <td className="num table__strong">
                              {formatUsdCurrency(Number(row.totalDebtDueUsd))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </section>
            </>
          )}

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

          {activeTab === 'MOTOR_FINANCIERO' && (
            <FinancialEnginePanel
              token={token}
              activeRole={activeRole}
              projects={projects}
              paymentGroups={paymentGroups}
              beneficiaries={beneficiaries}
              accruals={accruals}
              accrualBatches={accrualBatches}
              paymentRequests={paymentRequests}
              payments={payments}
              onRefresh={refreshData}
              onNotify={handleNotify}
            />
          )}

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

          {activeTab === 'AUDITORIA' && (
            <UsersAndAuditWorkspace
              token={token}
              activeRole={activeRole}
              users={users}
              parameters={parameters}
              auditLogs={auditLogs}
              onRefresh={refreshData}
              onNotify={handleNotify}
            />
          )}
        </div>
      </div>
    </div>
  );
}
