import React from 'react';
import { Link } from 'react-router-dom';
import { HOME_PATH } from '../routes/workspaces';

export function NotFoundPage(): React.ReactElement {
  return (
    <div className="app-boot">
      <div className="sheet app-boot__card">
        <div className="sheet__body">
          <h1 className="sheet__title">Esta ruta no existe</h1>
          <p className="sheet__hint">
            La dirección solicitada no corresponde a ninguno de los cinco espacios de
            trabajo del sistema.
          </p>
          <div className="btn-group">
            <Link className="btn" to={HOME_PATH}>
              Ir al resumen
            </Link>
            <Link className="btn btn--ghost" to="/login">
              Volver al acceso
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
