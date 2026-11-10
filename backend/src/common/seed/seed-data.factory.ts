import {
  Periodicity,
  ProjectArea,
  ProjectScope,
  UserRole,
} from '../constants/domain.enums';
import { hashPassword } from '../security/crypto.helper';

export const DEFAULT_DEMO_PASSWORD = 'PasswordUC2026!' as const;

export interface DemoUserSeed {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: UserRole;
}

export interface DemoProjectSeed {
  id: string;
  code: string;
  name: string;
  area: ProjectArea;
  scope: ProjectScope;
  startDate: Date;
  endDate: Date;
}

export interface DemoPaymentGroupSeed {
  id: string;
  name: string;
  periodicity: Periodicity;
  cutoffRules: string;
}

/**
 * Construye los datos iniciales deterministas para pruebas y demostración (Entregable #3).
 * Cumple RN-SEG-01, RN-SEG-02, RN-CAT-01 y RN-CAT-03.
 */
export function buildInitialSeedCatalog(
  customPassword: string = DEFAULT_DEMO_PASSWORD,
): {
  users: DemoUserSeed[];
  projects: DemoProjectSeed[];
  paymentGroups: DemoPaymentGroupSeed[];
} {
  const sharedHash = hashPassword(customPassword);

  const users: DemoUserSeed[] = [
    {
      id: '11111111-1111-4111-8111-111111111101',
      email: 'admin@uc.edu.ve',
      fullName: 'Ing. Carlos Rivas (Administrador del Sistema)',
      passwordHash: sharedHash,
      role: UserRole.ADMIN,
    },
    {
      id: '11111111-1111-4111-8111-111111111102',
      email: 'coordinador@uc.edu.ve',
      fullName: 'Dra. Elena Vargas (Coordinadora General - Generador)',
      passwordHash: sharedHash,
      role: UserRole.GENERADOR,
    },
    {
      id: '11111111-1111-4111-8111-111111111103',
      email: 'gerente@uc.edu.ve',
      fullName: 'Lic. Roberto Silva (Gerente Administración - Receptor)',
      passwordHash: sharedHash,
      role: UserRole.RECEPTOR,
    },
  ];

  const projects: DemoProjectSeed[] = [
    {
      id: '22222222-2222-4222-8222-222222222201',
      code: 'FIS-2026-01',
      name: 'Espectroscopía Láser y Óptica Cuántica',
      area: ProjectArea.FISICA,
      scope: ProjectScope.INTERNO,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
    {
      id: '22222222-2222-4222-8222-222222222202',
      code: 'QUI-2026-02',
      name: 'Síntesis de Catalizadores Orgánicos',
      area: ProjectArea.QUIMICA,
      scope: ProjectScope.EXTERNO,
      startDate: new Date('2026-02-01T00:00:00Z'),
      endDate: new Date('2026-11-30T00:00:00Z'),
    },
    {
      id: '22222222-2222-4222-8222-222222222203',
      code: 'BIO-2026-03',
      name: 'Genómica de Microorganismos Tropicales',
      area: ProjectArea.BIOLOGIA,
      scope: ProjectScope.INTERNO,
      startDate: new Date('2026-03-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
    },
  ];

  const paymentGroups: DemoPaymentGroupSeed[] = [
    {
      id: '33333333-3333-4333-8333-333333333301',
      name: 'Semanal Asistentes de Campo',
      periodicity: Periodicity.SEMANAL,
      cutoffRules: 'Corte cada viernes (7 días calendario)',
    },
    {
      id: '33333333-3333-4333-8333-333333333302',
      name: 'Quincenal Investigadores',
      periodicity: Periodicity.QUINCENAL,
      cutoffRules: 'Cortes días 15 y último de cada mes',
    },
    {
      id: '33333333-3333-4333-8333-333333333303',
      name: 'Mensual Directores de Laboratorio',
      periodicity: Periodicity.MENSUAL,
      cutoffRules: 'Corte el último día calendario del mes',
    },
  ];

  return { users, projects, paymentGroups };
}
