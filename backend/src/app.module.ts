import { Module } from '@nestjs/common';
import { AccrualsModule } from './modules/accruals/accruals.module';
import { AnnulmentsModule } from './modules/annulments/annulments.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { BeneficiariesModule } from './modules/beneficiaries/beneficiaries.module';
import { HealthModule } from './modules/health/health.module';
import { PaymentGroupsModule } from './modules/payment-groups/payment-groups.module';
import { PaymentRequestsModule } from './modules/payment-requests/payment-requests.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { PettyCashModule } from './modules/petty-cash/petty-cash.module';
import { ProjectsModule } from './modules/projects/projects.module';
import { ReportsModule } from './modules/reports/reports.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    HealthModule,
    AuthModule,
    UsersModule,
    BeneficiariesModule,
    ProjectsModule,
    PaymentGroupsModule,
    AssignmentsModule,
    AccrualsModule,
    PaymentRequestsModule,
    PaymentsModule,
    AnnulmentsModule,
    PettyCashModule,
    ReportsModule,
  ],
})
export class AppModule {}
