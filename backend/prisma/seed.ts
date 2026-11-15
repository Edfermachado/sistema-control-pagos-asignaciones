import { PrismaClient } from '@prisma/client';
import {
  AccrualStatus,
  PaymentRequestStatus,
  PaymentStatus,
  PettyCashPeriodStatus,
  PettyCashStatus,
  PettyCashVoucherStatus,
} from '../src/common/constants/domain.enums';
import { buildInitialSeedCatalog } from '../src/common/seed/seed-data.factory';
import { buildDefaultPaymentPeriods } from '../src/modules/payment-groups/domain/payment-period.generator';

const prisma = new PrismaClient();

const USERS = {
  admin: '11111111-1111-4111-8111-111111111101',
  generador: '11111111-1111-4111-8111-111111111102',
  receptor: '11111111-1111-4111-8111-111111111103',
} as const;

const PROJECTS = {
  fisica: '22222222-2222-4222-8222-222222222201',
  quimica: '22222222-2222-4222-8222-222222222202',
  biologia: '22222222-2222-4222-8222-222222222203',
} as const;

const PAYMENT_GROUPS = {
  semanal: '33333333-3333-4333-8333-333333333301',
  quincenal: '33333333-3333-4333-8333-333333333302',
  mensual: '33333333-3333-4333-8333-333333333303',
} as const;

const BENEFICIARIES = {
  alejandro: '44444444-4444-4444-8444-444444444401',
  valeria: '44444444-4444-4444-8444-444444444402',
  gabriel: '44444444-4444-4444-8444-444444444403',
} as const;

const ASSIGNMENTS = {
  alejandroFisica: '55555555-5555-4555-8555-555555555501',
  valeriaQuimica: '55555555-5555-4555-8555-555555555502',
  valeriaBiologia: '55555555-5555-4555-8555-555555555503',
} as const;

const BATCHES = {
  fisicaQ1: '66666666-6666-4666-8666-666666666601',
  fisicaQ2: '66666666-6666-4666-8666-666666666602',
} as const;

const ACCRUALS = {
  fisicaQ1: '77777777-7777-4777-8777-777777777701',
  fisicaQ2: '77777777-7777-4777-8777-777777777702',
} as const;

const PAYMENT_REQUEST = '88888888-8888-4888-8888-888888888801';
const PAYMENT = '99999999-9999-4999-8999-999999999901';
const PETTY_CASH = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01';
const PETTY_CASH_PERIODS = {
  octubre: 'cccccccc-cccc-4ccc-8ccc-cccccccccc01',
  noviembre: 'cccccccc-cccc-4ccc-8ccc-cccccccccc02',
} as const;

async function main(): Promise<void> {
  const catalog = buildInitialSeedCatalog();

  for (const u of catalog.users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: u,
    });
  }

  for (const p of catalog.projects) {
    await prisma.project.upsert({
      where: { code: p.code },
      update: {},
      create: p,
    });
  }

  for (const g of catalog.paymentGroups) {
    await prisma.paymentGroup.upsert({
      where: { name: g.name },
      update: {},
      create: g,
    });

    const generatedPeriods = [2026, 2027].flatMap((year) =>
      buildDefaultPaymentPeriods(g.periodicity, year).map((period) => ({
        paymentGroupId: g.id,
        periodStart: period.periodStart,
        periodEnd: period.periodEnd,
        label: period.label,
      })),
    );

    await prisma.paymentGroupPeriod.createMany({
      data: generatedPeriods,
      skipDuplicates: true,
    });
  }

  // Beneficiarios de prueba (SIN usuario en el sistema según RN-SEG-01)
  const beneficiaries = [
    {
      id: BENEFICIARIES.alejandro,
      dni: 'V-18456789',
      fullName: 'Dr. Alejandro Mendoza (Investigador Física)',
      email: 'amendoza@uc.edu.ve',
      phone: '+58-414-4001122',
      bankInfo: 'Zelle: amendoza@uc.edu.ve / Cuenta Custodia USD #4401',
    },
    {
      id: BENEFICIARIES.valeria,
      dni: 'V-22987654',
      fullName: 'MSc. Valeria Salazar (Investigadora Química y Biología)',
      email: 'vsalazar@uc.edu.ve',
      phone: '+58-412-5003344',
      bankInfo: 'Zelle: vsalazar@uc.edu.ve / Taquilla Efectivo USD #1108',
    },
    {
      id: BENEFICIARIES.gabriel,
      dni: 'V-26111222',
      fullName: 'Lic. Gabriel Tovar (Asistente Biología Molecular)',
      email: 'gtovar@uc.edu.ve',
      phone: '+58-424-3009988',
      bankInfo: 'Efectivo USD / Transferencia Custodia #7702',
    },
  ];

  for (const b of beneficiaries) {
    await prisma.beneficiary.upsert({
      where: { dni: b.dni },
      update: {},
      create: b,
    });
  }

  // Asignaciones de demostración (RN-CAT-04)
  const assignments = [
    {
      id: ASSIGNMENTS.alejandroFisica,
      beneficiaryId: BENEFICIARIES.alejandro,
      projectId: PROJECTS.fisica,
      paymentGroupId: PAYMENT_GROUPS.quincenal,
      amountPerPeriod: '450.00',
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
    {
      id: ASSIGNMENTS.valeriaQuimica,
      beneficiaryId: BENEFICIARIES.valeria,
      projectId: PROJECTS.quimica,
      paymentGroupId: PAYMENT_GROUPS.quincenal,
      amountPerPeriod: '450.00',
      startDate: new Date('2026-11-11T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
    },
    {
      id: ASSIGNMENTS.valeriaBiologia,
      beneficiaryId: BENEFICIARIES.valeria,
      projectId: PROJECTS.biologia,
      paymentGroupId: PAYMENT_GROUPS.mensual,
      amountPerPeriod: '600.00',
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
  ];

  for (const a of assignments) {
    await prisma.assignment.upsert({
      where: { id: a.id },
      update: {},
      create: a,
    });
  }

  // Lotes y causaciones prorrateadas de demostración (RN-CAUS-01 a 04)
  const batches = [
    {
      id: BATCHES.fisicaQ1,
      code: 'LOTE-FIS-2026-Q1',
      projectId: PROJECTS.fisica,
      paymentGroupId: PAYMENT_GROUPS.quincenal,
      periodStart: new Date('2026-10-01T00:00:00Z'),
      periodEnd: new Date('2026-10-15T00:00:00Z'),
      totalDays: 15,
      totalAmount: '450.00',
    },
    {
      id: BATCHES.fisicaQ2,
      code: 'LOTE-FIS-2026-Q2',
      projectId: PROJECTS.fisica,
      paymentGroupId: PAYMENT_GROUPS.quincenal,
      periodStart: new Date('2026-10-16T00:00:00Z'),
      periodEnd: new Date('2026-10-31T00:00:00Z'),
      totalDays: 16,
      totalAmount: '450.00',
    },
  ];

  for (const batch of batches) {
    await prisma.accrualBatch.upsert({
      where: { code: batch.code },
      update: {},
      create: { ...batch, generatedById: USERS.generador },
    });
  }

  const accruals = [
    {
      id: ACCRUALS.fisicaQ1,
      batchId: BATCHES.fisicaQ1,
      assignmentId: ASSIGNMENTS.alejandroFisica,
      beneficiaryId: BENEFICIARIES.alejandro,
      projectId: PROJECTS.fisica,
      periodStart: new Date('2026-10-01T00:00:00Z'),
      periodEnd: new Date('2026-10-15T00:00:00Z'),
      activeDays: 15,
      totalPeriodDays: 15,
      proratedAmount: '450.00',
      paidAmount: '450.00',
      balanceDue: '0.00',
      status: AccrualStatus.PAGADO,
    },
    {
      id: ACCRUALS.fisicaQ2,
      batchId: BATCHES.fisicaQ2,
      assignmentId: ASSIGNMENTS.alejandroFisica,
      beneficiaryId: BENEFICIARIES.alejandro,
      projectId: PROJECTS.fisica,
      periodStart: new Date('2026-10-16T00:00:00Z'),
      periodEnd: new Date('2026-10-31T00:00:00Z'),
      activeDays: 16,
      totalPeriodDays: 16,
      proratedAmount: '450.00',
      paidAmount: '150.00',
      balanceDue: '300.00',
      status: AccrualStatus.PARCIAL,
    },
  ];

  for (const accrual of accruals) {
    await prisma.accrual.upsert({
      where: { id: accrual.id },
      update: {},
      create: accrual,
    });
  }

  // Solicitud de pago ENTREGADA con pago parcial FIFO (RN-PAG-01 / RN-PAG-02)
  await prisma.paymentRequest.upsert({
    where: { code: 'SOL-FIS-2026-001' },
    update: {},
    create: {
      id: PAYMENT_REQUEST,
      code: 'SOL-FIS-2026-001',
      projectId: PROJECTS.fisica,
      createdById: USERS.generador,
      reviewedById: USERS.receptor,
      totalAmount: '900.00',
      paidAmount: '600.00',
      status: PaymentRequestStatus.ENTREGADA,
      items: {
        create: [
          {
            accrualId: ACCRUALS.fisicaQ1,
            requestedAmount: '450.00',
          },
          {
            accrualId: ACCRUALS.fisicaQ2,
            requestedAmount: '450.00',
          },
        ],
      },
    },
  });

  const requestItems = [
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01',
      paymentRequestId: PAYMENT_REQUEST,
      accrualId: ACCRUALS.fisicaQ1,
      requestedAmount: '450.00',
    },
    {
      id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02',
      paymentRequestId: PAYMENT_REQUEST,
      accrualId: ACCRUALS.fisicaQ2,
      requestedAmount: '450.00',
    },
  ];

  for (const item of requestItems) {
    await prisma.paymentRequestItem.upsert({
      where: {
        paymentRequestId_accrualId: {
          paymentRequestId: item.paymentRequestId,
          accrualId: item.accrualId,
        },
      },
      update: {},
      create: item,
    });
  }

  await prisma.payment.upsert({
    where: { receiptCode: 'REC-2026-001' },
    update: {},
    create: {
      id: PAYMENT,
      receiptCode: 'REC-2026-001',
      paymentRequestId: PAYMENT_REQUEST,
      beneficiaryId: BENEFICIARIES.alejandro,
      deliveredById: USERS.receptor,
      amount: '600.00',
      paymentDate: new Date('2026-11-05T00:00:00Z'),
      reference: 'ZELLE-UC-9901',
      status: PaymentStatus.VALIDO,
    },
  });

  const allocations = [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01',
      paymentId: PAYMENT,
      accrualId: ACCRUALS.fisicaQ1,
      allocatedAmount: '450.00',
    },
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02',
      paymentId: PAYMENT,
      accrualId: ACCRUALS.fisicaQ2,
      allocatedAmount: '150.00',
    },
  ];

  for (const allocation of allocations) {
    await prisma.paymentAllocation.upsert({
      where: { id: allocation.id },
      update: {},
      create: allocation,
    });
  }

  // Caja chica con arrastre de saldo mensual (RN-CAJA-01 a 04)
  await prisma.pettyCash.upsert({
    where: { code: 'CC-FIS-01' },
    update: {},
    create: {
      id: PETTY_CASH,
      code: 'CC-FIS-01',
      name: 'Caja Chica Laboratorio Óptica Cuántica',
      projectId: PROJECTS.fisica,
      authorizedAmount: '200.00',
      status: PettyCashStatus.ACTIVA,
    },
  });

  await prisma.pettyCashPeriod.upsert({
    where: {
      pettyCashId_yearMonth: {
        pettyCashId: PETTY_CASH,
        yearMonth: '2026-10',
      },
    },
    update: {},
    create: {
      id: PETTY_CASH_PERIODS.octubre,
      pettyCashId: PETTY_CASH,
      yearMonth: '2026-10',
      carryoverBalance: '0.00',
      initialReplenishment: '200.00',
      availableBalance: '65.50',
      closingBalance: '65.50',
      status: PettyCashPeriodStatus.CERRADO,
      openedById: USERS.generador,
      approvedById: USERS.receptor,
      closedById: USERS.receptor,
    },
  });

  await prisma.pettyCashPeriod.upsert({
    where: {
      pettyCashId_yearMonth: {
        pettyCashId: PETTY_CASH,
        yearMonth: '2026-11',
      },
    },
    update: {},
    create: {
      id: PETTY_CASH_PERIODS.noviembre,
      pettyCashId: PETTY_CASH,
      yearMonth: '2026-11',
      carryoverBalance: '65.50',
      initialReplenishment: '134.50',
      availableBalance: '200.00',
      status: PettyCashPeriodStatus.ABIERTO,
      openedById: USERS.generador,
      approvedById: USERS.receptor,
    },
  });

  await prisma.pettyCashVoucher.upsert({
    where: { code: 'VALE-FIS-2026-10' },
    update: {},
    create: {
      id: 'dddddddd-dddd-4ddd-8ddd-dddddddddd01',
      code: 'VALE-FIS-2026-10',
      periodId: PETTY_CASH_PERIODS.octubre,
      requestedById: USERS.generador,
      approvedById: USERS.receptor,
      disbursedById: USERS.receptor,
      beneficiaryName: 'TSU. Luis Herrera',
      concept: 'Compra de insumos ópticos y guantes de nitrilo',
      requestedAmount: '134.50',
      disbursedAmount: '134.50',
      settledAmount: '134.50',
      returnedAmount: '0.00',
      invoiceReference: 'FACT-FIS-2026-1042',
      status: PettyCashVoucherStatus.RENDIDO,
    },
  });

  // Parámetros globales del sistema (RF 2.1)
  const parameters = [
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff01',
      key: 'SYSTEM_CURRENCY',
      value: 'USD',
      description:
        'Moneda única del sistema, sin deducciones ni conversiones (RN-GLOB-01)',
    },
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff02',
      key: 'PAYMENT_REQUEST_SCOPE',
      value: 'REQUEST_ITEMS',
      description:
        'Alcance del pago FIFO: solo causaciones incluidas en la solicitud aprobada',
    },
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff03',
      key: 'MAX_UPLOAD_SIZE_MB',
      value: '5',
      description:
        'Tamaño máximo permitido para comprobantes adjuntos en MB',
    },
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff04',
      key: 'PETTY_CASH_REQUIRE_ATTACHMENT',
      value: 'true',
      description:
        'Exigir archivo de comprobante al rendir un vale de caja chica',
    },
    {
      id: 'ffffffff-ffff-4fff-8fff-ffffffffff05',
      key: 'AUDIT_RETENTION_DAYS',
      value: '365',
      description: 'Días de retención de la bitácora de auditoría',
    },
  ];

  for (const parameter of parameters) {
    await prisma.systemParameter.upsert({
      where: { key: parameter.key },
      update: {},
      create: { ...parameter, updatedById: USERS.admin },
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error('Error ejecutando seed:', error);
    await prisma.$disconnect();
    process.exit(1);
  });
