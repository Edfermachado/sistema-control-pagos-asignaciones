-- ============================================================================
-- SCRIPT DE CARGA DE DATOS INICIALES (SEED FICTICIOS PARA PRUEBAS - ENTREGABLE #3)
-- Universidad de Carabobo - Escuela de Computación - Sistemas de Información
-- Proyecto: Sistema de Control de Pagos y Asignaciones (USD)
-- Contraseña de todos los usuarios de prueba: PasswordUC2026!
-- ============================================================================

-- 1. Usuarios del Sistema (Segregación de Funciones RN-SEG-02: ADMIN, GENERADOR, RECEPTOR)
INSERT INTO "users" ("id", "email", "full_name", "password_hash", "role", "is_active")
VALUES
  ('11111111-1111-4111-8111-111111111101', 'admin@uc.edu.ve', 'Ing. Carlos Rivas (Administrador del Sistema)', '36ec09f5f0914d2b5f13913506df5b15:fd050a4f52bee228a2fb0e5b3039e4f72d82d2243c951b40f3f3e086bb0db56969e2a4a68282b756c53e047b00bb0d418861c61411c3ada78913fcad41e44541', 'ADMIN', true),
  ('11111111-1111-4111-8111-111111111102', 'coordinador@uc.edu.ve', 'Dra. Elena Vargas (Coordinadora General - Generador)', '36ec09f5f0914d2b5f13913506df5b15:fd050a4f52bee228a2fb0e5b3039e4f72d82d2243c951b40f3f3e086bb0db56969e2a4a68282b756c53e047b00bb0d418861c61411c3ada78913fcad41e44541', 'GENERADOR', true),
  ('11111111-1111-4111-8111-111111111103', 'gerente@uc.edu.ve', 'Lic. Roberto Silva (Gerente Administración - Receptor)', '36ec09f5f0914d2b5f13913506df5b15:fd050a4f52bee228a2fb0e5b3039e4f72d82d2243c951b40f3f3e086bb0db56969e2a4a68282b756c53e047b00bb0d418861c61411c3ada78913fcad41e44541', 'RECEPTOR', true)
ON CONFLICT ("email") DO NOTHING;

-- 2. Proyectos Científicos: Física, Química y Biología (RN-CAT-01)
INSERT INTO "projects" ("id", "code", "name", "area", "scope", "start_date", "end_date", "status")
VALUES
  ('22222222-2222-4222-8222-222222222201', 'FIS-2026-01', 'Espectroscopía Láser y Óptica Cuántica', 'FISICA', 'INTERNO', '2026-01-01', '2026-12-31', 'ACTIVO'),
  ('22222222-2222-4222-8222-222222222202', 'QUI-2026-02', 'Síntesis de Catalizadores Orgánicos', 'QUIMICA', 'EXTERNO', '2026-02-01', '2026-11-30', 'ACTIVO'),
  ('22222222-2222-4222-8222-222222222203', 'BIO-2026-03', 'Genómica de Microorganismos Tropicales', 'BIOLOGIA', 'INTERNO', '2026-03-01', '2026-12-31', 'ACTIVO')
ON CONFLICT ("code") DO NOTHING;

-- 3. Grupos de Pago: Semanal, Quincenal y Mensual (RN-CAT-03)
INSERT INTO "payment_groups" ("id", "name", "periodicity", "cutoff_rules", "is_active")
VALUES
  ('33333333-3333-4333-8333-333333333301', 'Semanal Asistentes de Campo', 'SEMANAL', 'Corte cada viernes (7 días calendario)', true),
  ('33333333-3333-4333-8333-333333333302', 'Quincenal Investigadores', 'QUINCENAL', 'Cortes días 15 y último de cada mes', true),
  ('33333333-3333-4333-8333-333333333303', 'Mensual Directores de Laboratorio', 'MENSUAL', 'Corte el último día calendario del mes', true)
ON CONFLICT ("name") DO NOTHING;

-- 3.1 Fechas de corte automáticas para 2026 y 2027 (RN-CAT-03)
DO $$
DECLARE
    grupo RECORD;
    anio INTEGER;
    mes INTEGER;
    ultimo_dia INTEGER;
    inicio_dia INTEGER;
    fin_dia INTEGER;
    numero_semana INTEGER;
BEGIN
    FOR grupo IN SELECT "id", "periodicity" FROM "payment_groups" LOOP
        FOR anio IN 2026..2027 LOOP
            FOR mes IN 1..12 LOOP
                ultimo_dia := EXTRACT(
                    DAY FROM (make_date(anio, mes, 1) + INTERVAL '1 month - 1 day')
                )::INTEGER;

                IF grupo."periodicity" = 'MENSUAL' THEN
                    INSERT INTO "payment_group_periods" ("payment_group_id", "period_start", "period_end", "label")
                    VALUES (grupo."id", make_date(anio, mes, 1), make_date(anio, mes, ultimo_dia), 'Mes ' || mes)
                    ON CONFLICT ("payment_group_id", "period_start", "period_end") DO NOTHING;
                ELSIF grupo."periodicity" = 'QUINCENAL' THEN
                    INSERT INTO "payment_group_periods" ("payment_group_id", "period_start", "period_end", "label")
                    VALUES
                        (grupo."id", make_date(anio, mes, 1), make_date(anio, mes, 15), 'Quincena 1 - Mes ' || mes),
                        (grupo."id", make_date(anio, mes, 16), make_date(anio, mes, ultimo_dia), 'Quincena 2 - Mes ' || mes)
                    ON CONFLICT ("payment_group_id", "period_start", "period_end") DO NOTHING;
                ELSE
                    inicio_dia := 1;
                    numero_semana := 1;
                    WHILE inicio_dia <= ultimo_dia LOOP
                        fin_dia := LEAST(inicio_dia + 6, ultimo_dia);
                        INSERT INTO "payment_group_periods" ("payment_group_id", "period_start", "period_end", "label")
                        VALUES (
                            grupo."id",
                            make_date(anio, mes, inicio_dia),
                            make_date(anio, mes, fin_dia),
                            'Semana ' || numero_semana || ' - Mes ' || mes
                        )
                        ON CONFLICT ("payment_group_id", "period_start", "period_end") DO NOTHING;
                        inicio_dia := fin_dia + 1;
                        numero_semana := numero_semana + 1;
                    END LOOP;
                END IF;
            END LOOP;
        END LOOP;
    END LOOP;
END $$;

-- 4. Beneficiarios — Personal que cobra SIN usuario en el sistema (RN-SEG-01)
INSERT INTO "beneficiaries" ("id", "dni", "full_name", "email", "phone", "bank_info", "is_active")
VALUES
  ('44444444-4444-4444-8444-444444444401', 'V-18456789', 'Dr. Alejandro Mendoza', 'amendoza@uc.edu.ve', '+58-414-4001122', 'Zelle: amendoza@uc.edu.ve / Custodia USD #4401', true),
  ('44444444-4444-4444-8444-444444444402', 'V-22987654', 'MSc. Valeria Salazar', 'vsalazar@uc.edu.ve', '+58-412-5003344', 'Zelle: vsalazar@uc.edu.ve / Efectivo USD #1108', true),
  ('44444444-4444-4444-8444-444444444403', 'V-26111222', 'Lic. Gabriel Tovar', 'gtovar@uc.edu.ve', '+58-424-3009988', 'Efectivo USD / Custodia #7702', true)
ON CONFLICT ("dni") DO NOTHING;

-- 5. Asignaciones (incluye multiplicidad en distintos proyectos y caso con ingreso día 11 para Prorrateo RN-CAUS-02)
INSERT INTO "assignments" ("id", "beneficiary_id", "project_id", "payment_group_id", "amount_per_period", "start_date", "end_date", "is_active")
VALUES
  ('55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', 450.00, '2026-01-01', '2026-12-31', true),
  ('55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333302', 450.00, '2026-11-11', '2026-11-30', true),
  ('55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333303', 600.00, '2026-03-01', '2026-12-31', true),
  ('55555555-5555-4555-8555-555555555504', '44444444-4444-4444-8444-444444444403', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333301', 140.00, '2026-03-01', '2026-12-31', true)
ON CONFLICT ("id") DO NOTHING;

-- 6. Lotes de Causación y Causaciones Prorrateadas (RN-CAUS-01 a 04)
INSERT INTO "accrual_batches" ("id", "code", "project_id", "payment_group_id", "period_start", "period_end", "total_days", "total_amount", "status", "generated_by_id")
VALUES
  ('66666666-6666-4666-8666-666666666601', 'LOTE-FIS-2026-Q1', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', '2026-10-01', '2026-10-15', 15, 450.00, 'GENERADO', '11111111-1111-4111-8111-111111111102'),
  ('66666666-6666-4666-8666-666666666602', 'LOTE-FIS-2026-Q2', '22222222-2222-4222-8222-222222222201', '33333333-3333-4333-8333-333333333302', '2026-10-16', '2026-10-31', 16, 450.00, 'GENERADO', '11111111-1111-4111-8111-111111111102'),
  ('66666666-6666-4666-8666-666666666603', 'LOTE-QUI-2026-Q1', '22222222-2222-4222-8222-222222222202', '33333333-3333-4333-8333-333333333302', '2026-11-01', '2026-11-15', 15, 150.00, 'GENERADO', '11111111-1111-4111-8111-111111111102'),
  ('66666666-6666-4666-8666-666666666604', 'LOTE-BIO-2026-M10', '22222222-2222-4222-8222-222222222203', '33333333-3333-4333-8333-333333333303', '2026-10-01', '2026-10-31', 31, 600.00, 'GENERADO', '11111111-1111-4111-8111-111111111102')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "accruals" ("id", "batch_id", "assignment_id", "beneficiary_id", "project_id", "period_start", "period_end", "active_days", "total_period_days", "prorated_amount", "paid_amount", "balance_due", "status")
VALUES
  ('77777777-7777-4777-8777-777777777701', '66666666-6666-4666-8666-666666666601', '55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '2026-10-01', '2026-10-15', 15, 15, 450.00, 450.00, 0.00, 'PAGADO'),
  ('77777777-7777-4777-8777-777777777702', '66666666-6666-4666-8666-666666666602', '55555555-5555-4555-8555-555555555501', '44444444-4444-4444-8444-444444444401', '22222222-2222-4222-8222-222222222201', '2026-10-16', '2026-10-31', 16, 16, 450.00, 150.00, 300.00, 'PARCIAL'),
  ('77777777-7777-4777-8777-777777777703', '66666666-6666-4666-8666-666666666603', '55555555-5555-4555-8555-555555555502', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222202', '2026-11-01', '2026-11-15', 5, 15, 150.00, 0.00, 150.00, 'PENDIENTE'),
  ('77777777-7777-4777-8777-777777777704', '66666666-6666-4666-8666-666666666604', '55555555-5555-4555-8555-555555555503', '44444444-4444-4444-8444-444444444402', '22222222-2222-4222-8222-222222222203', '2026-10-01', '2026-10-31', 31, 31, 600.00, 0.00, 600.00, 'PENDIENTE')
ON CONFLICT ("id") DO NOTHING;

-- 7. Solicitud de Pago y Pago Parcial aplicado con Prelación FIFO ($600 sobre deuda de $900: RN-PAG-02)
INSERT INTO "payment_requests" ("id", "code", "project_id", "created_by_id", "reviewed_by_id", "total_amount", "paid_amount", "status", "sent_at", "reviewed_at")
VALUES
  ('88888888-8888-4888-8888-888888888801', 'SOL-FIS-2026-001', '22222222-2222-4222-8222-222222222201', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111103', 900.00, 600.00, 'ENTREGADA', '2026-11-01 10:00:00', '2026-11-02 14:30:00'),
  ('88888888-8888-4888-8888-888888888802', 'SOL-BIO-2026-001', '22222222-2222-4222-8222-222222222203', '11111111-1111-4111-8111-111111111102', NULL, 600.00, 0.00, 'ENVIADA', '2026-11-04 09:30:00', NULL)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "payment_request_items" ("id", "payment_request_id", "accrual_id", "requested_amount")
VALUES
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01', '88888888-8888-4888-8888-888888888801', '77777777-7777-4777-8777-777777777701', 450.00),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee02', '88888888-8888-4888-8888-888888888801', '77777777-7777-4777-8777-777777777702', 450.00),
  ('eeeeeeee-eeee-4eee-8eee-eeeeeeeeee03', '88888888-8888-4888-8888-888888888802', '77777777-7777-4777-8777-777777777704', 600.00)
ON CONFLICT ("payment_request_id", "accrual_id") DO NOTHING;

INSERT INTO "payments" ("id", "receipt_code", "payment_request_id", "beneficiary_id", "delivered_by_id", "amount", "payment_date", "reference", "status")
VALUES
  ('99999999-9999-4999-8999-999999999901', 'REC-2026-001', '88888888-8888-4888-8888-888888888801', '44444444-4444-4444-8444-444444444401', '11111111-1111-4111-8111-111111111103', 600.00, '2026-11-05', 'ZELLE-UC-9901', 'VALIDO')
ON CONFLICT ("receipt_code") DO NOTHING;

INSERT INTO "payment_allocations" ("id", "payment_id", "accrual_id", "allocated_amount")
VALUES
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01', '99999999-9999-4999-8999-999999999901', '77777777-7777-4777-8777-777777777701', 450.00),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02', '99999999-9999-4999-8999-999999999901', '77777777-7777-4777-8777-777777777702', 150.00)
ON CONFLICT ("id") DO NOTHING;

-- 8. Caja Chica con Arrastre de Saldo Mensual (Octubre CERRADO con $65.50 -> Noviembre ABIERTO con $65.50 arrastrados: RN-CAJA-04)
INSERT INTO "petty_cashes" ("id", "code", "name", "project_id", "authorized_amount", "status")
VALUES
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', 'CC-FIS-01', 'Caja Chica Laboratorio Óptica Cuántica', '22222222-2222-4222-8222-222222222201', 200.00, 'ACTIVA')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "petty_cash_periods" ("id", "petty_cash_id", "year_month", "carryover_balance", "initial_replenishment", "available_balance", "closing_balance", "status", "opened_by_id", "approved_by_id", "closed_by_id", "opened_at", "closed_at")
VALUES
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc01', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', '2026-10', 0.00, 200.00, 65.50, 65.50, 'CERRADO', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111103', '2026-10-01 08:30:00', '2026-10-31 17:00:00'),
  ('cccccccc-cccc-4ccc-8ccc-cccccccccc02', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbb01', '2026-11', 65.50, 134.50, 200.00, NULL, 'ABIERTO', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111103', NULL, '2026-11-01 08:30:00', NULL)
ON CONFLICT ("petty_cash_id", "year_month") DO NOTHING;

-- Vale histórico de octubre que justifica el saldo consumido (134.50) y el cierre en 65.50, más vale solicitado de noviembre
INSERT INTO "petty_cash_vouchers" ("id", "code", "period_id", "requested_by_id", "approved_by_id", "disbursed_by_id", "beneficiary_name", "concept", "requested_amount", "disbursed_amount", "settled_amount", "returned_amount", "invoice_reference", "attachment_url", "status")
VALUES
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd01', 'VALE-FIS-2026-10', 'cccccccc-cccc-4ccc-8ccc-cccccccccc01', '11111111-1111-4111-8111-111111111102', '11111111-1111-4111-8111-111111111103', '11111111-1111-4111-8111-111111111103', 'TSU. Luis Herrera', 'Compra de insumos ópticos y guantes de nitrilo', 134.50, 134.50, 134.50, 0.00, 'FACT-FIS-2026-1042', '/uploads/factura-fis-2026-1042.pdf', 'RENDIDO'),
  ('dddddddd-dddd-4ddd-8ddd-dddddddddd02', 'VALE-FIS-2026-11A', 'cccccccc-cccc-4ccc-8ccc-cccccccccc02', '11111111-1111-4111-8111-111111111102', NULL, NULL, 'TSU. Luis Herrera', 'Adquisición de lentes colimadores de repuesto', 45.00, NULL, NULL, NULL, NULL, NULL, 'SOLICITADO')
ON CONFLICT ("code") DO NOTHING;

-- 9. Parámetros globales del sistema (RF 2.1: gestión exclusiva del ADMIN)
INSERT INTO "system_parameters" ("id", "key", "value", "description", "updated_by_id")
VALUES
  ('ffffffff-ffff-4fff-8fff-ffffffffff01', 'SYSTEM_CURRENCY', 'USD', 'Moneda única del sistema, sin deducciones ni conversiones (RN-GLOB-01)', '11111111-1111-4111-8111-111111111101'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff02', 'PAYMENT_REQUEST_SCOPE', 'REQUEST_ITEMS', 'Alcance del pago FIFO: solo causaciones incluidas en la solicitud aprobada', '11111111-1111-4111-8111-111111111101'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff03', 'MAX_UPLOAD_SIZE_MB', '5', 'Tamaño máximo permitido para comprobantes adjuntos en MB', '11111111-1111-4111-8111-111111111101'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff04', 'PETTY_CASH_REQUIRE_ATTACHMENT', 'true', 'Exigir archivo de comprobante al rendir un vale de caja chica', '11111111-1111-4111-8111-111111111101'),
  ('ffffffff-ffff-4fff-8fff-ffffffffff05', 'AUDIT_RETENTION_DAYS', '365', 'Días de retención de la bitácora de auditoría', '11111111-1111-4111-8111-111111111101')
ON CONFLICT ("key") DO NOTHING;

-- 10. Registros iniciales de auditoría de negocio (RN-AUD-03)
INSERT INTO "audit_logs" ("id", "user_id", "user_role", "action", "table_name", "record_id", "old_values", "new_values")
VALUES
  ('01010101-0101-4101-8101-010101010101', '11111111-1111-4111-8111-111111111102', 'GENERADOR', 'GENERATE_ACCRUAL_BATCH', 'accrual_batches', '66666666-6666-4666-8666-666666666603', NULL, '{"code":"LOTE-QUI-2026-Q1","totalAmount":"150.00","activeDays":5,"totalPeriodDays":15}'),
  ('01010101-0101-4101-8101-010101010102', '11111111-1111-4111-8111-111111111103', 'RECEPTOR', 'REGISTER_FIFO_PAYMENT', 'payments', '99999999-9999-4999-8999-999999999901', '{"totalDebtBeforePayment":"900.00"}', '{"receiptCode":"REC-2026-001","paymentAmount":"600.00","remainingDebtAfterPayment":"300.00"}'),
  ('01010101-0101-4101-8101-010101010103', '11111111-1111-4111-8111-111111111102', 'GENERADOR', 'SETTLE_PETTY_CASH_VOUCHER', 'petty_cash_vouchers', 'dddddddd-dddd-4ddd-8ddd-dddddddddd01', '{"status":"DESEMBOLSADO"}', '{"status":"RENDIDO","settledAmount":"134.50","invoiceReference":"FACT-FIS-2026-1042"}')
ON CONFLICT ("id") DO NOTHING;
