-- ============================================================================
-- SCRIPT DDL DE CREACIÓN DE BASE DE DATOS (ENTREGABLE #3)
-- Universidad de Carabobo - Escuela de Computación - Sistemas de Información
-- Proyecto: Sistema de Control de Pagos y Asignaciones (USD)
-- Motor: PostgreSQL 16+
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Tipos Enumerados (Enums)
DO $$ BEGIN
    CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'GENERADOR', 'RECEPTOR');
    CREATE TYPE "ProjectArea" AS ENUM ('FISICA', 'QUIMICA', 'BIOLOGIA');
    CREATE TYPE "ProjectScope" AS ENUM ('INTERNO', 'EXTERNO');
    CREATE TYPE "ProjectStatus" AS ENUM ('ACTIVO', 'INACTIVO', 'CERRADO');
    CREATE TYPE "Periodicity" AS ENUM ('SEMANAL', 'QUINCENAL', 'MENSUAL');
    CREATE TYPE "AccrualBatchStatus" AS ENUM ('GENERADO', 'ANULADO');
    CREATE TYPE "AccrualStatus" AS ENUM ('PENDIENTE', 'PARCIAL', 'PAGADO', 'ANULADO');
    CREATE TYPE "PaymentRequestStatus" AS ENUM ('CREADA', 'ENVIADA', 'APROBADA', 'RECHAZADA', 'ENTREGADA', 'CERRADA', 'ANULADA');
    CREATE TYPE "PaymentStatus" AS ENUM ('VALIDO', 'ANULADO');
    CREATE TYPE "AnnulledEntityType" AS ENUM ('ACCRUAL_BATCH', 'ACCRUAL', 'PAYMENT_REQUEST', 'PAYMENT', 'PETTY_CASH_VOUCHER');
    CREATE TYPE "PettyCashStatus" AS ENUM ('ACTIVA', 'CERRADA');
    CREATE TYPE "PettyCashPeriodStatus" AS ENUM ('SOLICITADO', 'ABIERTO', 'CERRADO');
    CREATE TYPE "PettyCashVoucherStatus" AS ENUM ('SOLICITADO', 'APROBADO', 'RECHAZADO', 'DESEMBOLSADO', 'RENDIDO', 'ANULADO');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Tabla de Usuarios del Sistema (Segregación de 3 roles: RN-SEG-02)
CREATE TABLE IF NOT EXISTS "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(150) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "users_email_key" UNIQUE ("email")
);

-- 3. Tabla de Beneficiarios (Personal que cobra, SIN usuario: RN-SEG-01)
CREATE TABLE IF NOT EXISTS "beneficiaries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dni" VARCHAR(30) NOT NULL,
    "full_name" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150),
    "phone" VARCHAR(40),
    "bank_info" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "beneficiaries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "beneficiaries_dni_key" UNIQUE ("dni")
);

-- 4. Tabla de Proyectos (Física, Química, Biología: RN-CAT-01)
CREATE TABLE IF NOT EXISTS "projects" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "area" "ProjectArea" NOT NULL,
    "scope" "ProjectScope" NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "status" "ProjectStatus" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "projects_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "projects_code_key" UNIQUE ("code"),
    CONSTRAINT "projects_valid_dates_chk" CHECK ("end_date" >= "start_date")
);

-- 5. Tabla de Grupos de Pago (RN-CAT-03)
CREATE TABLE IF NOT EXISTS "payment_groups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "periodicity" "Periodicity" NOT NULL,
    "cutoff_rules" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_groups_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_groups_name_key" UNIQUE ("name")
);

-- 6. Tabla de Asignaciones (Cruce Persona x Proyecto x Grupo de Pago: RN-CAT-04)
CREATE TABLE IF NOT EXISTS "assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "beneficiary_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "payment_group_id" UUID NOT NULL,
    "amount_per_period" NUMERIC(12, 2) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "assignments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "assignments_positive_amount_chk" CHECK ("amount_per_period" > 0),
    CONSTRAINT "assignments_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT,
    CONSTRAINT "assignments_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
    CONSTRAINT "assignments_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "payment_groups"("id") ON DELETE RESTRICT
);

-- 7. Tabla de Lotes de Causación (RN-CAUS-04)
CREATE TABLE IF NOT EXISTS "accrual_batches" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "project_id" UUID NOT NULL,
    "payment_group_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "total_days" INTEGER NOT NULL,
    "total_amount" NUMERIC(12, 2) NOT NULL,
    "status" "AccrualBatchStatus" NOT NULL DEFAULT 'GENERADO',
    "generated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accrual_batches_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accrual_batches_code_key" UNIQUE ("code"),
    CONSTRAINT "accrual_batches_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
    CONSTRAINT "accrual_batches_payment_group_id_fkey" FOREIGN KEY ("payment_group_id") REFERENCES "payment_groups"("id") ON DELETE RESTRICT,
    CONSTRAINT "accrual_batches_generated_by_id_fkey" FOREIGN KEY ("generated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 8. Tabla de Causaciones Individuales Prorrateadas (Inmutable: RN-CAUS-01 a 04)
CREATE TABLE IF NOT EXISTS "accruals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "batch_id" UUID NOT NULL,
    "assignment_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "active_days" INTEGER NOT NULL,
    "total_period_days" INTEGER NOT NULL,
    "prorated_amount" NUMERIC(12, 2) NOT NULL,
    "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "balance_due" NUMERIC(12, 2) NOT NULL,
    "status" "AccrualStatus" NOT NULL DEFAULT 'PENDIENTE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "accruals_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "accruals_non_negative_balance_chk" CHECK ("balance_due" >= 0 AND "paid_amount" >= 0),
    CONSTRAINT "accruals_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "accrual_batches"("id") ON DELETE RESTRICT,
    CONSTRAINT "accruals_assignment_id_fkey" FOREIGN KEY ("assignment_id") REFERENCES "assignments"("id") ON DELETE RESTRICT,
    CONSTRAINT "accruals_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT,
    CONSTRAINT "accruals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
);

-- 9. Tabla de Solicitudes de Pago (RN-PAG-01)
CREATE TABLE IF NOT EXISTS "payment_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "project_id" UUID NOT NULL,
    "created_by_id" UUID NOT NULL,
    "reviewed_by_id" UUID,
    "total_amount" NUMERIC(12, 2) NOT NULL,
    "paid_amount" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'CREADA',
    "rejection_reason" TEXT,
    "sent_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_requests_code_key" UNIQUE ("code"),
    CONSTRAINT "payment_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
    CONSTRAINT "payment_requests_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "payment_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 10. Ítems de Solicitud de Pago
CREATE TABLE IF NOT EXISTS "payment_request_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_request_id" UUID NOT NULL,
    "accrual_id" UUID NOT NULL,
    "requested_amount" NUMERIC(12, 2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_request_items_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_request_items_unique_pair" UNIQUE ("payment_request_id", "accrual_id"),
    CONSTRAINT "payment_request_items_request_fkey" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT,
    CONSTRAINT "payment_request_items_accrual_fkey" FOREIGN KEY ("accrual_id") REFERENCES "accruals"("id") ON DELETE RESTRICT
);

-- 11. Tabla de Pagos / Entregas de Fondos y Recibos (Inmutable: RN-PAG-02)
CREATE TABLE IF NOT EXISTS "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "receipt_code" VARCHAR(50) NOT NULL,
    "payment_request_id" UUID NOT NULL,
    "beneficiary_id" UUID NOT NULL,
    "delivered_by_id" UUID NOT NULL,
    "amount" NUMERIC(12, 2) NOT NULL,
    "payment_date" DATE NOT NULL,
    "reference" VARCHAR(120),
    "notes" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'VALIDO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payments_receipt_code_key" UNIQUE ("receipt_code"),
    CONSTRAINT "payments_positive_amount_chk" CHECK ("amount" > 0),
    CONSTRAINT "payments_request_id_fkey" FOREIGN KEY ("payment_request_id") REFERENCES "payment_requests"("id") ON DELETE RESTRICT,
    CONSTRAINT "payments_beneficiary_id_fkey" FOREIGN KEY ("beneficiary_id") REFERENCES "beneficiaries"("id") ON DELETE RESTRICT,
    CONSTRAINT "payments_delivered_by_id_fkey" FOREIGN KEY ("delivered_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 12. Tabla Puente de Prelación FIFO (RN-PAG-02)
CREATE TABLE IF NOT EXISTS "payment_allocations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "payment_id" UUID NOT NULL,
    "accrual_id" UUID NOT NULL,
    "allocated_amount" NUMERIC(12, 2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "payment_allocations_positive_chk" CHECK ("allocated_amount" > 0),
    CONSTRAINT "payment_allocations_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
    CONSTRAINT "payment_allocations_accrual_id_fkey" FOREIGN KEY ("accrual_id") REFERENCES "accruals"("id") ON DELETE RESTRICT
);

-- 13. Tabla de Anulaciones Justificadas (RN-GLOB-04)
CREATE TABLE IF NOT EXISTS "annulments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "entity_type" "AnnulledEntityType" NOT NULL,
    "entity_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "annulled_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "annulments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "annulments_annulled_by_id_fkey" FOREIGN KEY ("annulled_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 14. Tabla de Cajas Chicas por Proyecto (RN-CAJA-01)
CREATE TABLE IF NOT EXISTS "petty_cashes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(40) NOT NULL,
    "name" VARCHAR(150) NOT NULL,
    "project_id" UUID NOT NULL,
    "authorized_amount" NUMERIC(12, 2) NOT NULL,
    "status" "PettyCashStatus" NOT NULL DEFAULT 'ACTIVA',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petty_cashes_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "petty_cashes_code_key" UNIQUE ("code"),
    CONSTRAINT "petty_cashes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
);

-- 15. Tabla de Períodos Mensuales de Caja Chica y Arrastre de Saldo (RN-CAJA-02 a 04)
CREATE TABLE IF NOT EXISTS "petty_cash_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "petty_cash_id" UUID NOT NULL,
    "year_month" VARCHAR(7) NOT NULL,
    "carryover_balance" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "initial_replenishment" NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    "available_balance" NUMERIC(12, 2) NOT NULL,
    "closing_balance" NUMERIC(12, 2),
    "status" "PettyCashPeriodStatus" NOT NULL DEFAULT 'SOLICITADO',
    "opened_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "closed_by_id" UUID,
    "opened_at" TIMESTAMP(3),
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petty_cash_periods_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "petty_cash_periods_unique_month" UNIQUE ("petty_cash_id", "year_month"),
    CONSTRAINT "petty_cash_periods_non_negative_balance_chk" CHECK ("available_balance" >= 0),
    CONSTRAINT "petty_cash_periods_petty_cash_fkey" FOREIGN KEY ("petty_cash_id") REFERENCES "petty_cashes"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_periods_opened_by_fkey" FOREIGN KEY ("opened_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_periods_approved_by_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_periods_closed_by_fkey" FOREIGN KEY ("closed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 16. Tabla de Vales de Caja Chica (RN-CAJA-03)
CREATE TABLE IF NOT EXISTS "petty_cash_vouchers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(50) NOT NULL,
    "period_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "approved_by_id" UUID,
    "disbursed_by_id" UUID,
    "beneficiary_name" VARCHAR(150) NOT NULL,
    "concept" TEXT NOT NULL,
    "requested_amount" NUMERIC(12, 2) NOT NULL,
    "disbursed_amount" NUMERIC(12, 2),
    "settled_amount" NUMERIC(12, 2),
    "returned_amount" NUMERIC(12, 2),
    "invoice_reference" VARCHAR(120),
    "attachment_url" VARCHAR(500),
    "status" "PettyCashVoucherStatus" NOT NULL DEFAULT 'SOLICITADO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "petty_cash_vouchers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "petty_cash_vouchers_code_key" UNIQUE ("code"),
    CONSTRAINT "petty_cash_vouchers_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "petty_cash_periods"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_vouchers_requested_by_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_vouchers_approved_by_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE RESTRICT,
    CONSTRAINT "petty_cash_vouchers_disbursed_by_fkey" FOREIGN KEY ("disbursed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 17. Tabla de Parámetros del Sistema
CREATE TABLE IF NOT EXISTS "system_parameters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" VARCHAR(80) NOT NULL,
    "value" TEXT NOT NULL,
    "description" VARCHAR(255) NOT NULL,
    "updated_by_id" UUID,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "system_parameters_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "system_parameters_key_key" UNIQUE ("key"),
    CONSTRAINT "system_parameters_updated_by_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- 18. Tabla de Auditoría Inmutable (Append-Only: RN-AUD-03)
CREATE TABLE IF NOT EXISTS "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "user_role" "UserRole",
    "action" VARCHAR(60) NOT NULL,
    "table_name" VARCHAR(80) NOT NULL,
    "record_id" VARCHAR(80) NOT NULL,
    "old_values" JSONB,
    "new_values" JSONB,
    "ip_address" VARCHAR(50),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT
);

-- Índices de Rendimiento para Consultas Clave y Cola FIFO
CREATE INDEX IF NOT EXISTS "idx_accruals_fifo" ON "accruals" ("beneficiary_id", "status", "period_start", "created_at");
CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" ("table_name", "record_id");
