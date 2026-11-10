import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '../../common/constants/domain.enums';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { BeneficiariesService } from './beneficiaries.service';

describe('BeneficiariesService (RN-SEG-01 Personal que cobra sin usuario)', () => {
  let service: BeneficiariesService;
  let prismaMock: {
    beneficiary: {
      findUnique: jest.Mock;
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let auditMock: { recordLog: jest.Mock };

  const generadorActor: AuthenticatedUser = {
    id: 'u-gen-1',
    email: 'coordinador@uc.edu.ve',
    fullName: 'Coordinador General',
    role: UserRole.GENERADOR,
  };

  beforeEach(() => {
    prismaMock = {
      beneficiary: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    auditMock = {
      recordLog: jest.fn().mockResolvedValue({ id: 'audit-1' }),
    };
    service = new BeneficiariesService(
      prismaMock as unknown as PrismaService,
      auditMock as unknown as AuditService,
    );
  });

  describe('createBeneficiary', () => {
    it('debe crear un beneficiario normalizando su DNI a mayúsculas y auditando (Happy Path)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce(null);
      prismaMock.beneficiary.create.mockImplementationOnce(({ data }) =>
        Promise.resolve({ id: 'ben-1', ...data }),
      );

      // Act
      const result = await service.createBeneficiary(
        {
          dni: ' v-25123456 ',
          fullName: 'Dra. María Curie',
          email: 'MCURIE@uc.edu.ve',
          bankInfo: 'Zelle: mcurie@uc.edu.ve',
        },
        generadorActor,
      );

      // Assert
      expect(result.dni).toBe('V-25123456');
      expect(result.email).toBe('mcurie@uc.edu.ve');
      expect(auditMock.recordLog).toHaveBeenCalledTimes(1);
    });

    it('debe lanzar BadRequestException si el DNI o nombre quedan vacíos tras limpiar espacios (Edge Case)', async () => {
      // Arrange & Act & Assert
      await expect(
        service.createBeneficiary(
          { dni: '   ', fullName: 'Nombre Válido' },
          generadorActor,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('debe lanzar ConflictException si ya existe un beneficiario con el mismo DNI (Violación RN-SEG-01)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({ id: 'ben-existente' });

      // Act & Assert
      await expect(
        service.createBeneficiary(
          { dni: 'V-25123456', fullName: 'Duplicado' },
          generadorActor,
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('findAllBeneficiaries', () => {
    it('debe listar todos los beneficiarios ordenados alfabéticamente cuando no hay búsqueda (Happy Path)', async () => {
      // Arrange
      prismaMock.beneficiary.findMany.mockResolvedValueOnce([{ id: 'ben-1' }]);

      // Act
      const list = await service.findAllBeneficiaries();

      // Assert
      expect(list).toHaveLength(1);
      expect(prismaMock.beneficiary.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { fullName: 'asc' },
      });
    });

    it('debe construir filtro OR insensible a mayúsculas cuando se pasa término de búsqueda (Edge Case)', async () => {
      // Arrange
      prismaMock.beneficiary.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllBeneficiaries('  Curie  ');

      // Assert
      expect(prismaMock.beneficiary.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { fullName: { contains: 'Curie', mode: 'insensitive' } },
            { dni: { contains: 'Curie', mode: 'insensitive' } },
          ],
        },
        orderBy: { fullName: 'asc' },
      });
    });

    it('debe ignorar cadenas de búsqueda que solo contengan espacios (Caso Borde Vacío)', async () => {
      // Arrange
      prismaMock.beneficiary.findMany.mockResolvedValueOnce([]);

      // Act
      await service.findAllBeneficiaries('   ');

      // Assert
      expect(prismaMock.beneficiary.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { fullName: 'asc' },
      });
    });
  });

  describe('updateBeneficiary', () => {
    it('debe actualizar los datos del beneficiario y registrar oldValues/newValues en auditoría (Happy Path)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        fullName: 'Nombre Antiguo',
        bankInfo: 'Banco A',
        isActive: true,
      });
      prismaMock.beneficiary.update.mockResolvedValueOnce({
        id: 'ben-1',
        fullName: 'Nombre Actualizado',
        bankInfo: 'Banco B',
        isActive: true,
      });

      // Act
      const updated = await service.updateBeneficiary(
        'ben-1',
        { fullName: 'Nombre Actualizado', bankInfo: 'Banco B' },
        generadorActor,
      );

      // Assert
      expect(updated.fullName).toBe('Nombre Actualizado');
      expect(auditMock.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'UPDATE_BENEFICIARY',
          recordId: 'ben-1',
        }),
      );
    });

    it('debe permitir desactivar un beneficiario cambiando isActive a false (Edge Case)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce({
        id: 'ben-1',
        fullName: 'Investigador',
        bankInfo: null,
        isActive: true,
      });
      prismaMock.beneficiary.update.mockResolvedValueOnce({
        id: 'ben-1',
        fullName: 'Investigador',
        bankInfo: null,
        isActive: false,
      });

      // Act
      const updated = await service.updateBeneficiary(
        'ben-1',
        { isActive: false },
        generadorActor,
      );

      // Assert
      expect(updated.isActive).toBe(false);
    });

    it('debe lanzar NotFoundException si el beneficiario a editar no existe (Caso de Error)', async () => {
      // Arrange
      prismaMock.beneficiary.findUnique.mockResolvedValueOnce(null);

      // Act & Assert
      await expect(
        service.updateBeneficiary('id-inexistente', { fullName: 'X' }, generadorActor),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
