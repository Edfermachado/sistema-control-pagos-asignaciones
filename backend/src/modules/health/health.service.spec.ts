import { ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;
  let prismaMock: { $queryRaw: jest.Mock };

  beforeEach(() => {
    prismaMock = {
      $queryRaw: jest.fn(),
    };
    service = new HealthService(prismaMock as unknown as PrismaService);
  });

  describe('checkSystemHealth', () => {
    it('debe retornar estado OK y moneda USD cuando PostgreSQL responde correctamente (Happy Path)', async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const fixedDate = new Date('2026-11-09T16:00:00.000Z');

      // Act
      const response = await service.checkSystemHealth(fixedDate);

      // Assert
      expect(response.status).toBe('OK');
      expect(response.currency).toBe('USD');
      expect(response.databaseConnected).toBe(true);
      expect(response.timestamp).toBe('2026-11-09T16:00:00.000Z');
      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1);
    });

    it('debe generar una marca de tiempo ISO válida si no se suministra fecha explícita (Edge Case)', async () => {
      // Arrange
      prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

      // Act
      const response = await service.checkSystemHealth();

      // Assert
      expect(Date.parse(response.timestamp)).not.toBeNaN();
    });

    it('debe lanzar ServiceUnavailableException si la consulta a PostgreSQL falla (Caso de Error)', async () => {
      // Arrange
      prismaMock.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));

      // Act & Assert
      await expect(service.checkSystemHealth()).rejects.toThrow(
        ServiceUnavailableException,
      );
    });
  });
});
