import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import {
  BootScreen,
  RequireSession,
  RequireWorkspaceAccess,
} from './components/RouteGuards';
import { useWorkspace, WorkspaceProvider } from './context/WorkspaceContext';
import { AuditoriaPage } from './pages/AuditoriaPage';
import { CajasPage } from './pages/CajasPage';
import { CatalogosPage } from './pages/CatalogosPage';
import { LoginPage } from './pages/LoginPage';
import { MotorPage } from './pages/MotorPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ResumenPage } from './pages/ResumenPage';
import {
  firstAllowedPath,
  LOGIN_PATH,
  WORKSPACES,
  type WorkspaceKey,
} from './routes/workspaces';

/** Una página por espacio de trabajo; las rutas se generan desde `WORKSPACES`. */
const PAGE_BY_WORKSPACE: Record<WorkspaceKey, React.ReactElement> = {
  RESUMEN: <ResumenPage />,
  CATALOGOS: <CatalogosPage />,
  MOTOR_FINANCIERO: <MotorPage />,
  CAJA_CHICA: <CajasPage />,
  AUDITORIA: <AuditoriaPage />,
};

/** La raíz redirige al primer espacio permitido del rol, o al acceso si no hay sesión. */
function IndexRedirect(): React.ReactElement {
  const { token, activeRole, isBootstrapping } = useWorkspace();

  if (isBootstrapping) {
    return <BootScreen />;
  }

  return <Navigate to={token ? firstAllowedPath(activeRole) : LOGIN_PATH} replace />;
}

export function App(): React.ReactElement {
  return (
    <BrowserRouter>
      <WorkspaceProvider>
        <Routes>
          <Route path={LOGIN_PATH} element={<LoginPage />} />
          <Route path="/" element={<IndexRedirect />} />

          <Route
            element={
              <RequireSession>
                <AppShell />
              </RequireSession>
            }
          >
            {WORKSPACES.map((workspace) => (
              <Route
                key={workspace.key}
                path={workspace.path}
                element={
                  <RequireWorkspaceAccess>
                    {PAGE_BY_WORKSPACE[workspace.key]}
                  </RequireWorkspaceAccess>
                }
              />
            ))}
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </WorkspaceProvider>
    </BrowserRouter>
  );
}
