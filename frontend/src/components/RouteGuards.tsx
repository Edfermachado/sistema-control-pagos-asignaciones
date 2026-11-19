import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWorkspace } from '../context/WorkspaceContext';
import {
  canAccessWorkspace,
  findWorkspaceByPath,
  firstAllowedPath,
  LOGIN_PATH,
} from '../routes/workspaces';

/** Pantalla de espera mientras se restaura la sesión de la pestaña. */
export function BootScreen(): React.ReactElement {
  return (
    <div className="app-boot">
      <div className="sheet app-boot__card">
        <div className="sheet__body">
          <p className="sheet__title">Abriendo sesión</p>
          <p className="sheet__hint">Verificando la sesión de esta pestaña…</p>
        </div>
      </div>
    </div>
  );
}

/** Exige sesión activa; sin token redirige al portal de acceso. */
export function RequireSession({
  children,
}: {
  children: React.ReactElement;
}): React.ReactElement {
  const { token, isBootstrapping } = useWorkspace();
  const location = useLocation();

  if (isBootstrapping) {
    return <BootScreen />;
  }

  if (!token) {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }

  return children;
}

/** Exige que el rol activo pueda abrir la ruta actual (RN-SEG-02). */
export function RequireWorkspaceAccess({
  children,
}: {
  children: React.ReactElement;
}): React.ReactElement {
  const { activeRole, isBootstrapping } = useWorkspace();
  const location = useLocation();
  const workspace = findWorkspaceByPath(location.pathname);
  const allowed = workspace ? canAccessWorkspace(workspace, activeRole) : false;

  if (isBootstrapping) {
    return <BootScreen />;
  }

  if (!allowed) {
    const target = firstAllowedPath(activeRole);
    const denied = workspace
      ? `[RN-SEG-02] El rol ${activeRole} no tiene acceso al espacio "${workspace.navLabel}". Se abrió el primer espacio permitido.`
      : `[RN-SEG-02] La ruta "${location.pathname}" no existe para su rol. Se abrió el primer espacio permitido.`;
    return <Navigate to={target} replace state={{ denied }} />;
  }

  return children;
}
