import React, { useState } from 'react';
import { UserRole } from '../types/domain.types';
import { apiRequest } from '../utils/api-client.util';

export interface LiveUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
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
  auditLogs: LiveAuditRecord[];
  onRefresh: () => Promise<void>;
  onNotify: (type: 'success' | 'error', message: string) => void;
}

export function UsersAndAuditWorkspace({
  token,
  activeRole,
  users,
  auditLogs,
  onRefresh,
  onNotify,
}: UsersAndAuditProps): React.ReactElement {
  const isAdmin = activeRole === UserRole.ADMIN;

  const [newEmail, setNewEmail] = useState('auditor.facyt@uc.edu.ve');
  const [newName, setNewName] = useState('Lic. Ricardo Gómez (FACYT)');
  const [newPassword, setNewPassword] = useState('PasswordUC2026!');
  const [newRole, setNewRole] = useState<UserRole>(UserRole.GENERADOR);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
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
      await onRefresh();
    } catch (err) {
      onNotify('error', (err as Error).message);
    }
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {isAdmin && (
        <section style={cardStyle}>
          <h2 style={{ margin: '0 0 0.6rem', fontSize: '1.08rem', color: '#0f172a' }}>
            1. Administración de Usuarios y Segregación de Roles (Exclusivo ADMIN — RN-SEG-04)
          </h2>
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.84rem', color: '#475569' }}>
            El Administrador gestiona cuentas del sistema pero tiene prohibido ejecutar causaciones, solicitudes, pagos o movimientos de caja chica.
          </p>

          <form onSubmit={handleCreateUser} style={formGridStyle}>
            <input
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="Correo institucional"
              required
              style={inputStyle}
            />
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre completo"
              required
              style={inputStyle}
            />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Contraseña segura"
              required
              style={inputStyle}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value as UserRole)}
              style={inputStyle}
            >
              <option value={UserRole.ADMIN}>ADMIN (Administrador)</option>
              <option value={UserRole.GENERADOR}>GENERADOR (Coordinador)</option>
              <option value={UserRole.RECEPTOR}>RECEPTOR (Gerencia)</option>
            </select>
            <button type="submit" style={primaryButtonStyle}>
              + Crear Usuario
            </button>
          </form>

          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>Nombre</th>
                <th style={thStyle}>Correo</th>
                <th style={thStyle}>Rol RBAC</th>
                <th style={thStyle}>Estado</th>
                <th style={thStyle}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={trStyle}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{u.fullName}</td>
                  <td style={tdStyle}>{u.email}</td>
                  <td style={tdStyle}>
                    <code>{u.role}</code>
                  </td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: '0.18rem 0.5rem',
                        borderRadius: '0.25rem',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: u.isActive ? '#dcfce7' : '#fee2e2',
                        color: u.isActive ? '#065f46' : '#991b1b',
                      }}
                    >
                      {u.isActive ? 'ACTIVO' : 'INACTIVO'}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    <button
                      type="button"
                      onClick={() => handleToggleUserStatus(u.id, u.isActive)}
                      style={secondaryButtonStyle}
                    >
                      {u.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section
        style={{
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          padding: '1.15rem',
          borderRadius: '0.5rem',
          border: '1px solid #334155',
        }}
      >
        <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.08rem', color: '#38bdf8' }}>
          2. Bitácora Forense Inmutable — Tabla audit_log (RN-AUD-03)
        </h2>
        <p style={{ margin: '0 0 0.85rem', fontSize: '0.82rem', color: '#94a3b8' }}>
          Registro automático append-only en PostgreSQL con instantáneas JSONB previas y nuevas.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
          {auditLogs.map((log) => (
            <div
              key={log.id}
              style={{
                padding: '0.65rem 0.8rem',
                backgroundColor: '#1e293b',
                borderRadius: '0.4rem',
                border: '1px solid #334155',
                fontSize: '0.82rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div>
                  <strong style={{ color: '#38bdf8' }}>[{log.action}]</strong>{' '}
                  · Tabla: <code>{log.tableName}</code> · ID Registro:{' '}
                  <code>{log.recordId}</code>
                </div>
                <div style={{ color: '#cbd5e1' }}>
                  Rol: <code>{log.userRole ?? 'SISTEMA'}</code> ·{' '}
                  {String(log.createdAt).slice(0, 19).replace('T', ' ')} UTC
                </div>
              </div>
              {Boolean(log.oldValues || log.newValues) && (
                <div
                  style={{
                    marginTop: '0.4rem',
                    fontFamily: 'monospace',
                    fontSize: '0.76rem',
                    color: '#cbd5e1',
                    wordBreak: 'break-all',
                  }}
                >
                  {log.oldValues ? (
                    <span>
                      Antes: {JSON.stringify(log.oldValues)} →{' '}
                    </span>
                  ) : null}
                  {log.newValues ? (
                    <span style={{ color: '#86efac' }}>
                      Nuevo: {JSON.stringify(log.newValues)}
                    </span>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  backgroundColor: '#ffffff',
  padding: '1.15rem',
  borderRadius: '0.5rem',
  border: '1px solid #cbd5e1',
};

const formGridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
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
  padding: '0.45rem 0.75rem',
  borderRadius: '0.35rem',
  border: 'none',
  backgroundColor: '#1e3a8a',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: '0.82rem',
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.3rem 0.6rem',
  borderRadius: '0.3rem',
  border: '1px solid #1e40af',
  backgroundColor: '#eff6ff',
  color: '#1e3a8a',
  fontWeight: 600,
  fontSize: '0.78rem',
  cursor: 'pointer',
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: '0.85rem',
};

const theadRowStyle: React.CSSProperties = {
  backgroundColor: '#f1f5f9',
  textAlign: 'left',
  borderBottom: '2px solid #cbd5e1',
};

const thStyle: React.CSSProperties = {
  padding: '0.5rem',
  color: '#334155',
};

const trStyle: React.CSSProperties = {
  borderBottom: '1px solid #e2e8f0',
};

const tdStyle: React.CSSProperties = {
  padding: '0.5rem',
};
