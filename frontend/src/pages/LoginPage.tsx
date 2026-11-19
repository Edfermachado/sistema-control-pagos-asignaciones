import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { DEMO_ROLE_CREDENTIALS, useWorkspace } from '../context/WorkspaceContext';
import { HOME_PATH } from '../routes/workspaces';
import { UserRole } from '../types/domain.types';

export function LoginPage(): React.ReactElement {
  const {
    token,
    isBootstrapping,
    loginWithCredentials,
    loginAsRole,
    notification,
    clearNotification,
  } = useWorkspace();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('coordinador@uc.edu.ve');
  const [password, setPassword] = useState('PasswordUC2026!');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const redirectTarget = (location.state as { from?: string } | null)?.from ?? HOME_PATH;

  const finishLogin = (): void => {
    navigate(redirectTarget, { replace: true });
  };

  const handleSubmit = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setLocalError(null);
    setIsSubmitting(true);
    const error = await loginWithCredentials(email, password);
    setIsSubmitting(false);
    if (error) {
      setLocalError(error);
      return;
    }
    finishLogin();
  };

  const handleDemoLogin = async (role: UserRole): Promise<void> => {
    setLocalError(null);
    setIsSubmitting(true);
    const error = await loginAsRole(role);
    setIsSubmitting(false);
    if (error) {
      setLocalError(error);
      return;
    }
    finishLogin();
  };

  if (isBootstrapping) {
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

  return (
    <div className="login-portal">
      <div className="login-portal__card">
        <div className="login-portal__head">
          <div className="login-portal__org">
            Universidad de Carabobo · FACYT · Escuela de Computación
          </div>
          <h1 className="login-portal__title">Control de Pagos</h1>
          <p className="login-portal__lead">
            Sistema de gestión, causación prorrateada, pagos FIFO y auditoría en USD.
          </p>
        </div>

        <div className="login-portal__body">
          {(notification || localError) && (
            <div
              className={`notice ${
                localError || notification?.type === 'error'
                  ? 'notice--error'
                  : 'notice--ok'
              }`}
              role="status"
            >
              <span>{localError ?? notification?.message}</span>
              <button
                type="button"
                className="notice__close"
                onClick={() => {
                  setLocalError(null);
                  clearNotification();
                }}
                aria-label="Cerrar aviso"
              >
                ✕
              </button>
            </div>
          )}

          {token && (
            <p className="sheet__hint">
              Ya hay una sesión abierta en esta pestaña.{' '}
              <Link to={HOME_PATH}>Volver al sistema</Link> o elija otro rol para
              cambiarla.
            </p>
          )}

          <div className="login-portal__section">
            <h2 className="login-portal__section-title">
              Acceso rápido por rol (demostración RN-SEG-02)
            </h2>
            <div className="login-portal__demo-grid">
              {(
                [
                  UserRole.GENERADOR,
                  UserRole.RECEPTOR,
                  UserRole.ADMIN,
                ] as UserRole[]
              ).map((role) => (
                <button
                  key={role}
                  type="button"
                  className="login-portal__demo-btn"
                  disabled={isSubmitting}
                  onClick={() => void handleDemoLogin(role)}
                >
                  <span className="login-portal__demo-role">{role}</span>
                  <span className="login-portal__demo-desc">
                    {DEMO_ROLE_CREDENTIALS[role].email}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="login-portal__divider">o con credenciales</div>

          <form className="form-grid" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label className="field__label" htmlFor="portal-email">
                Correo institucional
              </label>
              <input
                id="portal-email"
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="coordinador@uc.edu.ve"
                autoComplete="username"
                required
              />
            </div>

            <div className="field">
              <label className="field__label" htmlFor="portal-password">
                Contraseña
              </label>
              <input
                id="portal-password"
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="PasswordUC2026!"
                autoComplete="current-password"
                required
              />
            </div>

            <button type="submit" className="btn" disabled={isSubmitting}>
              {isSubmitting ? 'Verificando…' : 'Iniciar sesión'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
