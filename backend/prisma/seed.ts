import { PrismaClient } from '@prisma/client';
import { buildInitialSeedCatalog } from '../src/common/seed/seed-data.factory';

const prisma = new PrismaClient();

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
  }

  // Beneficiarios de prueba (SIN usuario en el sistema según RN-SEG-01)
  const beneficiaries = [
    {
      id: '44444444-4444-4444-8444-444444444401',
      dni: 'V-18456789',
      fullName: 'Dr. Alejandro Mendoza (Investigador Física)',
      email: 'amendoza@uc.edu.ve',
      phone: '+58-414-4001122',
      bankInfo: 'Zelle: amendoza@uc.edu.ve / Cuenta Custodia USD #4401',
    },
    {
      id: '44444444-4444-4444-8444-444444444402',
      dni: 'V-22987654',
      fullName: 'MSc. Valeria Salazar (Investigadora Química y Biología)',
      email: 'vsalazar@uc.edu.ve',
      phone: '+58-412-5003344',
      bankInfo: 'Zelle: vsalazar@uc.edu.ve / Taquilla Efectivo USD #1108',
    },
    {
      id: '44444444-4444-4444-8444-444444444403',
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
