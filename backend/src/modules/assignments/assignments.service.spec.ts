import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  ProjectStatus,
  UserRole,
} from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { AssignmentsService } from './assignments.service';

describe('AssignmentsService (RN-CAT-04 Cruce Beneficiario x Proyecto x Grupo de Pago)', () => {
  let service: AssignmentsService;
  let prismaMock: {
    beneficiary: { findUnique: jest.Mock };
    project: { findUnique: jest.Mock };
    paymentGroup: { findUnique: jest.Mock };
    assignment: {
      findMany: jest.Mock;
      create: jest.Mock;
      findUnique: jest.Mock;
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
      beneficiary: { findUnique: jest.fn() },
      project: { findUnique: jest.fn() },
      paymentGroup: { findUnique: jest.fn() },
      assignment: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new AssignmentsService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createAssignment', () => {
    it('debe crear una asignación válida en USD cuando el beneficiario, proyecto y grupo están activos (Happy Path)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        isActive: true,
      });
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({
        id: 'pg-1',
        isActive: true,
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([]);
      prismaMock.assignment.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'asig-1', ...data }),
      );

      // Act
      const created = await service.createAssignment(
        {
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          paymentGroupId: 'pg-1',
          amountPerPeriod: '350.00',
          startDate: '2026-02-01',
          endDate: '2026-11-30',
        },
        generadorActor,
      );

      // Assert
      expect(created.amountPerPeriod).toBe('350.00');
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe usar por defecto el endDate del proyecto cuando no se especifica endDate en la asignación (Edge Case)', async () => {
      // Arrange
      const projectEnd = new Date('2026-12-31T00:00:00Z');
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        isActive: true,
      });
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: projectEnd,
      });
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({
        id: 'pg-1',
        isActive: true,
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([]);
      prismaMock.assignment.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'asig-2', ...data }),
      );

      // Act
      const created = await service.createAssignment(
        {
          beneficiaryId: 'ben-1',
          projectId: 'proj-1',
          paymentGroupId: 'pg-1',
          amountPerPeriod: 500,
          startDate: '2026-03-01',
        },
        generadorActor,
      );

      // Assert
      expect(created.endDate).toEqual(projectEnd);
    });

    it('debe lanzar ConflictException si ya tiene una asignación solapada en el mismo proyecto o BadRequestException si el proyecto está CERRADO (Violación RN-CAT-02 / RN-CAT-04)', async () => {
      // Arrange (Proyecto cerrado)
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        isActive: true,
      });
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.CERRADO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({
        id: 'pg-1',
        isActive: true,
      });

      // Act & Assert
      await expect(
        service.createAssignment(
          {
            beneficiaryId: 'ben-1',
            projectId: 'proj-1',
            paymentGroupId: 'pg-1',
            amountPerPeriod: 300,
            startDate: '2026-02-01',
          },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);

      // Arrange (Solapamiento en proyecto activo)
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        isActive: true,
      });
      prismaMock.project.findUnique.mockResolvedValueOnce({
        id: 'proj-1',
        status: ProjectStatus.ACTIVO,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.paymentGroup.findUnique.mockResolvedValueOnce({
        id: 'pg-1',
        isActive: true,
      });
      prismaMock.assignment.findMany.mockResolvedValueOnce([
        {
          startDate: new Date('2026-01-01T00:00:00Z'),
          endDate: new Date('2026-12-31T00:00:00Z'),
        },
      ]);

      await expect(
        service.createAssignment(
          {
            beneficiaryId: 'ben-1',
            projectId: 'proj-1',
            paymentGroupId: 'pg-1',
            amountPerPeriod: 300,
            startDate: '2026-06-01',
          },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllAssignments', () => {
    it('debe retornar todas las asignaciones incluyendo sus relaciones (Happy Path)', async () => {
      // Arrange
      prismaMock.assignment.findMany.mockResolvedValueOnce([{ id: 'asig-1' }]);

      // Act
      const result = await service.findAllAssignments();

      // Assert
      expect(result).toHaveLength(1);
    });

    it('debe filtrar por projectId y onlyActive cuando se especifican (Edge Case)', async () => {
      // Arrange
      prismaMock.assignment.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllAssignments({ projectId: 'proj-1', onlyActive: true });

      // Assert
      expect(prismaMock.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'proj-1', isActive: true },
        }),
      );
    });

    it('debe permitir filtrar por beneficiaryId para ver los múltiples proyectos de una persona (RN-CAT-04)', async () => {
      // Arrange
      prismaMock.assignment.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllAssignments({ beneficiaryId: 'ben-1' });

      // Assert
      expect(prismaMock.assignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { beneficiaryId: 'ben-1' },
        }),
      );
    });
  });

  describe('deactivateAssignment', () => {
    it('debe desactivar la asignación y registrar el evento en audit_logs (Happy Path)', async () => {
      // Arrange
      prismaMock.assignment.findUnique.mockResolvedValueOnce({
        id: 'asig-1',
        isActive: true,
        endDate: new Date('2026-12-31T00:00:00Z'),
      });
      prismaMock.assignment.update.mockResolvedValueOnce({
        id: 'asig-1',
        isActive: false,
      });

      // Act
      const result = await service.deactivateAssignment(
        'asig-1',
        '2026-08-15',
        generadorActor,
      );

      // Assert
      expect(result.isActive).toBe(false);
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe conservar la fecha de fin existente si no se envía una nueva fecha (Edge Case)', async () => {
      // Arrange
      const currentEnd = new Date('2026-10-31T00:00:00Z');
      prismaMock.assignment.findUnique.mockResolvedValueOnce({
        id: 'asig-1',
        isActive: true,
        endDate: currentEnd,
      });
      prismaMock.assignment.update.mockResolvedValueOnce({
        id: 'asig-1',
        isActive: false,
        endDate: currentEnd,
      });

      // Act
      await service.deactivateAssignment('asig-1', undefined, generadorActor);

      // Assert
      expect(prismaMock.assignment.update).toHaveBeenCalledWith({
        where: { id: 'asig-1' },
        data: { isActive: false, endDate: currentEnd },
      });
    });

    it('debe lanzar NotFoundException si el ID de la asignación no existe (Caso de Error)', async () => {
      // Arrange
      prismaMock.assignment.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.deactivateAssignment('id-inexistente', undefined, generadorActor),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
