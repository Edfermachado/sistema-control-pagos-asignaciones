import React, { useEffect, useState } from 'react';
import { UserRole } from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';
import { TableFilterBar } from './TableFilterBar';
import { TablePagination } from './TablePagination';
import {
  filterTableByProperty,
  paginateTableItems,
  searchTableItems,
} from '../utils/table-filter.util';

export interface LiveUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
}

export interface LiveSystemParameter {
  id: string;
  key: string;
  value: string;
  description: string;
  updatedAt?: string;
}

export interface LiveAuditRecord {
  id: string;
  userId?: string | null;
  userRole?: string | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: unknown;
  newValues?: unknown;
  createdAt: string;
  user?: { fullName: string; email: string } | null;
}

interface UsersAndAuditProps {
  token: string | null;
  activeRole: UserRole;
  users: LiveUser[];
  parameters: LiveSystemParameter[];
  auditLogs: LiveAuditRecord[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function UsersAndAuditWorkspace({
  token,
  activeRole,
  users,
  parameters,
  auditLogs,
  onRefresh,
  onNotify,
}: UsersAndAuditProps): React.ReactElement {
  const isAdmin = activeRole === UserRole.ADMIN;

  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newEmail, setNewEmail] = useState('auditor.facyt@uc.edu.ve');
  const [newName, setNewName] = useState('Lic. Ricardo Gómez (FACYT)');
  const [newPassword, setNewPassword] = useState('PasswordUC2026!');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.GENERADOR);

  const [paramKey, setParamKey] = useState('NEW_PARAMETER');
  const [paramValue, setParamValue] = useState('valor');
  const [paramDescription, setParamDescription] = useState(
    'Descripción del parámetro global',
  );
  const [parameterValues, setParameterValues] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    setParameterValues(
      Object.fromEntries(parameters.map((parameter) => [parameter.id, parameter.value])),
    );
  }, [parameters]);

  // Estados para filtrado y paginación de usuarios
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [userPage, setUserPage] = useState(1);

  // Estados para filtrado y paginación de auditoría
  const [auditSearch, setAuditSearch] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditPage, setAuditPage] = useState(1);

  // Usuarios filtrados y paginados
  const filteredUsersByRole = filterTableByProperty(
    users,
    'role',
    userRoleFilter as UserRole | '',
  );
  const filteredUsers = searchTableItems(
    filteredUsersByRole,
    userSearch,
    ['email', 'fullName', 'role'],
  );
  const paginatedUsers = paginateTableItems(
    filteredUsers,
    userPage,
    8,
  );

  // Auditoría filtrada y paginada
  const DB_TRIGGER_ACTIONS = ['INSERT', 'UPDATE', 'DELETE'];
  const filteredAuditByAction =
    auditActionFilter === 'BUSINESS_ONLY'
      ? auditLogs.filter((log) => !DB_TRIGGER_ACTIONS.includes(log.action))
      : auditActionFilter === 'DB_TRIGGERS'
        ? auditLogs.filter((log) => DB_TRIGGER_ACTIONS.includes(log.action))
        : filterTableByProperty(auditLogs, 'action', auditActionFilter);
  const filteredAuditLogs = searchTableItems(
    filteredAuditByAction,
    auditSearch,
    [
      'tableName',
      'recordId',
      'action',
      'userRole',
      (log) => log.user?.fullName,
      (log) => log.user?.email,
    ],
  );
  const paginatedAuditLogs = paginateTableItems(
    filteredAuditLogs,
    auditPage,
    12,
  );

  const handleCreateParameter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiRequest('/parameters', {
        method: 'POST',
        token,
        body: {
          key: paramKey,
          value: paramValue,
          description: paramDescription,
        },
      });
      onNotify('success', `Parámetro '${paramKey}' creado.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleUpdateParameter = async (parameter: LiveSystemParameter) => {
    try {
      await apiRequest(`/parameters/${parameter.id}`, {
        method: 'PATCH',
        token,
        body: {
          value: parameterValues[parameter.id] ?? parameter.value,
          description: parameter.description,
        },
      });
      onNotify('success', `Parámetro '${parameter.key}' actualizado.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleDeleteParameter = async (parameter: LiveSystemParameter) => {
    try {
      await apiRequest(`/parameters/${parameter.id}`, {
        method: 'DELETE',
        token,
      });
      onNotify('success', `Parámetro '${parameter.key}' eliminado.`);
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingUserId) {
        await apiRequest(`/users/${editingUserId}`, {
          method: 'PATCH',
          token,
          body: {
            fullName: newName,
            role: newRole,
            ...(newPassword.trim() ? { password: newPassword.trim() } : {}),
          },
        });
        onNotify('success', `Usuario '${newEmail}' actualizado.`);
        setEditingUserId(null);
        setNewEmail('auditor.facyt@uc.edu.ve');
        setNewName('Lic. Ricardo Gómez (FACYT)');
        setNewPassword('PasswordUC2026!');
        setNewRole(UserRole.GENERADOR);
      } else {
        await apiRequest('/users', {
          method: 'POST',
          token,
          body: {
            email: newEmail,
            fullName: newName,
            password: newPassword,
            role: newRole,
          },
        });
        onNotify('success', `Usuario '${newEmail}' creado con rol ${newRole}.`);
      }
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  const startEditingUser = (user: LiveUser) => {
    setEditingUserId(user.id);
    setNewEmail(user.email);
    setNewName(user.fullName);
    setNewRole(user.role);
    setNewPassword('');
  };

  const cancelEditingUser = () => {
    setEditingUserId(null);
    setNewEmail('auditor.facyt@uc.edu.ve');
    setNewName('Lic. Ricardo Gómez (FACYT)');
    setNewRole(UserRole.GENERADOR);
    setNewPassword('PasswordUC2026!');
  };

  const handleToggleUserStatus = async (userId: string, isActive: boolean) => {
    try {
      await apiRequest(`/users/${userId}/status`, {
        method: 'PATCH',
        token,
        body: { isActive: !isActive },
      });
      onNotify(
        'success',
        `Estado del usuario actualizado a ${!isActive ? 'ACTIVO' : 'INACTIVO'}.`,
      );
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
  };

  return (
    <div className="stack stack--lg">
      {isAdmin && (
        <section className="sheet">
          <div className="sheet__head">
            <div>
              <h2 className="sheet__title">
                Administración de usuarios y segregación de roles
              </h2>
              <p className="sheet__hint">
                El administrador gestiona cuentas del sistema, pero tiene
                prohibido ejecutar causaciones, solicitudes, pagos o movimientos
                de caja chica. Exclusivo ADMIN — RN-SEG-02.
              </p>
            </div>
          </div>
          <div className="sheet__body">
            <form className="form-grid" onSubmit={handleSaveUser}>
              <div className="field">
                <label className="field__label" htmlFor="user-email">
                  Correo institucional
                </label>
                <input
                  id="user-email"
                  className="input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Correo institucional"
                  disabled={Boolean(editingUserId)}
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="user-name">
                  Nombre completo
                </label>
                <input
                  id="user-name"
                  className="input"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nombre completo"
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="user-role">
                  Rol
                </label>
                <select
                  id="user-role"
                  className="select"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                >
                  <option value={UserRole.ADMIN}>ADMIN (Administrador)</option>
                  <option value={UserRole.GENERADOR}>
                    GENERADOR (Coordinador)
                  </option>
                  <option value={UserRole.RECEPTOR}>RECEPTOR (Gerencia)</option>
                </select>
              </div>
              <div className="field">
                <label className="field__label" htmlFor="user-password">
                  {editingUserId
                    ? 'Nueva contraseña (opcional)'
                    : 'Contraseña'}
                </label>
                <input
                  id="user-password"
                  className="input"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder={
                    editingUserId
                      ? 'Dejar vacío para conservar la actual'
                      : 'Contraseña segura'
                  }
                  required={!editingUserId}
                />
              </div>
              <div className="btn-group">
                <button type="submit" className="btn">
                  {editingUserId ? 'Actualizar Usuario' : '+ Crear Usuario'}
                </button>
                {editingUserId && (
                  <button
                    type="button"
                    className="btn btn--ghost"
                    onClick={cancelEditingUser}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </form>

            <TableFilterBar
              searchPlaceholder="Buscar por correo o nombre..."
              searchQuery={userSearch}
              onSearchChange={(q) => {
                setUserSearch(q);
                setUserPage(1);
              }}
              filterLabel="Rol"
              filterValue={userRoleFilter}
              filterOptions={[
                { label: 'Todos los roles', value: 'ALL' },
                { label: 'Administrador (ADMIN)', value: UserRole.ADMIN },
                { label: 'Generador (GENERADOR)', value: UserRole.GENERADOR },
                { label: 'Receptor (RECEPTOR)', value: UserRole.RECEPTOR },
              ]}
              onFilterChange={(v) => {
                setUserRoleFilter(v);
                setUserPage(1);
              }}
              resultCount={filteredUsers.length}
              totalCount={users.length}
              onReset={() => {
                setUserSearch('');
                setUserRoleFilter('');
                setUserPage(1);
              }}
            />

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Correo</th>
                    <th scope="col">Nombre</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.items.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={5}>
                        {users.length === 0
                          ? 'Sin usuarios registrados. Use el formulario de alta para crear la primera cuenta.'
                          : 'No se encontraron usuarios que coincidan con la búsqueda o filtro.'}
                      </td>
                    </tr>
                  )}
                  {paginatedUsers.items.map((u) => (
                    <tr key={u.id}>
                      <td className="nowrap">{u.email}</td>
                      <td className="table__strong">{u.fullName}</td>
                      <td>{u.role}</td>
                      <td>
                        <span
                          className={`badge ${
                            u.isActive ? 'badge--ok' : 'badge--alert'
                          }`}
                        >
                          {u.isActive ? 'ACTIVO' : 'INACTIVO'}
                        </span>
                      </td>
                      <td>
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() => startEditingUser(u)}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn--ghost btn--sm"
                            onClick={() =>
                              handleToggleUserStatus(u.id, u.isActive)
                            }
                          >
                            {u.isActive ? 'Desactivar' : 'Activar'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={paginatedUsers.currentPage}
              totalPages={paginatedUsers.totalPages}
              totalItems={paginatedUsers.totalItems}
              startIndex={paginatedUsers.startIndex}
              endIndex={paginatedUsers.endIndex}
              onPageChange={setUserPage}
            />
          </div>
        </section>
      )}

      {isAdmin && (
        <section className="sheet">
          <div className="sheet__head">
            <div>
              <h2 className="sheet__title">Parámetros globales del sistema</h2>
              <p className="sheet__hint">
                Configuración clave-valor que gobierna las reglas operativas del
                sistema. Exclusivo ADMIN — RF 2.1.
              </p>
            </div>
          </div>
          <div className="sheet__body">
            <form className="form-row" onSubmit={handleCreateParameter}>
              <div className="field">
                <label className="field__label" htmlFor="parameter-key">
                  Clave
                </label>
                <input
                  id="parameter-key"
                  className="input"
                  value={paramKey}
                  onChange={(e) => setParamKey(e.target.value)}
                  placeholder="CLAVE_PARAMETRO"
                  required
                />
              </div>
              <div className="field">
                <label className="field__label" htmlFor="parameter-value">
                  Valor
                </label>
                <input
                  id="parameter-value"
                  className="input"
                  value={paramValue}
                  onChange={(e) => setParamValue(e.target.value)}
                  placeholder="Valor"
                  required
                />
              </div>
              <div className="field">
                <label
                  className="field__label"
                  htmlFor="parameter-description"
                >
                  Descripción
                </label>
                <input
                  id="parameter-description"
                  className="input"
                  value={paramDescription}
                  onChange={(e) => setParamDescription(e.target.value)}
                  placeholder="Descripción"
                  required
                />
              </div>
              <button type="submit" className="btn">
                + Crear Parámetro
              </button>
            </form>

            <div className="table-scroll">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Clave</th>
                    <th scope="col">Valor</th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.length === 0 && (
                    <tr className="table__empty">
                      <td colSpan={4}>
                        Sin parámetros globales. Registre uno con el formulario
                        de alta.
                      </td>
                    </tr>
                  )}
                  {parameters.map((parameter) => (
                    <tr key={parameter.id}>
                      <td className="nowrap">
                        <code>{parameter.key}</code>
                      </td>
                      <td>
                        <input
                          className="input"
                          value={
                            parameterValues[parameter.id] ?? parameter.value
                          }
                          onChange={(e) =>
                            setParameterValues((current) => ({
                              ...current,
                              [parameter.id]: e.target.value,
                            }))
                          }
                        />
                      </td>
                      <td>{parameter.description}</td>
                      <td>
                        <div className="btn-group">
                          <button
                            type="button"
                            className="btn btn--sm"
                            onClick={() => handleUpdateParameter(parameter)}
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="btn btn--danger btn--sm"
                            onClick={() => handleDeleteParameter(parameter)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <section className="sheet">
        <div className="sheet__head">
          <div>
            <h2 className="sheet__title">Bitácora de auditoría</h2>
            <p className="sheet__hint">
              Registro automático append-only en PostgreSQL con instantáneas
              JSONB previas y nuevas. RN-AUD-03.
            </p>
          </div>
        </div>
        <div className="sheet__body sheet__body--flush">
          <TableFilterBar
            searchPlaceholder="Buscar por tabla, ID de registro, acción o usuario..."
            searchQuery={auditSearch}
            onSearchChange={(q) => {
              setAuditSearch(q);
              setAuditPage(1);
            }}
            filterLabel="Acción"
            filterValue={auditActionFilter}
            filterOptions={[
              { label: 'Todas las acciones', value: 'ALL' },
              { label: 'Acciones de negocio (con autor)', value: 'BUSINESS_ONLY' },
              { label: 'Triggers SQL (INSERT/UPDATE/DELETE)', value: 'DB_TRIGGERS' },
              { label: 'INSERT (Creación)', value: 'INSERT' },
              { label: 'UPDATE (Modificación)', value: 'UPDATE' },
              { label: 'DELETE (Eliminación)', value: 'DELETE' },
            ]}
            onFilterChange={(v) => {
              setAuditActionFilter(v);
              setAuditPage(1);
            }}
            resultCount={filteredAuditLogs.length}
            totalCount={auditLogs.length}
            onReset={() => {
              setAuditSearch('');
              setAuditActionFilter('');
              setAuditPage(1);
            }}
          />

          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Usuario</th>
                  <th scope="col">Rol</th>
                  <th scope="col">Acción</th>
                  <th scope="col">Tabla</th>
                  <th scope="col">Registro</th>
                </tr>
              </thead>
              <tbody>
                {paginatedAuditLogs.items.length === 0 && (
                  <tr className="table__empty">
                    <td colSpan={6}>
                      {auditLogs.length === 0
                        ? 'Sin registros de auditoría. Las operaciones sobre la base de datos quedarán registradas aquí.'
                        : 'No se encontraron registros de auditoría que coincidan con la búsqueda o filtro.'}
                    </td>
                  </tr>
                )}
                {paginatedAuditLogs.items.map((log) => (
                  <tr key={log.id}>
                    <td className="nowrap">
                      {String(log.createdAt).slice(0, 19).replace('T', ' ')} UTC
                    </td>
                    <td>{log.user?.fullName ?? log.user?.email ?? '—'}</td>
                    <td>{log.userRole ?? 'SISTEMA'}</td>
                    <td className="table__strong">{log.action}</td>
                    <td className="nowrap">
                      <code>{log.tableName}</code>
                    </td>
                    <td className="nowrap">
                      <code>{log.recordId}</code>
                      {Boolean(log.oldValues || log.newValues) && (
                        <details>
                          <summary>Cambios</summary>
                          <pre>
                            {[
                              log.oldValues
                                ? `Antes: ${JSON.stringify(
                                    log.oldValues,
                                    null,
                                    2,
                                  )}`
                                : '',
                              log.newValues
                                ? `Nuevo: ${JSON.stringify(
                                    log.newValues,
                                    null,
                                    2,
                                  )}`
                                : '',
                            ]
                              .filter(Boolean)
                              .join('\n\n')}
                          </pre>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <TablePagination
            currentPage={paginatedAuditLogs.currentPage}
            totalPages={paginatedAuditLogs.totalPages}
            totalItems={paginatedAuditLogs.totalItems}
            startIndex={paginatedAuditLogs.startIndex}
            endIndex={paginatedAuditLogs.endIndex}
            onPageChange={setAuditPage}
          />
        </div>
      </section>
    </div>
  );
}
