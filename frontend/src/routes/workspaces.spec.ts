import { describe, expect, it } from 'vitest';
import { UserRole } from '../types/domain.types';
import {
  canAccessWorkspace,
  findWorkspaceByPath,
  firstAllowedPath,
  HOME_PATH,
  LOGIN_PATH,
  pathForWorkspace,
  visibleWorkspaces,
  WORKSPACES,
} from './workspaces';

describe('routes/workspaces (RN-SEG-02 por ruta)', () => {
  describe('findWorkspaceByPath', () => {
    it('debe devolver la definición del espacio para una ruta conocida (Happy Path)', () => {
      // Act
      const workspace = findWorkspaceByPath('/causacion');

      // Assert
      expect(workspace?.key).toBe('MOTOR_FINANCIERO');
      expect(workspace?.index).toBe('3');
    });

    it('debe devolver undefined para rutas desconocidas o la raíz (Edge Case)', () => {
      // Act & Assert
      expect(findWorkspaceByPath('/')).toBeUndefined();
      expect(findWorkspaceByPath('/no-existe')).toBeUndefined();
      expect(findWorkspaceByPath('/causacion/extra')).toBeUndefined();
    });
  });

  describe('canAccessWorkspace', () => {
    it('debe permitir al GENERADOR entrar a causación y cajas chicas (Happy Path)', () => {
      // Arrange
      const motor = WORKSPACES.find((w) => w.key === 'MOTOR_FINANCIERO');
      const cajas = WORKSPACES.find((w) => w.key === 'CAJA_CHICA');

      // Act & Assert
      expect(motor && canAccessWorkspace(motor, UserRole.GENERADOR)).toBe(true);
      expect(cajas && canAccessWorkspace(cajas, UserRole.GENERADOR)).toBe(true);
    });

    it('debe impedir al ADMIN entrar a cualquier espacio de dinero (Error Case RN-SEG-02)', () => {
      // Arrange
      const motor = WORKSPACES.find((w) => w.key === 'MOTOR_FINANCIERO');
      const cajas = WORKSPACES.find((w) => w.key === 'CAJA_CHICA');

      // Act & Assert
      expect(motor && canAccessWorkspace(motor, UserRole.ADMIN)).toBe(false);
      expect(cajas && canAccessWorkspace(cajas, UserRole.ADMIN)).toBe(false);
    });

    it('debe impedir al GENERADOR ver la bitácora de auditoría (Error Case RN-SEG-02)', () => {
      // Arrange
      const auditoria = WORKSPACES.find((w) => w.key === 'AUDITORIA');

      // Act & Assert
      expect(auditoria && canAccessWorkspace(auditoria, UserRole.GENERADOR)).toBe(false);
      expect(auditoria && canAccessWorkspace(auditoria, UserRole.RECEPTOR)).toBe(true);
    });
  });

  describe('visibleWorkspaces', () => {
    it('debe listar tres espacios para el ADMIN y ninguno de dinero (Happy Path)', () => {
      // Act
      const visible = visibleWorkspaces(UserRole.ADMIN).map((w) => w.key);

      // Assert
      expect(visible).toEqual(['RESUMEN', 'CATALOGOS', 'AUDITORIA']);
    });

    it('debe listar cuatro espacios para el GENERADOR, sin auditoría (Edge Case)', () => {
      // Act
      const visible = visibleWorkspaces(UserRole.GENERADOR).map((w) => w.key);

      // Assert
      expect(visible).toHaveLength(4);
      expect(visible).not.toContain('AUDITORIA');
    });

    it('debe listar los cinco espacios para el RECEPTOR', () => {
      // Act
      const visible = visibleWorkspaces(UserRole.RECEPTOR);

      // Assert
      expect(visible).toHaveLength(5);
    });
  });

  describe('firstAllowedPath', () => {
    it('debe devolver el resumen como primer destino para los tres roles (Happy Path)', () => {
      // Act & Assert
      expect(firstAllowedPath(UserRole.ADMIN)).toBe(HOME_PATH);
      expect(firstAllowedPath(UserRole.GENERADOR)).toBe(HOME_PATH);
      expect(firstAllowedPath(UserRole.RECEPTOR)).toBe(HOME_PATH);
    });
  });

  describe('pathForWorkspace', () => {
    it('debe mapear la clave del espacio a su ruta (Happy Path)', () => {
      // Act & Assert
      expect(pathForWorkspace('RESUMEN')).toBe('/resumen');
      expect(pathForWorkspace('CAJA_CHICA')).toBe('/cajas-chicas');
      expect(pathForWorkspace('AUDITORIA')).toBe('/auditoria');
    });

    it('debe mantener rutas únicas y coherentes con LOGIN_PATH fuera de la lista (Edge Case)', () => {
      // Act
      const paths = WORKSPACES.map((w) => w.path);

      // Assert
      expect(new Set(paths).size).toBe(paths.length);
      expect(paths).not.toContain(LOGIN_PATH);
    });
  });
});
