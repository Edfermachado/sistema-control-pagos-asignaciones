import React, { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  canAccessWorkspace,
  findWorkspaceByPath,
  firstAllowedPath,
  visibleWorkspaces,
} from '../routes/workspaces';
import { UserRole } from '../types/domain.types';
import { getRoleDisplayLabel } from '../utils/rbac.util';

function getInitials(text: string): string {
  if (!text) return 'UC';
  const parts = text.split(/[@._\s-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return text.slice(0, 2).toUpperCase();
}

export function AppShell(): React.ReactElement {
  const {
    activeRole,
    currentUserEmail,
    isConnectedToApi,
    loginAsRole,
    logout,
    notification,
    clearNotification,
    notify,
    refreshData,
  } = useWorkspace();
  const location = useLocation();
  const navigate = useNavigate();
  const [isSwitchingRole, setIsSwitchingRole] = useState(false);

  const workspace = findWorkspaceByPath(location.pathname);
  const navigationItems = visibleWorkspaces(activeRole);
  const deniedMessage = (location.state as { denied?: string } | null)?.denied;

  const currentDateFormatted = new Date().toLocaleDateString('es-VE', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  useEffect(() => {
    if (deniedMessage) {
      notify('error', deniedMessage);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [deniedMessage, notify, navigate, location.pathname]);

  const handleRoleChange = async (role: UserRole): Promise<void> => {
    if (role === activeRole) {
      return;
    }
    setIsSwitchingRole(true);
    const error = await loginAsRole(role);
    setIsSwitchingRole(false);
    if (error) {
      notify('error', error);
      return;
    }
    const current = findWorkspaceByPath(location.pathname);
    if (!current || !canAccessWorkspace(current, role)) {
      navigate(firstAllowedPath(role), { replace: true });
    }
  };

  const handleLogout = (): void => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="shell">
      <aside className="rail">
        <div className="rail__top">
          <div className="brand">
            <div className="brand__badge">UC</div>
            <div className="brand__info">
              <Link to="/resumen" className="brand__name">
                CONTROL DE PAGOS
              </Link>
              <span className="brand__sub">FACYT · CIENCIAS Y TECNOLOGÍA</span>
            </div>
          </div>

          <nav className="nav" aria-label="Espacios de trabajo">
            <span className="nav__label">Menú de Navegación</span>
            {navigationItems.map((item) => (
              <NavLink
                key={item.key}
                to={item.path}
                className="nav__item"
                aria-current={workspace?.key === item.key ? 'page' : undefined}
              >
                <span className="material-symbols-outlined nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="nav__text">{item.navLabel}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="rail__foot">
          <div className="rail__status-card">
            <div className="rail__status-header">
              <span className="rail__status-label">Base de Datos</span>
              <span
                className={`rail__status-badge ${
                  isConnectedToApi
                    ? 'rail__status-badge--ok'
                    : 'rail__status-badge--warn'
                }`}
              >
                <span className="rail__status-dot" aria-hidden="true"></span>
                {isConnectedToApi ? 'En Línea' : 'Sin conexión'}
              </span>
            </div>
            <p className="rail__status-tech">PostgreSQL · Multi-Tenant UC</p>
          </div>

          <div className="rail__user-card">
            <div className="rail__user-avatar" title={currentUserEmail}>
              {getInitials(currentUserEmail || activeRole)}
            </div>
            <div className="rail__user-info">
              <span className="rail__user-name" title={currentUserEmail}>
                {currentUserEmail || 'Usuario'}
              </span>
              <span className="rail__user-role">
                {getRoleDisplayLabel(activeRole)}
              </span>
            </div>
            <button
              type="button"
              className="rail__user-logout"
              onClick={handleLogout}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
            >
              <span className="material-symbols-outlined">logout</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="ws-head">
          <div className="ws-head__main">
            <div className="ws-head__title-row">
              <h1 className="ws-title">{workspace?.title ?? 'Espacio de trabajo'}</h1>
              <span className="ws-scope-badge">Producción USD · FACYT</span>
            </div>
            <p className="ws-lead">{workspace?.lead}</p>
          </div>

          <div className="ws-tools">
            <div className="ws-date-chip">
              <span className="material-symbols-outlined">calendar_today</span>
              <span>{currentDateFormatted}</span>
            </div>

            <label className="field field--inline" htmlFor="role-select">
              <span className="field__label">Rol</span>
              <select
                id="role-select"
                className="select"
                value={activeRole}
                disabled={isSwitchingRole}
                onChange={(e) => void handleRoleChange(e.target.value as UserRole)}
              >
                <option value={UserRole.GENERADOR}>GENERADOR — Coordinador</option>
                <option value={UserRole.RECEPTOR}>RECEPTOR — Gerencia</option>
                <option value={UserRole.ADMIN}>ADMIN — Administrador</option>
              </select>
            </label>

            <button
              type="button"
              className="btn btn--secondary btn--sm"
              onClick={() => void refreshData()}
              title="Actualizar datos desde el servidor"
            >
              <span className="material-symbols-outlined">sync</span>
              <span>Actualizar</span>
            </button>

            <button
              type="button"
              className="btn btn--ghost btn--sm"
              onClick={handleLogout}
              title="Cerrar sesión activa"
            >
              <span className="material-symbols-outlined">logout</span>
              <span>Salir</span>
            </button>
          </div>
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
                onClick={clearNotification}
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          )}

          <Outlet />
        </div>
      </div>
    </div>
  );
}
