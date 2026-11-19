import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LiveAssignment,
  LiveBeneficiary,
  LivePaymentGroup,
  LiveProject,
} from '../components/CatalogsAndAssignmentsWorkspace';
import {
  LiveAccrual,
  LiveAccrualBatch,
  LivePayment,
  LivePaymentRequest,
} from '../components/FinancialEnginePanel';
import { LivePettyCash } from '../components/PettyCashAndReportsPanel';
import {
  LiveAuditRecord,
  LiveSystemParameter,
  LiveUser,
} from '../components/UsersAndAuditWorkspace';
import {
  AccrualStatus,
  Periodicity,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';
import { getRolePermissions } from '../utils/rbac.util';
import {
  buildUserSession,
  clearSession,
  loadSession,
  saveSession,
} from '../utils/session.util';
import { paginateTableItems, searchTableItems } from '../utils/table-filter.util';
import type { PaginationResult } from '../utils/table-filter.util';

export interface SummaryPaymentHistoryItem {
  id: string;
  receiptCode: string;
  paymentDate: string;
  amountUsd: string;
  status: string;
  reference: string | null;
  beneficiaryName: string;
  beneficiaryDni: string;
  projectCode: string;
  requestCode: string;
}

export interface ExecutiveSummaryData {
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
    oldestUnpaidPeriodStart?: string | null;
    pendingAccrualsCount?: number;
  }>;
  paymentHistory?: SummaryPaymentHistoryItem[];
}

export interface WorkspaceNotification {
  type: 'success' | 'error';
  message: string;
}

interface LoginResponse {
  accessToken: string;
  user: { id: string; email: string; fullName: string; role: UserRole };
}

export const DEMO_ROLE_CREDENTIALS: Record<
  UserRole,
  { email: string; password: string; label: string; role: UserRole }
> = {
  [UserRole.ADMIN]: {
    email: 'admin@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'ADMIN (admin@uc.edu.ve)',
    role: UserRole.ADMIN,
  },
  [UserRole.GENERADOR]: {
    email: 'coordinador@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'GENERADOR - Coordinador (coordinador@uc.edu.ve)',
    role: UserRole.GENERADOR,
  },
  [UserRole.RECEPTOR]: {
    email: 'gerente@uc.edu.ve',
    password: 'PasswordUC2026!',
    label: 'RECEPTOR - Gerencia (gerente@uc.edu.ve)',
    role: UserRole.RECEPTOR,
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
];

export interface WorkspaceContextValue {
  // Sesión y RBAC
  token: string | null;
  activeRole: UserRole;
  currentUserEmail: string;
  isConnectedToApi: boolean;
  isBootstrapping: boolean;
  loginWithCredentials: (email: string, password: string) => Promise<string | null>;
  loginAsRole: (role: UserRole) => Promise<string | null>;
  logout: () => void;
  // Avisos
  notification: WorkspaceNotification | null;
  notify: (type: 'success' | 'error', message: string) => void;
  clearNotification: () => void;
  // Datos
  projects: LiveProject[];
  paymentGroups: LivePaymentGroup[];
  beneficiaries: LiveBeneficiary[];
  assignments: LiveAssignment[];
  accruals: LiveAccrual[];
  accrualBatches: LiveAccrualBatch[];
  paymentRequests: LivePaymentRequest[];
  payments: LivePayment[];
  pettyCashes: LivePettyCash[];
  users: LiveUser[];
  parameters: LiveSystemParameter[];
  auditLogs: LiveAuditRecord[];
  refreshData: () => Promise<void>;
  // Resumen
  summaryProjectFilter: string;
  setSummaryProjectFilter: (value: string) => void;
  summarySearchQuery: string;
  setSummarySearchQuery: (value: string) => void;
  summaryPage: number;
  setSummaryPage: (page: number) => void;
  totalAccruedDisplay: number;
  totalPaidDisplay: number;
  totalPendingDisplay: number;
  rawBalanceRows: ExecutiveSummaryData['beneficiaryBalances'];
  filteredBalanceRows: ExecutiveSummaryData['beneficiaryBalances'];
  paginatedBalanceData: PaginationResult<
    ExecutiveSummaryData['beneficiaryBalances'][number]
  >;
  summaryPaymentHistory: SummaryPaymentHistoryItem[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspace debe usarse dentro de <WorkspaceProvider>');
  }
  return context;
}

export function WorkspaceProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [activeRole, setActiveRole] = useState<UserRole>(UserRole.GENERADOR);
  const [token, setToken] = useState<string | null>(null);
  const [isConnectedToApi, setIsConnectedToApi] = useState<boolean>(false);
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [currentUserEmail, setCurrentUserEmail] = useState<string>(
    DEMO_ROLE_CREDENTIALS[UserRole.GENERADOR].email,
  );

  const [notification, setNotification] =
    useState<WorkspaceNotification | null>(null);

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
  const [paymentRequests, setPaymentRequests] = useState<LivePaymentRequest[]>([]);
  const [payments, setPayments] = useState<LivePayment[]>([]);
  const [pettyCashes, setPettyCashes] = useState<LivePettyCash[]>([]);
  const [users, setUsers] = useState<LiveUser[]>([]);
  const [parameters, setParameters] = useState<LiveSystemParameter[]>([]);
  const [auditLogs, setAuditLogs] = useState<LiveAuditRecord[]>([]);
  const [summary, setSummary] = useState<ExecutiveSummaryData | null>(null);
  const [summaryProjectFilter, setSummaryProjectFilter] = useState<string>('');
  const [summarySearchQuery, setSummarySearchQuery] = useState<string>('');
  const [summaryPage, setSummaryPage] = useState<number>(1);

  const notify = useCallback(
    (type: 'success' | 'error', message: string) => {
      setNotification({ type, message });
    },
    [],
  );

  const clearNotification = useCallback(() => setNotification(null), []);

  const loadWorkspaceData = useCallback(
    async (authToken: string, role: UserRole, projectFilter: string) => {
      try {
        const summaryUrl = projectFilter
          ? `/reports/summary?projectId=${projectFilter}`
          : '/reports/summary';

        const [projRes, pgRes, benRes, sumRes] = await Promise.all([
          apiRequest<LiveProject[]>('/projects', { token: authToken }),
          apiRequest<LivePaymentGroup[]>('/payment-groups', { token: authToken }),
          apiRequest<LiveBeneficiary[]>('/beneficiaries', { token: authToken }),
          apiRequest<ExecutiveSummaryData>(summaryUrl, { token: authToken }),
        ]);
        setProjects(projRes);
        setPaymentGroups(pgRes);
        setBeneficiaries(benRes);
        setSummary(sumRes);

        // RN-SEG-02: el ADMIN no gestiona asignaciones ni opera dinero.
        if (role === UserRole.ADMIN) {
          setAssignments([]);
          setAccruals([]);
          setAccrualBatches([]);
          setPaymentRequests([]);
          setPayments([]);
          setPettyCashes([]);
        } else {
          const [asigRes, accRes, batchRes, reqRes, payRes, pcRes] =
            await Promise.all([
              apiRequest<LiveAssignment[]>('/assignments', { token: authToken }),
              apiRequest<LiveAccrual[]>('/accruals', { token: authToken }),
              apiRequest<LiveAccrualBatch[]>('/accruals/batches', {
                token: authToken,
              }),
              apiRequest<LivePaymentRequest[]>('/payment-requests', {
                token: authToken,
              }),
              apiRequest<LivePayment[]>('/payments', { token: authToken }),
              apiRequest<LivePettyCash[]>('/petty-cashes', { token: authToken }),
            ]);
          setAssignments(asigRes);
          setAccruals(accRes);
          setAccrualBatches(batchRes);
          setPaymentRequests(reqRes);
          setPayments(payRes);
          setPettyCashes(pcRes);
        }

        if (role === UserRole.ADMIN) {
          const [usersRes, parametersRes] = await Promise.all([
            apiRequest<LiveUser[]>('/users', { token: authToken }),
            apiRequest<LiveSystemParameter[]>('/parameters', { token: authToken }),
          ]);
          setUsers(usersRes);
          setParameters(parametersRes);
        } else {
          setUsers([]);
          setParameters([]);
        }

        const permissions = getRolePermissions(role);
        if (permissions.canViewAuditLog) {
          const logsRes = await apiRequest<LiveAuditRecord[]>('/audit-logs', {
            token: authToken,
          });
          setAuditLogs(logsRes);
        } else {
          setAuditLogs([]);
        }

        setIsConnectedToApi(true);
      } catch {
        // Se conservan los datos previos si algún endpoint está restringido para el rol.
        setIsConnectedToApi(false);
      }
    },
    [],
  );

  /** Recarga los datos con la sesión vigente (botón "Actualizar datos"). */
  const refreshData = useCallback(async () => {
    if (token) {
      await loadWorkspaceData(token, activeRole, summaryProjectFilter);
    }
  }, [token, activeRole, summaryProjectFilter, loadWorkspaceData]);

  const applyLogin = useCallback(
    (response: LoginResponse) => {
      const session = buildUserSession({
        id: response.user.id,
        email: response.user.email,
        fullName: response.user.fullName,
        role: response.user.role,
        accessToken: response.accessToken,
      });
      saveSession(session);
      setToken(session.token);
      setActiveRole(session.role);
      setCurrentUserEmail(session.email);
      setIsConnectedToApi(true);
      setSummaryPage(1);
    },
    [],
  );

  const loginWithCredentials = useCallback(
    async (email: string, password: string): Promise<string | null> => {
      try {
        const response = await apiRequest<LoginResponse>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        applyLogin(response);
        return null;
      } catch (error) {
        setIsConnectedToApi(false);
        return (error as Error).message;
      }
    },
    [applyLogin],
  );

  const loginAsRole = useCallback(
    async (role: UserRole): Promise<string | null> => {
      const credentials = DEMO_ROLE_CREDENTIALS[role];
      return loginWithCredentials(credentials.email, credentials.password);
    },
    [loginWithCredentials],
  );

  const logout = useCallback(() => {
    clearSession();
    setToken(null);
    setActiveRole(UserRole.GENERADOR);
    setIsConnectedToApi(false);
    setAssignments([]);
    setAccruals(FALLBACK_ACCRUALS);
    setAccrualBatches([]);
    setPaymentRequests([]);
    setPayments([]);
    setPettyCashes([]);
    setUsers([]);
    setParameters([]);
    setAuditLogs([]);
    setSummary(null);
    setSummarySearchQuery('');
    setSummaryPage(1);
    notify('success', 'Sesión finalizada. Ingrese con sus credenciales para continuar.');
  }, [notify]);

  // Restauración de la sesión de la pestaña al montar la aplicación.
  useEffect(() => {
    const stored = loadSession();
    if (stored) {
      setToken(stored.token);
      setActiveRole(stored.role);
      setCurrentUserEmail(stored.email);
      setIsConnectedToApi(true);
    }
    setIsBootstrapping(false);
  }, []);

  // Carga (y recarga) los datos cuando cambia la sesión o el filtro de proyecto.
  useEffect(() => {
    if (!token || isBootstrapping) {
      return;
    }
    void loadWorkspaceData(token, activeRole, summaryProjectFilter);
  }, [token, activeRole, summaryProjectFilter, isBootstrapping, loadWorkspaceData]);

  const totalAccruedDisplay = summary
    ? Number(summary.totalAccruedUsd)
    : accruals.reduce((acc, row) => acc + Number(row.proratedAmount), 0);
  const totalPaidDisplay = summary
    ? Number(summary.totalPaidUsd)
    : accruals.reduce((acc, row) => acc + Number(row.paidAmount), 0);
  const totalPendingDisplay = summary
    ? Number(summary.totalPendingDebtUsd)
    : accruals.reduce((acc, row) => acc + Number(row.balanceDue), 0);

  const rawBalanceRows = summary?.beneficiaryBalances ?? [];
  const summaryPaymentHistory = summary?.paymentHistory ?? [];
  const filteredBalanceRows = searchTableItems(rawBalanceRows, summarySearchQuery, [
    'beneficiaryDni',
    'beneficiaryName',
  ]);
  const paginatedBalanceData = paginateTableItems(filteredBalanceRows, summaryPage, 10);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      token,
      activeRole,
      currentUserEmail,
      isConnectedToApi,
      isBootstrapping,
      loginWithCredentials,
      loginAsRole,
      logout,
      notification,
      notify,
      clearNotification,
      projects,
      paymentGroups,
      beneficiaries,
      assignments,
      accruals,
      accrualBatches,
      paymentRequests,
      payments,
      pettyCashes,
      users,
      parameters,
      auditLogs,
      refreshData,
      summaryProjectFilter,
      setSummaryProjectFilter,
      summarySearchQuery,
      setSummarySearchQuery,
      summaryPage,
      setSummaryPage,
      totalAccruedDisplay,
      totalPaidDisplay,
      totalPendingDisplay,
      rawBalanceRows,
      filteredBalanceRows,
      paginatedBalanceData,
      summaryPaymentHistory,
    }),
    [
      token,
      activeRole,
      currentUserEmail,
      isConnectedToApi,
      isBootstrapping,
      loginWithCredentials,
      loginAsRole,
      logout,
      notification,
      notify,
      clearNotification,
      projects,
      paymentGroups,
      beneficiaries,
      assignments,
      accruals,
      accrualBatches,
      paymentRequests,
      payments,
      pettyCashes,
      users,
      parameters,
      auditLogs,
      refreshData,
      summaryProjectFilter,
      summarySearchQuery,
      summaryPage,
      totalAccruedDisplay,
      totalPaidDisplay,
      totalPendingDisplay,
      rawBalanceRows,
      filteredBalanceRows,
      paginatedBalanceData,
      summaryPaymentHistory,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
