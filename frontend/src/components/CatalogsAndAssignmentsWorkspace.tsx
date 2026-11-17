import React, { useEffect, useState } from 'react';
import {
  Periodicity,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';
import {
  clampDateRangeToWindow,
  toIsoDateSlice,
} from '../utils/range-validity.util';
import {
  analyzeBeneficiaryProjectAvailability,
  isConfirmationArmed,
} from '../utils/ux-workflows.util';
import { TableFilterBar } from './TableFilterBar';
import { TablePagination } from './TablePagination';
import {
  filterTableByProperty,
  paginateTableItems,
  searchTableItems,
} from '../utils/table-filter.util';

export interface LiveProject {
  id: string;
  code: string;
  name: string;
  area: ProjectArea;
  scope: ProjectScope;
  startDate: string;
  endDate: string;
  status: ProjectStatus;
}

export interface LivePaymentGroup {
  id: string;
  name: string;
  periodicity: Periodicity;
  cutoffRules: string;
  isActive: boolean;
}

export interface LivePaymentGroupPeriod {
  id: string;
  paymentGroupId: string;
  periodStart: string;
  periodEnd: string;
  label?: string | null;
}

export interface LiveBeneficiary {
  id: string;
  dni: string;
  fullName: string;
  email?: string | null;
  phone?: string | null;
  bankInfo?: string | null;
  isActive: boolean;
}

export interface LiveAssignment {
  id: string;
  beneficiaryId: string;
  projectId: string;
  paymentGroupId: string;
  amountPerPeriod: string | number;
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
  beneficiary?: LiveBeneficiary;
  project?: LiveProject;
  paymentGroup?: LivePaymentGroup;
}

interface CatalogsProps {
  token: string | null;
  activeRole: UserRole;
  projects: LiveProject[];
  paymentGroups: LivePaymentGroup[];
  beneficiaries: LiveBeneficiary[];
  assignments: LiveAssignment[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

const PROJECT_AREA_DISPLAY: Record<
  ProjectArea,
  { label: string; className: string }
> = {
  [ProjectArea.FISICA]: { label: 'Física', className: 'area--fisica' },
  [ProjectArea.QUIMICA]: { label: 'Química', className: 'area--quimica' },
  [ProjectArea.BIOLOGIA]: { label: 'Biología', className: 'area--biologia' },
};

const PROJECT_STATUS_BADGE: Record<ProjectStatus, string> = {
  [ProjectStatus.ACTIVO]: 'badge--ok',
  [ProjectStatus.INACTIVO]: 'badge--warn',
  [ProjectStatus.CERRADO]: 'badge--plain',
};

export function CatalogsAndAssignmentsWorkspace({
  token,
  activeRole,
  projects,
  paymentGroups,
  beneficiaries,
  assignments,
  onRefresh,
  onNotify,
}: CatalogsProps): React.ReactElement {
  const canManageProjects =
    activeRole === UserRole.ADMIN || activeRole === UserRole.GENERADOR;
  const canManagePaymentGroups = activeRole === UserRole.ADMIN;
  const canManageBeneficiaries =
    activeRole === UserRole.ADMIN || activeRole === UserRole.GENERADOR;
  const canEditAssignments = activeRole === UserRole.GENERADOR;

  // Estado formulario Proyecto
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [projCode, setProjCode] = useState('PROY-FIS-2026-09');
  const [projName, setProjName] = useState('Fotónica Aplicada FACYT');
  const [projArea, setProjArea] = useState<ProjectArea>(ProjectArea.FISICA);
  const [projScope, setProjScope] = useState<ProjectScope>(ProjectScope.INTERNO);
  const [projStart, setProjStart] = useState('2026-01-01');
  const [projEnd, setProjEnd] = useState('2026-12-31');

  // Estado formulario Grupo de Pago
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [pgName, setPgName] = useState('Semanal Asistentes Laboratorio');
  const [pgPeriodicity, setPgPeriodicity] = useState<Periodicity>(
    Periodicity.SEMANAL,
  );
  const [pgCutoffRules, setPgCutoffRules] = useState(
    'Ciclo de 7 días calendario',
  );

  // Estado formulario Beneficiario (RN-SEG-01: sin usuario)
  const [editingBeneficiaryId, setEditingBeneficiaryId] = useState<
    string | null
  >(null);
  const [benDni, setBenDni] = useState('V-24111222');
  const [benName, setBenName] = useState('Lic. Gabriela Rojas');
  const [benEmail, setBenEmail] = useState('grojas@uc.edu.ve');
  const [benPhone, setBenPhone] = useState('+58-414-0000000');
  const [benBank, setBenBank] = useState('Zelle / Cuenta USD #9921');

  // Estado formulario Asignación (RN-CAT-04)
  const [asigBeneficiaryId, setAsigBeneficiaryId] = useState('');
  const [asigProjectId, setAsigProjectId] = useState('');
  const [asigGroupId, setAsigGroupId] = useState('');
  const [asigAmount, setAsigAmount] = useState('450.00');
  const [asigStart, setAsigStart] = useState('2026-03-01');
  const [asigEnd, setAsigEnd] = useState('2026-12-31');

  // Estado períodos/cortes de pago
  const [periodGroupId, setPeriodGroupId] = useState('');
  const [periods, setPeriods] = useState<LivePaymentGroupPeriod[]>([]);
  const [newPeriodStart, setNewPeriodStart] = useState('2028-01-01');
  const [newPeriodEnd, setNewPeriodEnd] = useState('2028-01-15');
  const [newPeriodLabel, setNewPeriodLabel] = useState('Corte personalizado');

  // Estado confirmación en dos pasos para acciones irreversibles (UX #5)
  const [armedConfirmKey, setArmedConfirmKey] = useState<string | null>(null);

  const effectivePeriodGroupId = periodGroupId || paymentGroups[0]?.id || '';

  // Catálogos activos para selectores sin fricción (RN-CAT-02, RN-CAT-03, RN-SEG-01)
  const activeProjects = projects.filter(
    (p) => p.status === ProjectStatus.ACTIVO,
  );
  const activePaymentGroups = paymentGroups.filter((pg) => pg.isActive);
  const activeBeneficiaries = beneficiaries.filter((b) => b.isActive);

  const effectiveAsigBeneficiaryId =
    asigBeneficiaryId || activeBeneficiaries[0]?.id || '';
  const selectedAssignmentProject =
    activeProjects.find((p) => p.id === asigProjectId) ?? activeProjects[0];
  const asigMinDate = selectedAssignmentProject
    ? toIsoDateSlice(selectedAssignmentProject.startDate)
    : undefined;
  const asigMaxDate = selectedAssignmentProject
    ? toIsoDateSlice(selectedAssignmentProject.endDate)
    : undefined;

  const assignmentAvailability = analyzeBeneficiaryProjectAvailability({
    project: selectedAssignmentProject,
    beneficiaryId: effectiveAsigBeneficiaryId,
    assignments,
    proposedStart: asigStart,
    proposedEnd: asigEnd,
  });

  useEffect(() => {
    if (!selectedAssignmentProject) {
      return;
    }
    const clamped = clampDateRangeToWindow(
      asigStart,
      asigEnd,
      selectedAssignmentProject.startDate,
      selectedAssignmentProject.endDate,
    );
    if (clamped.startDate !== asigStart) {
      setAsigStart(clamped.startDate);
    }
    if (clamped.endDate !== asigEnd) {
      setAsigEnd(clamped.endDate);
    }
  }, [selectedAssignmentProject, asigStart, asigEnd]);

  // Estados de búsqueda, filtros y paginación
  const [projectSearch, setProjectSearch] = useState('');
  const [projectAreaFilter, setProjectAreaFilter] = useState('');
  const [projectPage, setProjectPage] = useState(1);

  const [beneficiarySearch, setBeneficiarySearch] = useState('');
  const [beneficiaryStatusFilter, setBeneficiaryStatusFilter] = useState('');
  const [beneficiaryPage, setBeneficiaryPage] = useState(1);

  const [assignmentSearch, setAssignmentSearch] = useState('');
  const [assignmentProjectFilter, setAssignmentProjectFilter] = useState('');
  const [assignmentPage, setAssignmentPage] = useState(1);

  // Proyectos filtrados y paginados
  const filteredProjectsByArea = filterTableByProperty(
    projects,
    'area',
    projectAreaFilter as ProjectArea | '',
  );
  const filteredProjects = searchTableItems(
    filteredProjectsByArea,
    projectSearch,
    ['code', 'name', 'scope'],
  );
  const paginatedProjects = paginateTableItems(
    filteredProjects,
    projectPage,
    8,
  );

  // Beneficiarios filtrados y paginados
  const filteredBeneficiariesByStatus =
    beneficiaryStatusFilter === 'ACTIVO'
      ? beneficiaries.filter((b) => b.isActive)
      : beneficiaryStatusFilter === 'INACTIVO'
        ? beneficiaries.filter((b) => !b.isActive)
        : beneficiaries;
  const filteredBeneficiaries = searchTableItems(
    filteredBeneficiariesByStatus,
    beneficiarySearch,
    ['dni', 'fullName', 'email', 'bankInfo'],
  );
  const paginatedBeneficiaries = paginateTableItems(
    filteredBeneficiaries,
    beneficiaryPage,
    8,
  );

  // Asignaciones filtradas y paginadas
  const filteredAssignmentsByProject = filterTableByProperty(
    assignments,
    'projectId',
    assignmentProjectFilter,
  );
  const filteredAssignments = searchTableItems(
    filteredAssignmentsByProject,
    assignmentSearch,
    [
      (a) => a.beneficiary?.fullName,
      (a) => a.beneficiary?.dni,
      (a) => a.project?.code,
      (a) => a.project?.name,
    ],
  );
  const paginatedAssignments = paginateTableItems(
    filteredAssignments,
    assignmentPage,
    8,
  );

  useEffect(() => {
    const loadPeriods = async () => {
      if (!effectivePeriodGroupId) {
        setPeriods([]);
        return;
      }
      try {
        const response = await apiRequest<LivePaymentGroupPeriod[]>(
          `/payment-groups/${effectivePeriodGroupId}/periods`,
          { token },
        );
        setPeriods(response);
      } catch {
        setPeriods([]);
      }
    };

    void loadPeriods();
  }, [effectivePeriodGroupId, token, paymentGroups]);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const saved = await apiRequest<LiveProject>(
        editingProjectId ? `/projects/${editingProjectId}` : '/projects',
        {
          method: editingProjectId ? 'PATCH' : 'POST',
          token,
          body: {
            name: projName,
            area: projArea,
            scope: projScope,
            startDate: projStart,
            endDate: projEnd,
          },
        },
      );
      onNotify(
        'success',
        editingProjectId
          ? `Proyecto '${projName}' actualizado.`
          : `Proyecto '${saved?.code ?? projName}' creado con código asignado por el sistema.`,
      );
      setEditingProjectId(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const startEditingProject = (project: LiveProject) => {
    setEditingProjectId(project.id);
    setProjCode(project.code);
    setProjName(project.name);
    setProjArea(project.area);
    setProjScope(project.scope);
    setProjStart(String(project.startDate).slice(0, 10));
    setProjEnd(String(project.endDate).slice(0, 10));
  };

  const cancelEditingProject = () => {
    setEditingProjectId(null);
    setProjCode('PROY-FIS-2026-09');
    setProjName('Fotónica Aplicada FACYT');
    setProjArea(ProjectArea.FISICA);
    setProjScope(ProjectScope.INTERNO);
    setProjStart('2026-01-01');
    setProjEnd('2026-12-31');
  };

  const handleChangeProjectStatus = async (
    projectId: string,
    status: ProjectStatus,
  ) => {
    try {
      await apiRequest(`/projects/${projectId}/status`, {
        method: 'PATCH',
        token,
        body: { status },
      });
      onNotify('success', `Estado del proyecto actualizado a ${status}.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSavePaymentGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(
        editingGroupId
          ? `/payment-groups/${editingGroupId}`
          : '/payment-groups',
        {
          method: editingGroupId ? 'PATCH' : 'POST',
          token,
          body: {
            name: pgName,
            periodicity: pgPeriodicity,
            cutoffRules: pgCutoffRules,
          },
        },
      );
      onNotify(
        'success',
        editingGroupId
          ? `Grupo de pago '${pgName}' actualizado.`
          : `Grupo de pago '${pgName}' registrado con sus períodos de corte.`,
      );
      setEditingGroupId(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const startEditingGroup = (group: LivePaymentGroup) => {
    setEditingGroupId(group.id);
    setPgName(group.name);
    setPgPeriodicity(group.periodicity);
    setPgCutoffRules(group.cutoffRules);
  };

  const cancelEditingGroup = () => {
    setEditingGroupId(null);
    setPgName('Semanal Asistentes Laboratorio');
    setPgPeriodicity(Periodicity.SEMANAL);
    setPgCutoffRules('Ciclo de 7 días calendario');
  };

  const handleTogglePaymentGroup = async (group: LivePaymentGroup) => {
    try {
      await apiRequest(`/payment-groups/${group.id}`, {
        method: 'PATCH',
        token,
        body: { isActive: !group.isActive },
      });
      onNotify(
        'success',
        `Grupo '${group.name}' ${group.isActive ? 'desactivado' : 'activado'}.`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSaveBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest(
        editingBeneficiaryId
          ? `/beneficiaries/${editingBeneficiaryId}`
          : '/beneficiaries',
        {
          method: editingBeneficiaryId ? 'PATCH' : 'POST',
          token,
          body: {
            ...(editingBeneficiaryId ? {} : { dni: benDni }),
            fullName: benName,
            email: benEmail,
            phone: benPhone,
            bankInfo: benBank,
          },
        },
      );
      onNotify(
        'success',
        editingBeneficiaryId
          ? `Beneficiario '${benName}' actualizado.`
          : `Beneficiario '${benName}' registrado (sin cuenta de usuario según RN-SEG-01).`,
      );
      setEditingBeneficiaryId(null);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const startEditingBeneficiary = (beneficiary: LiveBeneficiary) => {
    setEditingBeneficiaryId(beneficiary.id);
    setBenDni(beneficiary.dni);
    setBenName(beneficiary.fullName);
    setBenEmail(beneficiary.email ?? '');
    setBenPhone(beneficiary.phone ?? '');
    setBenBank(beneficiary.bankInfo ?? '');
  };

  const cancelEditingBeneficiary = () => {
    setEditingBeneficiaryId(null);
    setBenDni('V-24111222');
    setBenName('Lic. Gabriela Rojas');
    setBenEmail('grojas@uc.edu.ve');
    setBenPhone('+58-414-0000000');
    setBenBank('Zelle / Cuenta USD #9921');
  };

  const handleToggleBeneficiary = async (beneficiary: LiveBeneficiary) => {
    try {
      await apiRequest(`/beneficiaries/${beneficiary.id}`, {
        method: 'PATCH',
        token,
        body: { isActive: !beneficiary.isActive },
      });
      onNotify(
        'success',
        `Beneficiario '${beneficiary.fullName}' ${beneficiary.isActive ? 'desactivado' : 'activado'}.`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCreatePaymentPeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectivePeriodGroupId) {
      onNotify('error', 'Seleccione un grupo de pago.');
      return;
    }
    try {
      await apiRequest(`/payment-groups/${effectivePeriodGroupId}/periods`, {
        method: 'POST',
        token,
        body: {
          periodStart: newPeriodStart,
          periodEnd: newPeriodEnd,
          label: newPeriodLabel,
        },
      });
      onNotify('success', 'Fecha de corte agregada.');
      const response = await apiRequest<LivePaymentGroupPeriod[]>(
        `/payment-groups/${effectivePeriodGroupId}/periods`,
        { token },
      );
      setPeriods(response);
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleDeletePaymentPeriod = async (periodId: string) => {
    try {
      await apiRequest(
        `/payment-groups/${effectivePeriodGroupId}/periods/${periodId}`,
        { method: 'DELETE', token },
      );
      onNotify('success', 'Fecha de corte eliminada.');
      setPeriods((current) => current.filter((period) => period.id !== periodId));
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBeneficiary = asigBeneficiaryId || activeBeneficiaries[0]?.id;
    const targetProject = asigProjectId || activeProjects[0]?.id;
    const targetGroup = asigGroupId || activePaymentGroups[0]?.id;

    if (!targetBeneficiary || !targetProject || !targetGroup) {
      onNotify(
        'error',
        'Seleccione un beneficiario, un proyecto y un grupo de pago.',
      );
      return;
    }

    try {
      await apiRequest('/assignments', {
        method: 'POST',
        token,
        body: {
          beneficiaryId: targetBeneficiary,
          projectId: targetProject,
          paymentGroupId: targetGroup,
          amountPerPeriod: asigAmount,
          startDate: asigStart,
          endDate: asigEnd || undefined,
        },
      });
      onNotify(
        'success',
        'Asignación en USD creada respetando RN-CAT-04 (sin solapamiento en el mismo proyecto).',
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleDeactivateAssignment = async (assignmentId: string) => {
    try {
      await apiRequest(`/assignments/${assignmentId}/deactivate`, {
        method: 'PATCH',
        token,
      });
      setArmedConfirmKey(null);
      onNotify('success', 'Asignación desactivada.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  return (
    <div className="stack stack--lg">
      {/* PROYECTOS */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Proyectos de investigación</h2>
            <p className="sheet__hint">
              Área, ámbito y vigencia de cada proyecto científico de FACYT.
              RN-CAT-01 y RN-CAT-02.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            {canManageProjects && (
              <form onSubmit={handleSaveProject} className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="proj-code">
                    Código (sistema)
                  </label>
                  <input
                    id="proj-code"
                    className="input"
                    value={
                      editingProjectId
                        ? projCode
                        : 'Autogenerado por el sistema'
                    }
                    readOnly
                    disabled
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="proj-name">
                    Nombre del proyecto
                  </label>
                  <input
                    id="proj-name"
                    className="input"
                    value={projName}
                    onChange={(e) => setProjName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="proj-area">
                    Área
                  </label>
                  <select
                    id="proj-area"
                    className="select"
                    value={projArea}
                    onChange={(e) => setProjArea(e.target.value as ProjectArea)}
                  >
                    <option value={ProjectArea.FISICA}>Física</option>
                    <option value={ProjectArea.QUIMICA}>Química</option>
                    <option value={ProjectArea.BIOLOGIA}>Biología</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="proj-scope">
                    Ámbito
                  </label>
                  <select
                    id="proj-scope"
                    className="select"
                    value={projScope}
                    onChange={(e) => setProjScope(e.target.value as ProjectScope)}
                  >
                    <option value={ProjectScope.INTERNO}>INTERNO (UC)</option>
                    <option value={ProjectScope.EXTERNO}>EXTERNO</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="proj-start">
                    Inicio
                  </label>
                  <input
                    id="proj-start"
                    className="input"
                    type="date"
                    value={projStart}
                    onChange={(e) => setProjStart(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="proj-end">
                    Fin
                  </label>
                  <input
                    id="proj-end"
                    className="input"
                    type="date"
                    min={projStart}
                    value={projEnd}
                    onChange={(e) => setProjEnd(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn">
                  {editingProjectId ? 'Actualizar Proyecto' : '+ Crear Proyecto'}
                </button>
                {editingProjectId && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelEditingProject}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            )}

            <TableFilterBar
              searchPlaceholder="Buscar por código, nombre o ámbito..."
              searchQuery={projectSearch}
              onSearchChange={(q) => {
                setProjectSearch(q);
                setProjectPage(1);
              }}
              filterLabel="Área"
              filterValue={projectAreaFilter}
              filterOptions={[
                { label: 'Todas las áreas', value: 'ALL' },
                { label: 'Física', value: ProjectArea.FISICA },
                { label: 'Química', value: ProjectArea.QUIMICA },
                { label: 'Biología', value: ProjectArea.BIOLOGIA },
              ]}
              onFilterChange={(v) => {
                setProjectAreaFilter(v);
                setProjectPage(1);
              }}
              resultCount={filteredProjects.length}
              totalCount={projects.length}
              onReset={() => {
                setProjectSearch('');
                setProjectAreaFilter('');
                setProjectPage(1);
              }}
            />

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Código</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Área</th>
                    <th scope="col">Ámbito</th>
                    <th scope="col">Vigencia</th>
                    <th scope="col">Estado</th>
                    {canManageProjects && <th scope="col">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedProjects.items.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={canManageProjects ? 7 : 6}>
                        {projects.length === 0
                          ? 'No hay proyectos en el catálogo. Registre el primero con el formulario superior.'
                          : 'No se encontraron proyectos que coincidan con la búsqueda o filtro.'}
                      </td>
                    </tr>
                  )}
                  {paginatedProjects.items.map((p) => (
                    <tr key={p.id}>
                      <td className="nowrap">{p.code}</td>
                      <td className="table__strong">{p.name}</td>
                      <td>
                        <span
                          className={`area ${PROJECT_AREA_DISPLAY[p.area].className}`}
                        >
                          {PROJECT_AREA_DISPLAY[p.area].label}
                        </span>
                      </td>
                      <td>{p.scope}</td>
                      <td className="nowrap">
                        {String(p.startDate).slice(0, 10)} →{' '}
                        {String(p.endDate).slice(0, 10)}
                      </td>
                      <td>
                        <span
                          className={`badge ${PROJECT_STATUS_BADGE[p.status]}`}
                        >
                          {p.status}
                        </span>
                      </td>
                      {canManageProjects && (
                        <td>
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => startEditingProject(p)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() =>
                                handleChangeProjectStatus(
                                  p.id,
                                  p.status === ProjectStatus.ACTIVO
                                    ? ProjectStatus.INACTIVO
                                    : ProjectStatus.ACTIVO,
                                )
                              }
                            >
                              {p.status === ProjectStatus.ACTIVO
                                ? 'Desactivar'
                                : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={paginatedProjects.currentPage}
              totalPages={paginatedProjects.totalPages}
              totalItems={paginatedProjects.totalItems}
              startIndex={paginatedProjects.startIndex}
              endIndex={paginatedProjects.endIndex}
              onPageChange={setProjectPage}
            />
          </div>
        </div>
      </section>

      {/* GRUPOS DE PAGO Y FECHAS DE CORTE */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Grupos de pago y fechas de corte</h2>
            <p className="sheet__hint">
              Periodicidad y regla de corte de cada grupo. Los períodos estándar
              se generan al crear el grupo; el ADMIN puede agregar o eliminar
              cortes personalizados. RN-CAT-03.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            {canManagePaymentGroups && (
              <form onSubmit={handleSavePaymentGroup} className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="pg-name">
                    Nombre del grupo
                  </label>
                  <input
                    id="pg-name"
                    className="input"
                    value={pgName}
                    onChange={(e) => setPgName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pg-periodicity">
                    Periodicidad
                  </label>
                  <select
                    id="pg-periodicity"
                    className="select"
                    value={pgPeriodicity}
                    onChange={(e) =>
                      setPgPeriodicity(e.target.value as Periodicity)
                    }
                  >
                    <option value={Periodicity.SEMANAL}>SEMANAL</option>
                    <option value={Periodicity.QUINCENAL}>QUINCENAL</option>
                    <option value={Periodicity.MENSUAL}>MENSUAL</option>
                  </select>
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="pg-cutoff">
                    Regla de corte
                  </label>
                  <input
                    id="pg-cutoff"
                    className="input"
                    value={pgCutoffRules}
                    onChange={(e) => setPgCutoffRules(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn">
                  {editingGroupId ? 'Actualizar Grupo' : '+ Crear Grupo'}
                </button>
                {editingGroupId && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelEditingGroup}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            )}

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Grupo</th>
                    <th scope="col">Periodicidad</th>
                    <th scope="col">Regla de corte</th>
                    <th scope="col">Estado</th>
                    {canManagePaymentGroups && <th scope="col">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {paymentGroups.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={canManagePaymentGroups ? 5 : 4}>
                        No hay grupos de pago registrados. Cree uno para definir
                        sus fechas de corte.
                      </td>
                    </tr>
                  )}
                  {paymentGroups.map((pg) => (
                    <tr key={pg.id}>
                      <td className="table__strong">{pg.name}</td>
                      <td>{pg.periodicity}</td>
                      <td>{pg.cutoffRules}</td>
                      <td>
                        <span
                          className={`badge ${pg.isActive ? 'badge--ok' : 'badge--warn'}`}
                        >
                          {pg.isActive ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      {canManagePaymentGroups && (
                        <td>
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => startEditingGroup(pg)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`btn btn--sm ${pg.isActive ? 'btn--danger' : 'btn--ghost'}`}
                              onClick={() => handleTogglePaymentGroup(pg)}
                            >
                              {pg.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="subsheet">
              <h3 className="subsheet__title">Fechas de corte del grupo</h3>
              <div className="stack">
                <div className="field">
                  <label className="field__label" htmlFor="period-group">
                    Grupo de pago
                  </label>
                  <select
                    id="period-group"
                    className="select"
                    value={effectivePeriodGroupId}
                    onChange={(e) => setPeriodGroupId(e.target.value)}
                  >
                    {paymentGroups.map((group) => (
                      <option key={group.id} value={group.id}>
                        {group.name} ({group.periodicity})
                      </option>
                    ))}
                  </select>
                </div>

                {canManagePaymentGroups && (
                  <form
                    onSubmit={handleCreatePaymentPeriod}
                    className="form-row"
                  >
                    <div className="field">
                      <label className="field__label" htmlFor="period-start">
                        Inicio
                      </label>
                      <input
                        id="period-start"
                        className="input"
                        type="date"
                        value={newPeriodStart}
                        onChange={(e) => setNewPeriodStart(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="period-end">
                        Fin
                      </label>
                      <input
                        id="period-end"
                        className="input"
                        type="date"
                        min={newPeriodStart}
                        value={newPeriodEnd}
                        onChange={(e) => setNewPeriodEnd(e.target.value)}
                        required
                      />
                    </div>
                    <div className="field">
                      <label className="field__label" htmlFor="period-label">
                        Etiqueta
                      </label>
                      <input
                        id="period-label"
                        className="input"
                        value={newPeriodLabel}
                        onChange={(e) => setNewPeriodLabel(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn">
                      + Agregar Corte
                    </button>
                  </form>
                )}

                <div className="table-scroll">
                  <table className="table">
                    <thead>
                      <tr>
                        <th scope="col">Inicio</th>
                        <th scope="col">Fin</th>
                        <th scope="col">Etiqueta</th>
                        {canManagePaymentGroups && <th scope="col">Acción</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.length === 0 && (
                        <tr className="table__empty">
                          <td colSpan={canManagePaymentGroups ? 4 : 3}>
                            Sin fechas de corte para el grupo seleccionado.
                            Agregue un corte personalizado.
                          </td>
                        </tr>
                      )}
                      {periods.map((period) => (
                        <tr key={period.id}>
                          <td className="nowrap">
                            {String(period.periodStart).slice(0, 10)}
                          </td>
                          <td className="nowrap">
                            {String(period.periodEnd).slice(0, 10)}
                          </td>
                          <td>{period.label ?? '—'}</td>
                          {canManagePaymentGroups && (
                            <td>
                              <button
                                type="button"
                                className="btn btn--danger btn--sm"
                                onClick={() =>
                                  handleDeletePaymentPeriod(period.id)
                                }
                              >
                                Eliminar
                              </button>
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* BENEFICIARIOS */}
      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Beneficiarios</h2>
            <p className="sheet__hint">
              Personas que cobran asignaciones sin cuenta de usuario en el
              sistema. RN-SEG-01.
            </p>
          </div>
        </div>
        <div className="sheet__body">
          <div className="stack">
            {canManageBeneficiaries && (
              <form onSubmit={handleSaveBeneficiary} className="form-grid">
                <div className="field">
                  <label className="field__label" htmlFor="ben-dni">
                    Cédula
                  </label>
                  <input
                    id="ben-dni"
                    className="input"
                    value={benDni}
                    onChange={(e) => setBenDni(e.target.value)}
                    required
                    disabled={Boolean(editingBeneficiaryId)}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ben-name">
                    Nombre completo
                  </label>
                  <input
                    id="ben-name"
                    className="input"
                    value={benName}
                    onChange={(e) => setBenName(e.target.value)}
                    required
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ben-email">
                    Correo
                  </label>
                  <input
                    id="ben-email"
                    className="input"
                    value={benEmail}
                    onChange={(e) => setBenEmail(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ben-phone">
                    Teléfono
                  </label>
                  <input
                    id="ben-phone"
                    className="input"
                    value={benPhone}
                    onChange={(e) => setBenPhone(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label className="field__label" htmlFor="ben-bank">
                    Referencia de pago
                  </label>
                  <input
                    id="ben-bank"
                    className="input"
                    value={benBank}
                    onChange={(e) => setBenBank(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn">
                  {editingBeneficiaryId
                    ? 'Actualizar Beneficiario'
                    : '+ Registrar Beneficiario'}
                </button>
                {editingBeneficiaryId && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelEditingBeneficiary}
                  >
                    Cancelar
                  </button>
                )}
              </form>
            )}

            <TableFilterBar
              searchPlaceholder="Buscar por cédula, nombre, correo o banco..."
              searchQuery={beneficiarySearch}
              onSearchChange={(q) => {
                setBeneficiarySearch(q);
                setBeneficiaryPage(1);
              }}
              filterLabel="Estado"
              filterValue={beneficiaryStatusFilter}
              filterOptions={[
                { label: 'Todos los estados', value: 'ALL' },
                { label: 'Activos', value: 'ACTIVO' },
                { label: 'Inactivos', value: 'INACTIVO' },
              ]}
              onFilterChange={(v) => {
                setBeneficiaryStatusFilter(v);
                setBeneficiaryPage(1);
              }}
              resultCount={filteredBeneficiaries.length}
              totalCount={beneficiaries.length}
              onReset={() => {
                setBeneficiarySearch('');
                setBeneficiaryStatusFilter('');
                setBeneficiaryPage(1);
              }}
            />

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Cédula</th>
                    <th scope="col">Beneficiario</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Referencia Pago</th>
                    <th scope="col">Estado</th>
                    {canManageBeneficiaries && <th scope="col">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {paginatedBeneficiaries.items.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={canManageBeneficiaries ? 6 : 5}>
                        {beneficiaries.length === 0
                          ? 'No hay beneficiarios registrados. Registre una persona para asignarle pagos.'
                          : 'No se encontraron beneficiarios que coincidan con la búsqueda o filtro.'}
                      </td>
                    </tr>
                  )}
                  {paginatedBeneficiaries.items.map((b) => (
                    <tr key={b.id}>
                      <td className="nowrap">{b.dni}</td>
                      <td className="table__strong">{b.fullName}</td>
                      <td>{b.email ?? '—'}</td>
                      <td>{b.bankInfo ?? '—'}</td>
                      <td>
                        <span
                          className={`badge ${b.isActive ? 'badge--ok' : 'badge--warn'}`}
                        >
                          {b.isActive ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      {canManageBeneficiaries && (
                        <td>
                          <div className="btn-group">
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => startEditingBeneficiary(b)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className={`btn btn--sm ${b.isActive ? 'btn--danger' : 'btn--ghost'}`}
                              onClick={() => handleToggleBeneficiary(b)}
                            >
                              {b.isActive ? 'Desactivar' : 'Activar'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={paginatedBeneficiaries.currentPage}
              totalPages={paginatedBeneficiaries.totalPages}
              totalItems={paginatedBeneficiaries.totalItems}
              startIndex={paginatedBeneficiaries.startIndex}
              endIndex={paginatedBeneficiaries.endIndex}
              onPageChange={setBeneficiaryPage}
            />
          </div>
        </div>
      </section>

      {/* ASIGNACIONES — RN-SEG-02: el ADMIN no gestiona ni consulta asignaciones */}
      {activeRole !== UserRole.ADMIN && (
        <section className="sheet">
          <div className="sheet__head">
            <div>
              <h2 className="sheet__title">Asignaciones en USD</h2>
              <p className="sheet__hint">
                Un beneficiario puede participar en múltiples proyectos distintos
                a la vez, pero el sistema bloquea asignaciones solapadas dentro
                del mismo proyecto. RN-CAT-04.
              </p>
            </div>
          </div>
          <div className="sheet__body">
            <div className="stack">
              {canEditAssignments && (
                <form onSubmit={handleCreateAssignment} className="form-grid">
                  <div className="field">
                    <label className="field__label" htmlFor="asig-beneficiary">
                      Beneficiario activo
                    </label>
                    <select
                      id="asig-beneficiary"
                      className="select"
                      value={
                        asigBeneficiaryId || activeBeneficiaries[0]?.id || ''
                      }
                      onChange={(e) => setAsigBeneficiaryId(e.target.value)}
                    >
                      {activeBeneficiaries.length === 0 && (
                        <option value="">-- Sin beneficiarios activos --</option>
                      )}
                      {activeBeneficiaries.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.fullName} ({b.dni})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="asig-project">
                      Proyecto activo (vigencia)
                    </label>
                    <select
                      id="asig-project"
                      className="select"
                      value={asigProjectId || activeProjects[0]?.id || ''}
                      onChange={(e) => {
                        const nextProjId = e.target.value;
                        setAsigProjectId(nextProjId);
                        const nextProj = activeProjects.find(
                          (p) => p.id === nextProjId,
                        );
                        if (nextProj) {
                          setAsigStart(toIsoDateSlice(nextProj.startDate));
                          setAsigEnd(toIsoDateSlice(nextProj.endDate));
                        }
                      }}
                    >
                      {activeProjects.length === 0 && (
                        <option value="">-- Sin proyectos activos --</option>
                      )}
                      {activeProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.code} - {p.name} ({toIsoDateSlice(p.startDate)} →{' '}
                          {toIsoDateSlice(p.endDate)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="asig-group">
                      Grupo de pago activo
                    </label>
                    <select
                      id="asig-group"
                      className="select"
                      value={asigGroupId || activePaymentGroups[0]?.id || ''}
                      onChange={(e) => setAsigGroupId(e.target.value)}
                    >
                      {activePaymentGroups.length === 0 && (
                        <option value="">-- Sin grupos activos --</option>
                      )}
                      {activePaymentGroups.map((pg) => (
                        <option key={pg.id} value={pg.id}>
                          {pg.name} ({pg.periodicity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="asig-amount">
                      Monto por período (USD)
                    </label>
                    <input
                      id="asig-amount"
                      className="input"
                      type="number"
                      step="0.01"
                      min="0.01"
                      max="9999999999.99"
                      value={asigAmount}
                      onChange={(e) => setAsigAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="asig-start">
                      Inicio (dentro de vigencia)
                    </label>
                    <input
                      id="asig-start"
                      className="input"
                      type="date"
                      min={asigMinDate}
                      max={asigMaxDate}
                      value={asigStart}
                      onChange={(e) => setAsigStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label className="field__label" htmlFor="asig-end">
                      Fin (dentro de vigencia)
                    </label>
                    <input
                      id="asig-end"
                      className="input"
                      type="date"
                      min={asigStart || asigMinDate}
                      max={asigMaxDate}
                      value={asigEnd}
                      onChange={(e) => setAsigEnd(e.target.value)}
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn"
                    disabled={assignmentAvailability.hasOverlapConflict}
                    title={
                      assignmentAvailability.hasOverlapConflict
                        ? 'El rango elegido se solapa con una asignación activa previa (RN-CAT-04)'
                        : undefined
                    }
                  >
                    + Crear Asignación USD
                  </button>
                  {(assignmentAvailability.occupiedRanges.length > 0 ||
                    assignmentAvailability.hasOverlapConflict) && (
                    <div
                      className={`availability-panel ${assignmentAvailability.hasOverlapConflict ? 'availability-panel--conflict' : ''}`}
                    >
                      <div className="row row--between">
                        <strong>
                          Disponibilidad del beneficiario en este proyecto (RN-CAT-04)
                        </strong>
                        {assignmentAvailability.hasOverlapConflict ? (
                          <span className="badge badge--alert">
                            Traslape detectado en el rango propuesto
                          </span>
                        ) : (
                          <span className="badge badge--ok">
                            Rango disponible sin conflictos
                          </span>
                        )}
                      </div>
                      <div className="row">
                        {assignmentAvailability.occupiedRanges.map((occ) => (
                          <span key={occ.id} className="chip">
                            Ocupado:{' '}
                            <strong>
                              {occ.startDate} → {occ.endDate}
                            </strong>
                          </span>
                        ))}
                      </div>
                      {assignmentAvailability.freeSubRanges.length > 0 ? (
                        <div className="btn-group">
                          {assignmentAvailability.freeSubRanges.map((free) => (
                            <button
                              key={`${free.startDate}-${free.endDate}`}
                              type="button"
                              className="btn btn--ghost btn--sm"
                              onClick={() => {
                                setAsigStart(free.startDate);
                                setAsigEnd(free.endDate);
                              }}
                            >
                              Usar tramo libre ({free.startDate} → {free.endDate})
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="inline-action-box__hint">
                          El beneficiario ya cubre el 100% de la vigencia activa de este proyecto.
                        </p>
                      )}
                    </div>
                  )}
                </form>
              )}

              <TableFilterBar
                searchPlaceholder="Buscar por beneficiario, cédula o proyecto..."
                searchQuery={assignmentSearch}
                onSearchChange={(q) => {
                  setAssignmentSearch(q);
                  setAssignmentPage(1);
                }}
                filterLabel="Proyecto"
                filterValue={assignmentProjectFilter}
                filterOptions={[
                  { label: 'Todos los proyectos', value: 'ALL' },
                  ...projects.map((p) => ({
                    label: `${p.code} — ${p.name}`,
                    value: p.id,
                  })),
                ]}
                onFilterChange={(v) => {
                  setAssignmentProjectFilter(v);
                  setAssignmentPage(1);
                }}
                resultCount={filteredAssignments.length}
                totalCount={assignments.length}
                onReset={() => {
                  setAssignmentSearch('');
                  setAssignmentProjectFilter('');
                  setAssignmentPage(1);
                }}
              />

              <div className="table-scroll">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Beneficiario</th>
                      <th scope="col">Proyecto</th>
                      <th scope="col">Grupo de Pago</th>
                      <th scope="col" className="num">
                        Monto Base (USD)
                      </th>
                      <th scope="col">Vigencia Asignación</th>
                      <th scope="col">Estado</th>
                      {canEditAssignments && <th scope="col">Acción</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssignments.items.length === 0 && (
                      <tr className="table__empty">
                        <td colSpan={canEditAssignments ? 7 : 6}>
                          {assignments.length === 0
                            ? 'No hay asignaciones registradas. Vincule un beneficiario a un proyecto y a un grupo de pago.'
                            : 'No se encontraron asignaciones que coincidan con la búsqueda o filtro.'}
                        </td>
                      </tr>
                    )}
                    {paginatedAssignments.items.map((a) => (
                      <tr key={a.id}>
                        <td className="table__strong">
                          {a.beneficiary?.fullName ?? a.beneficiaryId}
                        </td>
                        <td className="nowrap">
                          {a.project?.code ?? a.projectId}
                        </td>
                        <td>{a.paymentGroup?.name ?? a.paymentGroupId}</td>
                        <td className="num">
                          {formatUsdCurrency(Number(a.amountPerPeriod))}
                        </td>
                        <td className="nowrap">
                          {String(a.startDate).slice(0, 10)} →{' '}
                          {a.endDate
                            ? String(a.endDate).slice(0, 10)
                            : 'Indefinido'}
                        </td>
                        <td>
                          <span
                            className={`badge ${a.isActive ? 'badge--ok' : 'badge--warn'}`}
                          >
                            {a.isActive ? 'ACTIVA' : 'INACTIVA'}
                          </span>
                        </td>
                        {canEditAssignments && (
                          <td>
                            {a.isActive &&
                              (isConfirmationArmed(
                                armedConfirmKey,
                                `DEACTIVATE_ASIG:${a.id}`,
                              ) ? (
                                <div className="inline-action-box">
                                  <span className="inline-action-box__hint">
                                    ¿Desactivar esta asignación?
                                  </span>
                                  <div className="btn-group">
                                    <button
                                      type="button"
                                      className="btn btn--danger btn--sm"
                                      onClick={() =>
                                        handleDeactivateAssignment(a.id)
                                      }
                                    >
                                      Confirmar
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn--ghost btn--sm"
                                      onClick={() => setArmedConfirmKey(null)}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn--danger btn--sm"
                                  onClick={() =>
                                    setArmedConfirmKey(
                                      `DEACTIVATE_ASIG:${a.id}`,
                                    )
                                  }
                                >
                                  Desactivar
                                </button>
                              ))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={paginatedAssignments.currentPage}
                totalPages={paginatedAssignments.totalPages}
                totalItems={paginatedAssignments.totalItems}
                startIndex={paginatedAssignments.startIndex}
                endIndex={paginatedAssignments.endIndex}
                onPageChange={setAssignmentPage}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
