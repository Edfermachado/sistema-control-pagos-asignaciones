import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UserRole } from '../../common/constants/domain.enums';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateAuditLogInput {
  userId?: string | null;
  userRole?: UserRole | null;
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

export interface AuditLogFilter {
  tableName?: string;
  userId?: string;
  action?: string;
  limit?: number;
}

const DEFAULT_AUDIT_LIMIT = 100 as const;
const MAX_AUDIT_LIMIT = 500 as const;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra un evento inmutable (Append-Only) en la tabla audit_logs según RN-AUD-03.
   */
  async recordLog(
    input: CreateAuditLogInput,
    tx?: Prisma.TransactionClient,
  ) {
    const action = (input.action ?? '').trim();
    const tableName = (input.tableName ?? '').trim();
    const recordId = (input.recordId ?? '').trim();

    if (!action || !tableName || !recordId) {
      throw new BadRequestException(
        '[RN-AUD-03] Los campos action, tableName y recordId son obligatorios para registrar auditoría.',
      );
    }

    const client = tx ?? this.prisma;

    return client.auditLog.create({
      data: {
        userId: input.userId ?? null,
        userRole: input.userRole ?? null,
        action,
        tableName,
        recordId,
        oldValues: (input.oldValues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        newValues: (input.newValues ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        ipAddress: input.ipAddress ?? null,
      },
    });
  }

  /**
   * Consulta los registros de auditoría ordenados del más reciente al más antiguo (RN-AUD-03).
   */
  async findAllLogs(filter: AuditLogFilter = {}) {
    const limit = filter.limit ?? DEFAULT_AUDIT_LIMIT;
    if (limit <= 0 || limit > MAX_AUDIT_LIMIT) {
      throw new BadRequestException(
        `[RN-AUD-03] El límite de consulta de auditoría debe estar entre 1 y ${MAX_AUDIT_LIMIT}.`,
      );
    }

    return this.prisma.auditLog.findMany({
      where: {
        ...(filter.tableName ? { tableName: filter.tableName } : {}),
        ...(filter.userId ? { userId: filter.userId } : {}),
        ...(filter.action ? { action: filter.action } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
