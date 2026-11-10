import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ProjectsService } from './projects.service';

describe('ProjectsService (RN-CAT-01 y RN-CAT-02 Gestión de Proyectos)', () => {
  let service: ProjectsService;
  let prismaMock: {
    project: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditMock: { recordLog: jest.Mock };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen-1',
    email: 'coord@uc.edu.ve',
    fullName: 'Coordinador General',
    role: UserRole.GENERADOR,
  };

  beforeEach(() => {
    prismaMock = {
      project: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new ProjectsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createProject', () => {
    it('debe crear un proyecto de Física/Química/Biología con código en mayúsculas y auditar (Happy Path)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce(null);
      prismaMock.project.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'proj-1', ...data }),
      );

      // Act
      const created = await service.createProject(
        {
          code: ' fis-2026-01 ',
          name: 'Espectroscopía Láser',
          area: ProjectArea.FISICA,
          scope: ProjectScope.INTERNO,
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
        generadorActor,
      );

      // Assert
      expect(created.code).toBe('FIS-2026-01');
      expect(created.area).toBe(ProjectArea.FISICA);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar ConflictException si el código del proyecto ya existe (Edge Case)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce({ id: 'existente' });

      // Act & Assert
      await expect(
        service.createProject(
          {
            code: 'FIS-2026-01',
            name: 'Duplicado',
            area: ProjectArea.FISICA,
            scope: ProjectScope.EXTERNO,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
          },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('debe lanzar BadRequestException si endDate es anterior a startDate (Violación RN-CAT-01)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.createProject(
          {
            code: 'QUI-2026-01',
            name: 'Polímeros',
            area: ProjectArea.QUIMICA,
            scope: ProjectScope.INTERNO,
            startDate: '2026-12-31',
            endDate: '2026-01-01',
          },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findAllProjects', () => {
    it('debe retornar todos los proyectos cuando no se especifican filtros (Happy Path)', async () => {
      // Arrange
      prismaMock.project.findMany.mockResolvedValueOnce([{ id: 'proj-1' }]);

      // Act
      const result = await service.findAllProjects();

      // Assert
      expect(result).toHaveLength(1);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { startDate: 'desc' },
      });
    });

    it('debe filtrar por área BIOLOGIA y estado ACTIVO cuando se suministran ambos (Edge Case)', async () => {
      // Arrange
      prismaMock.project.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllProjects(ProjectArea.BIOLOGIA, ProjectStatus.ACTIVO);

      // Assert
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { area: ProjectArea.BIOLOGIA, status: ProjectStatus.ACTIVO },
        orderBy: { startDate: 'desc' },
      });
    });

    it('debe filtrar únicamente por área cuando status es undefined (Caso Filtro Parcial)', async () => {
      // Arrange
      prismaMock.project.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllProjects(ProjectArea.QUIMICA);

      // Assert
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { area: ProjectArea.QUIMICA },
        orderBy: { startDate: 'desc' },
      });
    });
  });

  describe('updateProjectStatus', () => {
    it('debe actualizar el estado del proyecto y registrar oldValues y newValues en audit_log (Happy Path)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
      });
      prismaMock.project.update.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.CERRADO,
      });

      // Act
      const updated = await service.updateProjectStatus(
        'proj-1',
        ProjectStatus.CERRADO,
        generadorActor,
      );

      // Assert
      expect(updated.status).toBe(ProjectStatus.CERRADO);
      expect(auditMock.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_PROJECT_STATUS',
          oldValues: { status: ProjectStatus.ACTIVO },
          newValues: { status: ProjectStatus.CERRADO },
        }),
      );
    });

    it('debe permitir cambiar el estado a INACTIVO (Edge Case)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
      });
      prismaMock.project.update.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.INACTIVO,
      });

      // Act
      const updated = await service.updateProjectStatus(
        'proj-1',
        ProjectStatus.INACTIVO,
        generadorActor,
      );

      // Assert
      expect(updated.status).toBe(ProjectStatus.INACTIVO);
    });

    it('debe lanzar NotFoundException si el proyecto no existe (Caso de Error)', async () => {
      // Arrange
      prismaMock.project.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.updateProjectStatus(
          'id-inexistente',
          ProjectStatus.CERRADO,
          generadorActor,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
