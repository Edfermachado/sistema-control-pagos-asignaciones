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

  useEffect(() => {
    if (deniedMessage) {
      notify('error', deniedMessage);
      navigate(location.pathname, { replace: true, state: null });
    }
    // Se consume una sola vez el aviso de acceso denegado que deja el guard de rutas.
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
        <div className="brand">
          <p className="brand__org">
            Universidad de Carabobo
            <br />
            FACYT · Ciencias y Tecnología
          </p>
          <Link to="/resumen" className="brand__name">
            Control de Pagos
          </Link>
          <p className="brand__sub">
            Asignaciones en USD · Sistemas de Información
          </p>
        </div>

        <nav className="nav" aria-label="Espacios de trabajo">
          <p className="nav__label">Espacios de trabajo</p>
          {navigationItems.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              className="nav__item"
              aria-current={workspace?.key === item.key ? 'page' : undefined}
            >
              <span className="nav__index" aria-hidden="true">
                {item.index}
              </span>
              <span>{item.navLabel}</span>
            </NavLink>
          ))}
        </nav>

        <div className="rail__foot">
          <div>
            <div className="rail__foot-label">Sesión activa</div>
            <div className="rail__session">{currentUserEmail}</div>
            <div className="rail__role-tag">{getRoleDisplayLabel(activeRole)}</div>
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
            <h1 className="ws-title">{workspace?.title ?? 'Espacio de trabajo'}</h1>
            <p className="ws-lead">{workspace?.lead}</p>
          </div>

          <div className="ws-tools">
            <span
              className={`badge ${isConnectedToApi ? 'badge--ok' : 'badge--warn'}`}
              title={
                isConnectedToApi
                  ? 'Sesión JWT activa contra la API y PostgreSQL'
                  : 'Sin respuesta de la API'
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
                disabled={isSwitchingRole}
                onChange={(e) => void handleRoleChange(e.target.value as UserRole)}
              >
                <option value={UserRole.GENERADOR}>GENERADOR — Coordinador</option>
                <option value={UserRole.RECEPTOR}>RECEPTOR — Gerencia</option>
                <option value={UserRole.ADMIN}>ADMIN — Administrador</option>
              </select>
            </label>
            <div className="btn-group">
              <button
                type="button"
                className="btn btn--sm"
                onClick={() => void refreshData()}
              >
                Actualizar datos
              </button>
              <button
                type="button"
                className="btn btn--ghost btn--sm"
                onClick={handleLogout}
              >
                Cerrar sesión
              </button>
            </div>
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
