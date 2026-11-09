import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CURRENCY_CODE } from '../../common/constants/domain.enums';
import { PrismaService } from '../../prisma/prisma.service';

export interface SystemHealthResponse {
  status: 'OK' | 'DEGRADED';
  system: string;
  currency: typeof CURRENCY_CODE;
  databaseConnected: boolean;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verifica la disponibilidad del servidor y la conexión activa con PostgreSQL.
   */
  async checkSystemHealth(now: Date = new Date()): Promise<SystemHealthResponse> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'OK',
        system: 'Sistema de Control de Pagos y Asignaciones (UC)',
        currency: CURRENCY_CODE,
        databaseConnected: true,
        timestamp: now.toISOString(),
      };
    } catch {
      throw new ServiceUnavailableException(
        'No fue posible establecer conexión con la base de datos PostgreSQL.',
      );
    }
  }
}
