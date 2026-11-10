import React, { useState } from 'react';
import {
  Periodicity,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';
import { formatUsdCurrency } from '../utils/currency.util';

export interface LiveProject {
  id: string;
  code: string;
  name: string;
  area: ProjectArea;
  scope: ProjectScope;
  startDate: string;
  endDate: string;
  budget: string | number;
  status: ProjectStatus;
}

export interface LivePaymentGroup {
  id: string;
  name: string;
  periodicity: Periodicity;
  description?: string | null;
  isActive: boolean;
}

export interface LiveBeneficiary {
  id: string;
  dni: string;
  fullName: string;
  roleTitle?: string;
  email?: string | null;
  phone?: string | null;
  bankReference?: string | null;
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
  const canEditCatalogs =
    activeRole === UserRole.ADMIN || activeRole === UserRole.GENERADOR;
  const canEditAssignments = activeRole === UserRole.GENERADOR;

  // Estado formulario Proyecto
  const [projCode, setProjCode] = useState('PROY-FIS-2026-09');
  const [projName, setProjName] = useState('Fotónica Aplicada FACYT');
  const [projArea, setProjArea] = useState<ProjectArea>(ProjectArea.FISICA);
  const [projScope, setProjScope] = useState<ProjectScope>(ProjectScope.INTERNO);
  const [projStart, setProjStart] = useState('2026-01-01');
  const [projEnd, setProjEnd] = useState('2026-12-31');
  const [projBudget, setProjBudget] = useState('18000.00');

  // Estado formulario Grupo de Pago
  const [pgName, setPgName] = useState('Semanal Asistentes Laboratorio');
  const [pgPeriodicity, setPgPeriodicity] = useState<Periodicity>(
    Periodicity.SEMANAL,
  );
  const [pgDesc, setPgDesc] = useState('Ciclo de 7 días calendario');

  // Estado formulario Beneficiario (RN-SEG-01: sin usuario)
  const [benDni, setBenDni] = useState('V-24111222');
  const [benName, setBenName] = useState('Lic. Gabriela Rojas');
  const [benTitle, setBenTitle] = useState('Investigadora Asociada Biología');
  const [benEmail] = useState('grojas@uc.edu.ve');
  const [benBank, setBenBank] = useState('Zelle / Cuenta USD #9921');

  // Estado formulario Asignación (RN-CAT-04)
  const [asigBeneficiaryId, setAsigBeneficiaryId] = useState('');
  const [asigProjectId, setAsigProjectId] = useState('');
  const [asigGroupId, setAsigGroupId] = useState('');
  const [asigAmount, setAsigAmount] = useState('450.00');
  const [asigStart, setAsigStart] = useState('2026-03-01');
  const [asigEnd, setAsigEnd] = useState('2026-12-31');

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/projects', {
        method: 'POST',
        token,
        body: {
          code: projCode,
          name: projName,
          area: projArea,
          scope: projScope,
          startDate: projStart,
          endDate: projEnd,
          budget: projBudget,
        },
      });
      onNotify('success', `Proyecto '${projCode}' creado correctamente.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
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

  const handleCreatePaymentGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/payment-groups', {
        method: 'POST',
        token,
        body: {
          name: pgName,
          periodicity: pgPeriodicity,
          description: pgDesc,
        },
      });
      onNotify('success', `Grupo de pago '${pgName}' registrado.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCreateBeneficiary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/beneficiaries', {
        method: 'POST',
        token,
        body: {
          dni: benDni,
          fullName: benName,
          roleTitle: benTitle,
          email: benEmail,
          bankReference: benBank,
        },
      });
      onNotify(
        'success',
        `Beneficiario '${benName}' registrado (sin cuenta de usuario según RN-SEG-01).`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetBeneficiary = asigBeneficiaryId || beneficiaries[0]?.id;
    const targetProject = asigProjectId || projects[0]?.id;
    const targetGroup = asigGroupId || paymentGroups[0]?.id;

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
      onNotify('success', 'Asignación desactivada.');
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* SECCIÓN 1: PROYECTOS CIENTÍFICOS */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          1. Proyectos de Investigación FACYT (Física, Química y Biología — RN-CAT-01 / RN-CAT-02)
        </h2>

        {canEditCatalogs && (
          <form onSubmit={handleCreateProject} style={formGridStyle}>
            <input
              value={projCode}
              onChange={(e) => setProjCode(e.target.value)}
              placeholder="Código (ej. PROY-FIS-01)"
              required
              style={inputStyle}
            />
            <input
              value={projName}
              onChange={(e) => setProjName(e.target.value)}
              placeholder="Nombre del Proyecto"
              required
              style={inputStyle}
            />
            <select
              value={projArea}
              onChange={(e) => setProjArea(e.target.value as ProjectArea)}
              style={inputStyle}
            >
              <option value={ProjectArea.FISICA}>FÍSICA</option>
              <option value={ProjectArea.QUIMICA}>QUÍMICA</option>
              <option value={ProjectArea.BIOLOGIA}>BIOLOGÍA</option>
            </select>
            <select
              value={projScope}
              onChange={(e) => setProjScope(e.target.value as ProjectScope)}
              style={inputStyle}
            >
              <option value={ProjectScope.INTERNO}>INTERNO (UC)</option>
              <option value={ProjectScope.EXTERNO}>EXTERNO</option>
            </select>
            <input
              type="date"
              value={projStart}
              onChange={(e) => setProjStart(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={projEnd}
              onChange={(e) => setProjEnd(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="number"
              step="0.01"
              value={projBudget}
              onChange={(e) => setProjBudget(e.target.value)}
              placeholder="Presupuesto USD"
              required
              style={inputStyle}
            />
            <button type="submit" style={primaryButtonStyle}>
              + Crear Proyecto
            </button>
          </form>
        )}

        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Código</th>
              <th style={thStyle}>Nombre</th>
              <th style={thStyle}>Área</th>
              <th style={thStyle}>Ámbito</th>
              <th style={thStyle}>Vigencia</th>
              <th style={thStyle}>Presupuesto</th>
              <th style={thStyle}>Estado</th>
              {canEditCatalogs && <th style={thStyle}>Acciones</th>}
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} style={trStyle}>
                <td style={{ ...tdStyle, fontWeight: 700 }}>{p.code}</td>
                <td style={tdStyle}>{p.name}</td>
                <td style={tdStyle}>{p.area}</td>
                <td style={tdStyle}>{p.scope}</td>
                <td style={tdStyle}>
                  {String(p.startDate).slice(0, 10)} →{' '}
                  {String(p.endDate).slice(0, 10)}
                </td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {formatUsdCurrency(Number(p.budget ?? 0))}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.2rem 0.5rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor:
                        p.status === ProjectStatus.ACTIVO ? '#dcfce7' : '#fee2e2',
                      color:
                        p.status === ProjectStatus.ACTIVO ? '#065f46' : '#991b1b',
                    }}
                  >
                    {p.status}
                  </span>
                </td>
                {canEditCatalogs && (
                  <td style={tdStyle}>
                    <select
                      value={p.status}
                      onChange={(e) =>
                        handleChangeProjectStatus(
                          p.id,
                          e.target.value as ProjectStatus,
                        )
                      }
                      style={{ ...inputStyle, padding: '0.25rem', fontSize: '0.8rem' }}
                    >
                      <option value={ProjectStatus.ACTIVO}>ACTIVO</option>
                      <option value={ProjectStatus.SUSPENDIDO}>SUSPENDIDO</option>
                      <option value={ProjectStatus.FINALIZADO}>FINALIZADO</option>
                    </select>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* SECCIÓN 2: GRUPOS DE PAGO Y BENEFICIARIOS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))', gap: '1.25rem' }}>
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            2. Grupos de Pago y Periodicidades (RN-CAT-03)
          </h2>
          {canEditCatalogs && (
            <form onSubmit={handleCreatePaymentGroup} style={formGridStyle}>
              <input
                value={pgName}
                onChange={(e) => setPgName(e.target.value)}
                placeholder="Nombre del Grupo"
                required
                style={inputStyle}
              />
              <select
                value={pgPeriodicity}
                onChange={(e) => setPgPeriodicity(e.target.value as Periodicity)}
                style={inputStyle}
              >
                <option value={Periodicity.SEMANAL}>SEMANAL</option>
                <option value={Periodicity.QUINCENAL}>QUINCENAL</option>
                <option value={Periodicity.MENSUAL}>MENSUAL</option>
              </select>
              <input
                value={pgDesc}
                onChange={(e) => setPgDesc(e.target.value)}
                placeholder="Descripción"
                style={inputStyle}
              />
              <button type="submit" style={primaryButtonStyle}>
                + Crear Grupo
              </button>
            </form>
          )}
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>Grupo</th>
                <th style={thStyle}>Periodicidad</th>
                <th style={thStyle}>Descripción</th>
              </tr>
            </thead>
            <tbody>
              {paymentGroups.map((pg) => (
                <tr key={pg.id} style={trStyle}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{pg.name}</td>
                  <td style={tdStyle}>
                    <code>{pg.periodicity}</code>
                  </td>
                  <td style={tdStyle}>{pg.description ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>
            3. Beneficiarios (Sin Cuenta de Usuario — RN-SEG-01)
          </h2>
          {canEditCatalogs && (
            <form onSubmit={handleCreateBeneficiary} style={formGridStyle}>
              <input
                value={benDni}
                onChange={(e) => setBenDni(e.target.value)}
                placeholder="Cédula (ej. V-18456789)"
                required
                style={inputStyle}
              />
              <input
                value={benName}
                onChange={(e) => setBenName(e.target.value)}
                placeholder="Nombre Completo"
                required
                style={inputStyle}
              />
              <input
                value={benTitle}
                onChange={(e) => setBenTitle(e.target.value)}
                placeholder="Cargo / Rol en Proyecto"
                required
                style={inputStyle}
              />
              <input
                value={benBank}
                onChange={(e) => setBenBank(e.target.value)}
                placeholder="Datos de Pago / Zelle / Banco"
                style={inputStyle}
              />
              <button type="submit" style={primaryButtonStyle}>
                + Registrar Beneficiario
              </button>
            </form>
          )}
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>Cédula</th>
                <th style={thStyle}>Beneficiario</th>
                <th style={thStyle}>Cargo</th>
                <th style={thStyle}>Referencia Pago</th>
              </tr>
            </thead>
            <tbody>
              {beneficiaries.map((b) => (
                <tr key={b.id} style={trStyle}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{b.dni}</td>
                  <td style={tdStyle}>{b.fullName}</td>
                  <td style={tdStyle}>{b.roleTitle ?? 'Investigador'}</td>
                  <td style={tdStyle}>{b.bankReference ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>

      {/* SECCIÓN 4: ASIGNACIONES CONTRACTUALES EN USD */}
      <section style={cardStyle}>
        <h2 style={sectionTitleStyle}>
          4. Asignaciones Contractuales en USD por Proyecto y Grupo (RN-CAT-04)
        </h2>
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: '#475569' }}>
          Un beneficiario puede participar en múltiples proyectos distintos a la vez, pero el sistema bloquea asignaciones solapadas dentro del mismo proyecto.
        </p>

        {canEditAssignments && (
          <form onSubmit={handleCreateAssignment} style={formGridStyle}>
            <select
              value={asigBeneficiaryId}
              onChange={(e) => setAsigBeneficiaryId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Seleccionar Beneficiario --</option>
              {beneficiaries.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.fullName} ({b.dni})
                </option>
              ))}
            </select>
            <select
              value={asigProjectId}
              onChange={(e) => setAsigProjectId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Seleccionar Proyecto --</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} - {p.name}
                </option>
              ))}
            </select>
            <select
              value={asigGroupId}
              onChange={(e) => setAsigGroupId(e.target.value)}
              style={inputStyle}
            >
              <option value="">-- Seleccionar Grupo de Pago --</option>
              {paymentGroups.map((pg) => (
                <option key={pg.id} value={pg.id}>
                  {pg.name} ({pg.periodicity})
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              value={asigAmount}
              onChange={(e) => setAsigAmount(e.target.value)}
              placeholder="Monto por período (USD)"
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={asigStart}
              onChange={(e) => setAsigStart(e.target.value)}
              required
              style={inputStyle}
            />
            <input
              type="date"
              value={asigEnd}
              onChange={(e) => setAsigEnd(e.target.value)}
              style={inputStyle}
            />
            <button type="submit" style={primaryButtonStyle}>
              + Crear Asignación USD
            </button>
          </form>
        )}

        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>Beneficiario</th>
              <th style={thStyle}>Proyecto</th>
              <th style={thStyle}>Grupo de Pago</th>
              <th style={thStyle}>Monto Base (USD)</th>
              <th style={thStyle}>Vigencia Asignación</th>
              <th style={thStyle}>Estado</th>
              {canEditAssignments && <th style={thStyle}>Acción</th>}
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id} style={trStyle}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>
                  {a.beneficiary?.fullName ?? a.beneficiaryId}
                </td>
                <td style={tdStyle}>
                  <code>{a.project?.code ?? a.projectId}</code>
                </td>
                <td style={tdStyle}>
                  {a.paymentGroup?.name ?? a.paymentGroupId}
                </td>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#0f172a' }}>
                  {formatUsdCurrency(Number(a.amountPerPeriod))}
                </td>
                <td style={tdStyle}>
                  {String(a.startDate).slice(0, 10)} →{' '}
                  {a.endDate ? String(a.endDate).slice(0, 10) : 'Indefinido'}
                </td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.15rem 0.45rem',
                      borderRadius: '0.25rem',
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      backgroundColor: a.isActive ? '#dcfce7' : '#f1f5f9',
                      color: a.isActive ? '#065f46' : '#64748b',
                    }}
                  >
                    {a.isActive ? 'ACTIVA' : 'INACTIVA'}
                  </span>
                </td>
                {canEditAssignments && (
                  <td style={tdStyle}>
                    {a.isActive && (
                      <button
                        type="button"
                        onClick={() => handleDeactivateAssignment(a.id)}
                        style={dangerOutlineButtonStyle}
                      >
                        Desactivar
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '1.15rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: '0 0 0.75rem',
  fontSize: '1.08rem',
  color: '#0f172a',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))',
  gap: '0.6rem',
  marginBottom: '1rem',
  padding: '0.75rem',
  backgroundColor: '#f8fafc',
  borderRadius: '0.4rem',
  border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  padding: '0.45rem 0.6rem',
  borderRadius: '0.35rem',
  border: '1px solid #94a3b8',
  fontSize: '0.85rem',
};

const primaryButtonStyle: React.CSSProperties = {
  padding: '0.5rem 0.85rem',
  borderRadius: '0.35rem',
  border: 'none',
  backgroundColor: '#1e3a8a',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.85rem',
  cursor: 'pointer',
};

const dangerOutlineButtonStyle: React.CSSProperties = {
  padding: '0.25rem 0.55rem',
  borderRadius: '0.3rem',
  border: '1px solid #dc2626',
  backgroundColor: '#fef2f2',
  color: '#b91c1c',
  fontSize: '0.78rem',
  fontWeight: 600,
  cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.86rem',
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  textAlign: 'left',
  borderBottom: '2px solid #cbd5e1',
};

const thStyle: React.CSSProperties = {
  padding: '0.55rem',
  color: '#334155',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: React.CSSProperties = {
  padding: '0.55rem',
};
