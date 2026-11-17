import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { AccrualsService } from '../../modules/accruals/accruals.service';
import { AnnulmentsService } from '../../modules/annulments/annulments.service';
import { AssignmentsService } from '../../modules/assignments/assignments.service';
import { AuditService } from '../../modules/audit/audit.service';
import { BeneficiariesService } from '../../modules/beneficiaries/beneficiaries.service';
import { PaymentGroupsService } from '../../modules/payment-groups/payment-groups.service';
import { PaymentRequestsService } from '../../modules/payment-requests/payment-requests.service';
import { PaymentsService } from '../../modules/payments/payments.service';
import { PettyCashService } from '../../modules/petty-cash/petty-cash.service';
import { ProjectsService } from '../../modules/projects/projects.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AccrualBatchStatus,
  AccrualStatus,
  PaymentRequestStatus,
  PaymentStatus,
  Periodicity,
  PettyCashPeriodStatus,
  PettyCashStatus,
  PettyCashVoucherStatus,
  ProjectArea,
  ProjectScope,
  ProjectStatus,
  UserRole,
} from '../constants/domain.enums';
import { AuthenticatedUser } from '../decorators/current-user.decorator';

type RowRecord = Record<string, unknown>;

interface FilterOperator {
  in?: unknown[];
  not?: unknown;
  lte?: Date | string;
  gte?: Date | string;
}

interface QueryArgs {
  where?: RowRecord;
  include?: Record<string, boolean | RowRecord>;
  data?: RowRecord;
  orderBy?: RowRecord;
}

interface BatchCreateArgs {
  data: RowRecord[];
}

/**
 * Doble relacional en memoria tipado con soporte transaccional para probar
 * flujos E2E completos entre los servicios reales de NestJS (sin usar any).
 */
function createInMemoryPrisma(): PrismaService {
  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;
  const clone = <T extends RowRecord>(row: T | null): T | null =>
    row ? { ...row } : null;

  const db = {
    projects: [] as RowRecord[],
    paymentGroups: [] as RowRecord[],
    paymentGroupPeriods: [] as RowRecord[],
    beneficiaries: [] as RowRecord[],
    assignments: [] as RowRecord[],
    accrualBatches: [] as RowRecord[],
    accruals: [] as RowRecord[],
    paymentRequests: [] as RowRecord[],
    paymentRequestItems: [] as RowRecord[],
    payments: [] as RowRecord[],
    paymentAllocations: [] as RowRecord[],
    annulments: [] as RowRecord[],
    pettyCashes: [] as RowRecord[],
    pettyCashPeriods: [] as RowRecord[],
    pettyCashVouchers: [] as RowRecord[],
    auditLogs: [] as RowRecord[],
  };

  const toTimestamp = (value: unknown): number => {
    if (value instanceof Date) return value.getTime();
    return new Date(String(value)).getTime();
  };

  const isFilterOperator = (val: unknown): val is FilterOperator =>
    Boolean(val) && typeof val === 'object' && !(val instanceof Date);

  const matchDateFilter = (val: Date, cond: FilterOperator): boolean => {
    const time = val.getTime();
    if (cond.lte && time > toTimestamp(cond.lte)) return false;
    if (cond.gte && time < toTimestamp(cond.gte)) return false;
    return true;
  };

  const matchValue = (rowVal: unknown, cond: unknown): boolean => {
    if (isFilterOperator(cond)) {
      if (Array.isArray(cond.in)) return cond.in.includes(rowVal);
      if ('not' in cond) return rowVal !== cond.not;
      if (cond.lte !== undefined || cond.gte !== undefined) {
        return matchDateFilter(new Date(toTimestamp(rowVal)), cond);
      }
    }
    if (rowVal instanceof Date || cond instanceof Date) {
      return toTimestamp(rowVal) === toTimestamp(cond);
    }
    return rowVal === cond;
  };

  const matchesWhere = (row: RowRecord, where: RowRecord = {}): boolean => {
    for (const [key, cond] of Object.entries(where)) {
      if (cond === undefined) continue;
      if (!matchValue(row[key], cond)) return false;
    }
    return true;
  };

  const updateRowById = (
    table: RowRecord[],
    where: RowRecord = {},
    data: RowRecord = {},
  ): RowRecord | null => {
    const rec = table.find((r) => r.id === where.id);
    if (!rec) return null;
    Object.assign(rec, data);
    return clone(rec);
  };

  const client = {
    $transaction: async <T>(cb: (tx: PrismaService) => Promise<T>): Promise<T> =>
      cb(client as unknown as PrismaService),

    project: {
      count: async () => db.projects.length,
      findUnique: async ({ where = {} }: QueryArgs) =>
        clone(
          db.projects.find((p) =>
            where.id ? p.id === where.id : p.code === where.code,
          ) ?? null,
        ),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('proj'), createdAt: new Date(), ...data };
        db.projects.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.projects, where, data),
      findMany: async ({ where }: QueryArgs = {}) =>
        db.projects.filter((p) => matchesWhere(p, where)).map((r) => ({ ...r })),
    },

    paymentGroup: {
      findUnique: async ({ where = {} }: QueryArgs) =>
        clone(
          db.paymentGroups.find((g) =>
            where.id ? g.id === where.id : g.name === where.name,
          ) ?? null,
        ),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('pg'), createdAt: new Date(), ...data };
        db.paymentGroups.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.paymentGroups, where, data),
      findMany: async ({ where }: QueryArgs = {}) =>
        db.paymentGroups
          .filter((g) => matchesWhere(g, where))
          .map((r) => ({ ...r })),
    },

    paymentGroupPeriod: {
      count: async ({ where }: QueryArgs = {}) =>
        db.paymentGroupPeriods.filter((p) => matchesWhere(p, where)).length,
      findFirst: async ({ where }: QueryArgs = {}) =>
        clone(
          db.paymentGroupPeriods.find((p) => matchesWhere(p, where)) ?? null,
        ),
      findUnique: async ({ where = {} }: QueryArgs) =>
        clone(
          db.paymentGroupPeriods.find((p) => p.id === where.id) ?? null,
        ),
      findMany: async ({ where }: QueryArgs = {}) =>
        db.paymentGroupPeriods
          .filter((p) => matchesWhere(p, where))
          .sort((a, b) => toTimestamp(a.periodStart) - toTimestamp(b.periodStart))
          .map((r) => ({ ...r })),
      createMany: async ({ data }: BatchCreateArgs) => {
        for (const item of data) {
          db.paymentGroupPeriods.push({ id: nextId('pgp'), ...item });
        }
        return { count: data.length };
      },
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('pgp'), ...data };
        db.paymentGroupPeriods.push(rec);
        return clone(rec);
      },
      delete: async ({ where = {} }: QueryArgs) => {
        const idx = db.paymentGroupPeriods.findIndex((p) => p.id === where.id);
        const [removed] = db.paymentGroupPeriods.splice(idx, 1);
        return removed;
      },
    },

    beneficiary: {
      findUnique: async ({ where = {} }: QueryArgs) =>
        clone(
          db.beneficiaries.find((b) =>
            where.id ? b.id === where.id : b.dni === where.dni,
          ) ?? null,
        ),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('ben'), createdAt: new Date(), ...data };
        db.beneficiaries.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.beneficiaries, where, data),
      findMany: async () => db.beneficiaries.map((r) => ({ ...r })),
    },

    assignment: {
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.assignments.find((a) => a.id === where.id);
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.project
            ? { project: db.projects.find((p) => p.id === rec.projectId) }
            : {}),
        });
      },
      findMany: async ({ where, include }: QueryArgs = {}) =>
        db.assignments
          .filter((a) => matchesWhere(a, where))
          .map((a) => ({
            ...a,
            ...(include?.beneficiary
              ? {
                  beneficiary: db.beneficiaries.find(
                    (b) => b.id === a.beneficiaryId,
                  ),
                }
              : {}),
            ...(include?.project
              ? { project: db.projects.find((p) => p.id === a.projectId) }
              : {}),
            ...(include?.paymentGroup
              ? {
                  paymentGroup: db.paymentGroups.find(
                    (pg) => pg.id === a.paymentGroupId,
                  ),
                }
              : {}),
          })),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('asig'), createdAt: new Date(), ...data };
        db.assignments.push(rec);
        return clone({
          ...rec,
          beneficiary: db.beneficiaries.find((b) => b.id === rec.beneficiaryId),
          project: db.projects.find((p) => p.id === rec.projectId),
          paymentGroup: db.paymentGroups.find(
            (pg) => pg.id === rec.paymentGroupId,
          ),
        });
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.assignments, where, data),
    },

    accrualBatch: {
      count: async () => db.accrualBatches.length,
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.accrualBatches.find((b) =>
          where.id ? b.id === where.id : b.code === where.code,
        );
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.accruals
            ? { accruals: db.accruals.filter((a) => a.batchId === rec.id) }
            : {}),
        });
      },
      findFirst: async ({ where }: QueryArgs = {}) =>
        clone(db.accrualBatches.find((b) => matchesWhere(b, where)) ?? null),
      findMany: async () =>
        db.accrualBatches.map((b) => ({
          ...b,
          accruals: db.accruals.filter((a) => a.batchId === b.id),
        })),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = {
          id: nextId('batch'),
          status: AccrualBatchStatus.GENERADO,
          createdAt: new Date(),
          ...data,
        };
        db.accrualBatches.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.accrualBatches, where, data),
    },

    accrual: {
      findUnique: async ({ where = {} }: QueryArgs) =>
        clone(db.accruals.find((a) => a.id === where.id) ?? null),
      findMany: async ({ where }: QueryArgs = {}) =>
        db.accruals
          .filter((a) => matchesWhere(a, where))
          .map((a) => ({ ...a })),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('acc'), createdAt: new Date(), ...data };
        db.accruals.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.accruals, where, data),
      updateMany: async ({ where, data = {} }: QueryArgs) => {
        const matching = db.accruals.filter((a) => matchesWhere(a, where));
        matching.forEach((a) => Object.assign(a, data));
        return { count: matching.length };
      },
    },

    paymentRequest: {
      count: async () => db.paymentRequests.length,
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.paymentRequests.find((r) =>
          where.id ? r.id === where.id : r.code === where.code,
        );
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.items
            ? {
                items: db.paymentRequestItems
                  .filter((i) => i.paymentRequestId === rec.id)
                  .map((i) => ({
                    ...i,
                    accrual: db.accruals.find((a) => a.id === i.accrualId),
                  })),
              }
            : {}),
          ...(include?.payments
            ? {
                payments: db.payments.filter(
                  (p) => p.paymentRequestId === rec.id,
                ),
              }
            : {}),
        });
      },
      findMany: async ({ where }: QueryArgs = {}) =>
        db.paymentRequests
          .filter((r) => matchesWhere(r, where))
          .map((r) => ({ ...r })),
      create: async ({ data = {} }: QueryArgs) => {
        const { items, ...rest } = data as RowRecord & {
          items?: { create?: RowRecord[] };
        };
        const rec: RowRecord = { id: nextId('req'), createdAt: new Date(), ...rest };
        db.paymentRequests.push(rec);
        const createdItems = (items?.create ?? []).map((item) => {
          const itemRec: RowRecord = {
            id: nextId('pri'),
            paymentRequestId: rec.id,
            ...item,
          };
          db.paymentRequestItems.push(itemRec);
          return itemRec;
        });
        return clone({ ...rec, items: createdItems });
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.paymentRequests, where, data),
    },

    paymentRequestItem: {
      findFirst: async ({ where = {} }: QueryArgs) => {
        const found = db.paymentRequestItems.find((item) => {
          if (where.accrualId && !matchValue(item.accrualId, where.accrualId)) {
            return false;
          }
          if (where.paymentRequest && typeof where.paymentRequest === 'object') {
            const req = db.paymentRequests.find(
              (r) => r.id === item.paymentRequestId,
            );
            return req
              ? matchesWhere(req, where.paymentRequest as RowRecord)
              : false;
          }
          return true;
        });
        return clone(found ?? null);
      },
    },

    payment: {
      count: async () => db.payments.length,
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.payments.find((p) =>
          where.id ? p.id === where.id : p.receiptCode === where.receiptCode,
        );
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.allocations
            ? {
                allocations: db.paymentAllocations
                  .filter((al) => al.paymentId === rec.id)
                  .map((al) => ({
                    ...al,
                    accrual: db.accruals.find((a) => a.id === al.accrualId),
                  })),
              }
            : {}),
          ...(include?.paymentRequest
            ? {
                paymentRequest: db.paymentRequests.find(
                  (r) => r.id === rec.paymentRequestId,
                ),
              }
            : {}),
        });
      },
      findMany: async () => db.payments.map((p) => ({ ...p })),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('pay'), createdAt: new Date(), ...data };
        db.payments.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.payments, where, data),
    },

    paymentAllocation: {
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('pal'), ...data };
        db.paymentAllocations.push(rec);
        return clone(rec);
      },
    },

    annulment: {
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('ann'), createdAt: new Date(), ...data };
        db.annulments.push(rec);
        return clone(rec);
      },
      findMany: async () => db.annulments.map((a) => ({ ...a })),
    },

    pettyCash: {
      count: async () => db.pettyCashes.length,
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.pettyCashes.find((c) =>
          where.id ? c.id === where.id : c.code === where.code,
        );
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.periods
            ? {
                periods: db.pettyCashPeriods.filter(
                  (per) => per.pettyCashId === rec.id,
                ),
              }
            : {}),
        });
      },
      findMany: async () =>
        db.pettyCashes.map((c) => ({
          ...c,
          periods: db.pettyCashPeriods
            .filter((per) => per.pettyCashId === c.id)
            .map((per) => ({
              ...per,
              vouchers: db.pettyCashVouchers.filter(
                (v) => v.periodId === per.id,
              ),
            })),
        })),
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('cc'), createdAt: new Date(), ...data };
        db.pettyCashes.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.pettyCashes, where, data),
    },

    pettyCashPeriod: {
      findFirst: async ({ where, orderBy }: QueryArgs = {}) => {
        let rows = db.pettyCashPeriods.filter((per) =>
          matchesWhere(per, where),
        );
        if (orderBy?.yearMonth === 'desc') {
          rows = rows.sort((a, b) =>
            String(b.yearMonth).localeCompare(String(a.yearMonth)),
          );
        }
        return clone(rows[0] ?? null);
      },
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.pettyCashPeriods.find((per) => per.id === where.id);
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.vouchers
            ? {
                vouchers: db.pettyCashVouchers.filter(
                  (v) => v.periodId === rec.id,
                ),
              }
            : {}),
        });
      },
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('pcp'), createdAt: new Date(), ...data };
        db.pettyCashPeriods.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.pettyCashPeriods, where, data),
    },

    pettyCashVoucher: {
      count: async () => db.pettyCashVouchers.length,
      findUnique: async ({ where = {}, include }: QueryArgs) => {
        const rec = db.pettyCashVouchers.find((v) =>
          where.id ? v.id === where.id : v.code === where.code,
        );
        if (!rec) return null;
        return clone({
          ...rec,
          ...(include?.period
            ? {
                period: db.pettyCashPeriods.find(
                  (per) => per.id === rec.periodId,
                ),
              }
            : {}),
        });
      },
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('val'), createdAt: new Date(), ...data };
        db.pettyCashVouchers.push(rec);
        return clone(rec);
      },
      update: async ({ where, data }: QueryArgs) =>
        updateRowById(db.pettyCashVouchers, where, data),
    },

    auditLog: {
      create: async ({ data = {} }: QueryArgs) => {
        const rec: RowRecord = { id: nextId('aud'), createdAt: new Date(), ...data };
        db.auditLogs.push(rec);
        return clone(rec);
      },
      findMany: async () => [...db.auditLogs].reverse(),
    },
  };

  return client as unknown as PrismaService;
}

describe('Flujos Completos del Sistema (Backend E2E Integración)', () => {
  const adminActor: AuthenticatedUser = {
    id: 'usr-admin',
    email: 'admin@facyt.uc.edu.ve',
    fullName: 'Admin Sistema',
    role: UserRole.ADMIN,
  };
  const generadorActor: AuthenticatedUser = {
    id: 'usr-generador',
    email: 'coordinador@facyt.uc.edu.ve',
    fullName: 'Coordinador General',
    role: UserRole.GENERADOR,
  };
  const receptorActor: AuthenticatedUser = {
    id: 'usr-receptor',
    email: 'gerente@facyt.uc.edu.ve',
    fullName: 'Gerente Administración',
    role: UserRole.RECEPTOR,
  };

  function bootstrapServices() {
    const prisma = createInMemoryPrisma();
    const auditService = new AuditService(prisma);
    return {
      prisma,
      auditService,
      projectsService: new ProjectsService(prisma, auditService),
      paymentGroupsService: new PaymentGroupsService(prisma, auditService),
      beneficiariesService: new BeneficiariesService(prisma, auditService),
      assignmentsService: new AssignmentsService(prisma, auditService),
      accrualsService: new AccrualsService(prisma, auditService),
      paymentRequestsService: new PaymentRequestsService(prisma, auditService),
      paymentsService: new PaymentsService(prisma, auditService),
      annulmentsService: new AnnulmentsService(prisma, auditService),
      pettyCashService: new PettyCashService(prisma, auditService),
    };
  }

  it('Flujo 1: Ciclo financiero integral (Catálogos -> Asignaciones -> Causación FIFO -> Solicitud -> Pagos parciales/totales -> Cierre)', async () => {
    // Arrange
    const sys = bootstrapServices();
    const year = new Date().getUTCFullYear();

    // 1. Creación de catálogos con códigos generados por el sistema
    const project = await sys.projectsService.createProject(
      {
        name: 'Óptica Cuántica FACYT',
        area: ProjectArea.FISICA,
        scope: ProjectScope.INTERNO,
        startDate: `${year}-01-01`,
        endDate: `${year}-11-30`,
      },
      generadorActor,
    );
    expect(project.code).toBe(`FIS-${year}-01`);

    const group = await sys.paymentGroupsService.createPaymentGroup(
      {
        name: 'Quincenal Investigadores E2E',
        periodicity: Periodicity.QUINCENAL,
        cutoffRules: 'Del 1 al 15 y del 16 al fin de mes',
      },
      adminActor,
    );
    const groupPeriods = await sys.paymentGroupsService.findPeriods(group.id);
    expect(groupPeriods.length).toBe(48);

    const beneficiary = await sys.beneficiariesService.createBeneficiary(
      {
        dni: 'V-20111222',
        fullName: 'Dr. Marcos Silva',
        email: 'msilva@uc.edu.ve',
        bankInfo: 'Zelle USD',
      },
      generadorActor,
    );

    // 2. Asignación dentro de vigencia y bloqueo de traslape (RN-CAT-04)
    const assignment = await sys.assignmentsService.createAssignment(
      {
        beneficiaryId: beneficiary.id,
        projectId: project.id,
        paymentGroupId: group.id,
        amountPerPeriod: '300.00',
        startDate: `${year}-10-01`,
        endDate: `${year}-11-30`,
      },
      generadorActor,
    );
    expect(assignment.isActive).toBe(true);

    await expect(
      sys.assignmentsService.createAssignment(
        {
          beneficiaryId: beneficiary.id,
          projectId: project.id,
          paymentGroupId: group.id,
          amountPerPeriod: '150.00',
          startDate: `${year}-11-01`,
          endDate: `${year}-11-15`,
        },
        generadorActor,
      ),
    ).rejects.toThrow(ConflictException);

    // 3. Causación en 2 períodos consecutivos usando cortes oficiales del grupo
    const nov1Period = groupPeriods.find(
      (p) => p.periodStart.toISOString().slice(0, 10) === `${year}-11-01`,
    )!;
    const nov2Period = groupPeriods.find(
      (p) => p.periodStart.toISOString().slice(0, 10) === `${year}-11-16`,
    )!;

    const batch1 = await sys.accrualsService.generateAccrualBatch(
      {
        projectId: project.id,
        paymentGroupId: group.id,
        periodStart: nov1Period.periodStart.toISOString().slice(0, 10),
        periodEnd: nov1Period.periodEnd.toISOString().slice(0, 10),
      },
      generadorActor,
    );
    const batch2 = await sys.accrualsService.generateAccrualBatch(
      {
        projectId: project.id,
        paymentGroupId: group.id,
        periodStart: nov2Period.periodStart.toISOString().slice(0, 10),
        periodEnd: nov2Period.periodEnd.toISOString().slice(0, 10),
      },
      generadorActor,
    );
    expect(batch1.batch.code).toBe(`LOTE-${year}-11-001`);
    expect(batch2.batch.code).toBe(`LOTE-${year}-11-002`);
    expect(batch1.accruals[0].proratedAmount).toBe('300.00');
    expect(batch2.accruals[0].proratedAmount).toBe('300.00');

    // Intento de duplicar causación del mismo corte debe fallar (RN-CAUS-04)
    await expect(
      sys.accrualsService.generateAccrualBatch(
        {
          projectId: project.id,
          paymentGroupId: group.id,
          periodStart: nov1Period.periodStart.toISOString().slice(0, 10),
          periodEnd: nov1Period.periodEnd.toISOString().slice(0, 10),
        },
        generadorActor,
      ),
    ).rejects.toThrow(ConflictException);

    // 4. Consolidación de Solicitud de Pago: CREADA -> ENVIADA -> APROBADA
    const request = await sys.paymentRequestsService.createPaymentRequest(
      {
        projectId: project.id,
        accrualIds: [batch1.accruals[0].id, batch2.accruals[0].id],
      },
      generadorActor,
    );
    expect(request.totalAmount).toBe('600.00');
    expect(request.status).toBe(PaymentRequestStatus.CREADA);

    await sys.paymentRequestsService.sendPaymentRequest(
      request.id,
      generadorActor,
    );
    const approved = await sys.paymentRequestsService.reviewPaymentRequest(
      request.id,
      { decision: PaymentRequestStatus.APROBADA },
      receptorActor,
    );
    expect(approved.status).toBe(PaymentRequestStatus.APROBADA);

    // 5. Pago Parcial FIFO ($400 sobre $600): liquida nov1 ($300) y deja nov2 PARCIAL ($200 pendientes)
    const payment1 = await sys.paymentsService.registerPayment(
      {
        paymentRequestId: request.id,
        beneficiaryId: beneficiary.id,
        amount: '400.00',
        paymentDate: `${year}-11-20`,
        reference: 'ZELLE-101',
      },
      receptorActor,
    );
    expect(payment1.payment.receiptCode).toBe(`REC-${year}-0001`);
    expect(payment1.fifoSummary.remainingDebtAfterPayment).toBe('200.00');

    const accAfterPay1 = await sys.accrualsService.findAllAccruals();
    const accNov1 = accAfterPay1.find((a) => a.id === batch1.accruals[0].id)!;
    const accNov2 = accAfterPay1.find((a) => a.id === batch2.accruals[0].id)!;
    expect(accNov1.status).toBe(AccrualStatus.PAGADO);
    expect(accNov1.balanceDue).toBe('0.00');
    expect(accNov2.status).toBe(AccrualStatus.PARCIAL);
    expect(accNov2.balanceDue).toBe('200.00');

    // 6. Segundo Pago FIFO ($200) y cierre formal de solicitud
    const payment2 = await sys.paymentsService.registerPayment(
      {
        paymentRequestId: request.id,
        beneficiaryId: beneficiary.id,
        amount: '200.00',
        paymentDate: `${year}-11-25`,
        reference: 'ZELLE-102',
      },
      receptorActor,
    );
    expect(payment2.fifoSummary.remainingDebtAfterPayment).toBe('0.00');

    const closedReq = await sys.paymentRequestsService.closePaymentRequest(
      request.id,
      receptorActor,
    );
    expect(closedReq.status).toBe(PaymentRequestStatus.CERRADA);

    // 7. Auditoría completa append-only registrada
    const auditLogs = await sys.auditService.findAllLogs({ limit: 50 });
    expect(auditLogs.length).toBeGreaterThanOrEqual(11);
  });

  it('Flujo 2: Reversión transaccional FIFO y anulación en cascada controlada (RN-PAG-03 / RN-GLOB-03 / RN-GLOB-04)', async () => {
    // Arrange
    const sys = bootstrapServices();
    const year = new Date().getUTCFullYear();

    const project = await sys.projectsService.createProject(
      {
        name: 'Genómica Computacional',
        area: ProjectArea.BIOLOGIA,
        scope: ProjectScope.EXTERNO,
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      },
      generadorActor,
    );
    const group = await sys.paymentGroupsService.createPaymentGroup(
      {
        name: 'Mensual Biología E2E',
        periodicity: Periodicity.MENSUAL,
        cutoffRules: 'Mes calendario completo',
      },
      adminActor,
    );
    const periods = await sys.paymentGroupsService.findPeriods(group.id);
    const ben = await sys.beneficiariesService.createBeneficiary(
      { dni: 'V-17555444', fullName: 'Lic. Rosa Méndez' },
      generadorActor,
    );
    await sys.assignmentsService.createAssignment(
      {
        beneficiaryId: ben.id,
        projectId: project.id,
        paymentGroupId: group.id,
        amountPerPeriod: '500.00',
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      },
      generadorActor,
    );
    const batch = await sys.accrualsService.generateAccrualBatch(
      {
        projectId: project.id,
        paymentGroupId: group.id,
        periodStart: periods[0].periodStart.toISOString().slice(0, 10),
        periodEnd: periods[0].periodEnd.toISOString().slice(0, 10),
      },
      generadorActor,
    );
    const req = await sys.paymentRequestsService.createPaymentRequest(
      { projectId: project.id, accrualIds: [batch.accruals[0].id] },
      generadorActor,
    );
    await sys.paymentRequestsService.sendPaymentRequest(req.id, generadorActor);
    await sys.paymentRequestsService.reviewPaymentRequest(
      req.id,
      { decision: PaymentRequestStatus.APROBADA },
      receptorActor,
    );
    const pay = await sys.paymentsService.registerPayment(
      {
        paymentRequestId: req.id,
        beneficiaryId: ben.id,
        amount: '500.00',
        paymentDate: `${year}-02-05`,
      },
      receptorActor,
    );

    // Act & Assert: Mientras haya pagos válidos, no se puede anular solicitud ni lote (RN-GLOB-03)
    await expect(
      sys.annulmentsService.annulPaymentRequest(
        req.id,
        'Intento de anulación indebida sin revertir pago',
        generadorActor,
      ),
    ).rejects.toThrow(BadRequestException);

    // Anulación justificada del pago revierte deuda y reabre solicitud
    const annulledPayment = await sys.annulmentsService.annulPayment(
      pay.payment.id,
      'Transferencia rechazada por banco destino',
      receptorActor,
    );
    expect(annulledPayment.payment.status).toBe(PaymentStatus.ANULADO);

    const reqAfterReversal =
      await sys.paymentRequestsService.findAllPaymentRequests(project.id);
    expect(reqAfterReversal[0].status).toBe(PaymentRequestStatus.APROBADA);
    expect(reqAfterReversal[0].paidAmount).toBe('0.00');

    const accAfterReversal = await sys.accrualsService.findAllAccruals();
    expect(accAfterReversal[0].status).toBe(AccrualStatus.PENDIENTE);
    expect(accAfterReversal[0].balanceDue).toBe('500.00');

    // Ahora sí permite anular la solicitud y posteriormente el lote completo
    const annulledReq = await sys.annulmentsService.annulPaymentRequest(
      req.id,
      'Solicitud reemplazada por ajuste presupuestario',
      generadorActor,
    );
    expect(annulledReq.paymentRequest.status).toBe(
      PaymentRequestStatus.ANULADA,
    );

    const annulledBatch = await sys.annulmentsService.annulAccrualBatch(
      batch.batch.id,
      'Reproceso administrativo del mes completo',
      generadorActor,
    );
    expect(annulledBatch.batch.status).toBe(AccrualBatchStatus.ANULADO);
  });

  it('Flujo 3: Ciclo completo de Caja Chica (Creación -> Apertura -> Desembolso -> Rendición con vuelto -> Cierre -> Arrastre siguiente mes)', async () => {
    // Arrange
    const sys = bootstrapServices();
    const project = await sys.projectsService.createProject(
      {
        name: 'Laboratorio Analítica Química',
        area: ProjectArea.QUIMICA,
        scope: ProjectScope.INTERNO,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      generadorActor,
    );

    // 1. Crear caja chica con tope $250.00 y abrir período inicial 2026-11
    const box = await sys.pettyCashService.createPettyCash(
      {
        name: 'Caja Reactivos Analítica',
        projectId: project.id,
        authorizedAmount: '250.00',
      },
      generadorActor,
    );
    expect(box.status).toBe(PettyCashStatus.ACTIVA);

    const novPeriod = await sys.pettyCashService.openMonthlyPeriod(
      box.id,
      { yearMonth: '2026-11', initialReplenishment: '250.00' },
      generadorActor,
    );
    expect(novPeriod.status).toBe(PettyCashPeriodStatus.SOLICITADO);

    const approvedPeriod = await sys.pettyCashService.approvePeriodOpening(
      novPeriod.id,
      receptorActor,
    );
    expect(approvedPeriod.status).toBe(PettyCashPeriodStatus.ABIERTO);
    expect(approvedPeriod.availableBalance).toBe('250.00');

    // 2. Solicitar vale, aprobarlo (sin mover saldo) y desembolsarlo (descuento inmediato)
    const voucher = await sys.pettyCashService.requestVoucher(
      novPeriod.id,
      {
        beneficiaryName: 'TSU. Ana Torres',
        concept: 'Compra de matraces y guantes',
        requestedAmount: '80.00',
      },
      generadorActor,
    );
    expect(voucher.status).toBe(PettyCashVoucherStatus.SOLICITADO);

    await sys.pettyCashService.approveVoucher(voucher.id, receptorActor);
    const afterDisburse = await sys.pettyCashService.disburseVoucher(
      voucher.id,
      receptorActor,
    );
    expect(afterDisburse.voucher.status).toBe(
      PettyCashVoucherStatus.DESEMBOLSADO,
    );
    expect(afterDisburse.newAvailableBalance).toBe('170.00');

    // 3. No se puede cerrar el mes mientras exista un vale desembolsado sin rendir (RN-CAJA-04)
    await expect(
      sys.pettyCashService.closeMonthlyPeriod(novPeriod.id, receptorActor),
    ).rejects.toThrow(BadRequestException);

    // 4. Rendir vale por $55.50 -> vuelto de $24.50 retorna al saldo disponible ($194.50)
    const afterSettle = await sys.pettyCashService.settleVoucher(
      voucher.id,
      {
        settledAmount: '55.50',
        invoiceReference: 'FACT-00412',
        attachmentUrl: '/uploads/comprobante_test.pdf',
      },
      generadorActor,
    );
    expect(afterSettle.voucher.status).toBe(PettyCashVoucherStatus.RENDIDO);
    expect(afterSettle.voucher.returnedAmount).toBe('24.50');
    expect(afterSettle.newAvailableBalance).toBe('194.50');

    // 5. Cerrar mes 2026-11 y verificar arrastre exacto a 2026-12 + bloqueo de exceso sobre tope
    const closedNov = await sys.pettyCashService.closeMonthlyPeriod(
      novPeriod.id,
      receptorActor,
    );
    expect(closedNov.closingBalance).toBe('194.50');

    // Exceder el tope de $250.00 (194.50 + 100 = 294.50 > 250) debe fallar
    await expect(
      sys.pettyCashService.openMonthlyPeriod(
        box.id,
        { yearMonth: '2026-12', initialReplenishment: '100.00' },
        generadorActor,
      ),
    ).rejects.toThrow(BadRequestException);

    const dicPeriod = await sys.pettyCashService.openMonthlyPeriod(
      box.id,
      { yearMonth: '2026-12', initialReplenishment: '55.50' },
      generadorActor,
    );
    expect(dicPeriod.carryoverBalance).toBe('194.50');
    expect(dicPeriod.availableBalance).toBe('250.00');

    // Cerrar período y cerrar caja chica definitivamente
    await sys.pettyCashService.approvePeriodOpening(
      dicPeriod.id,
      receptorActor,
    );
    await sys.pettyCashService.closeMonthlyPeriod(dicPeriod.id, receptorActor);
    const closedBox = await sys.pettyCashService.closePettyCash(
      box.id,
      receptorActor,
    );
    expect(closedBox.status).toBe(PettyCashStatus.CERRADA);
  });
});

