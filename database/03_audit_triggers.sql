-- ============================================================================
-- AUDITORÍA A NIVEL DE BASE DE DATOS (ENTREGABLE #3 / RN-AUD-03)
-- Universidad de Carabobo - Escuela de Computación - Sistemas de Información
--
-- Este script crea triggers que registran INSERT/UPDATE/DELETE reales sobre las
-- tablas del dominio en audit_logs. El backend mantiene además su registro de
-- negocio con user_id y user_role para saber quién ejecutó cada operación.
-- ============================================================================

-- 1. Función genérica de auditoría de cambios de fila
CREATE OR REPLACE FUNCTION fn_audit_row_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    v_record_id TEXT;
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_record_id := OLD.id::text;
        v_old_values := to_jsonb(OLD);
        v_new_values := NULL;
    ELSIF TG_OP = 'UPDATE' THEN
        v_record_id := NEW.id::text;
        v_old_values := to_jsonb(OLD);
        v_new_values := to_jsonb(NEW);
    ELSE
        v_record_id := NEW.id::text;
        v_old_values := NULL;
        v_new_values := to_jsonb(NEW);
    END IF;

    INSERT INTO "audit_logs" (
        "action",
        "table_name",
        "record_id",
        "old_values",
        "new_values"
    )
    VALUES (
        TG_OP,
        TG_TABLE_NAME,
        v_record_id,
        v_old_values,
        v_new_values
    );

    RETURN COALESCE(NEW, OLD);
END;
$$;

-- 2. Triggers sobre tablas de catálogo, operación y dinero
DO $$
DECLARE
    table_name TEXT;
    audited_tables TEXT[] := ARRAY[
        'beneficiaries',
        'projects',
        'payment_groups',
        'payment_group_periods',
        'assignments',
        'accrual_batches',
        'accruals',
        'payment_requests',
        'payment_request_items',
        'payments',
        'payment_allocations',
        'annulments',
        'petty_cashes',
        'petty_cash_periods',
        'petty_cash_vouchers',
        'system_parameters'
    ];
BEGIN
    FOREACH table_name IN ARRAY audited_tables LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I',
            'trg_audit_' || table_name,
            table_name
        );
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_audit_row_change()',
            'trg_audit_' || table_name,
            table_name
        );
    END LOOP;
END;
$$;

-- 3. audit_logs es estrictamente Append-Only: prohibir UPDATE y DELETE
CREATE OR REPLACE FUNCTION fn_block_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'RN-AUD-03: audit_logs es una bitácora append-only; no se permite UPDATE ni DELETE.';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_logs_immutable ON "audit_logs";
CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON "audit_logs"
FOR EACH ROW
EXECUTE FUNCTION fn_block_audit_mutation();

-- 4. Inmutabilidad Contable en BD (RN-GLOB-03): prohibir DELETE físico en tablas financieras
CREATE OR REPLACE FUNCTION fn_block_financial_deletion()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'RN-GLOB-03: Prohibido eliminar físicamente registros financieros en %. Utilice Anulación Justificada.', TG_TABLE_NAME;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
    immutable_tables TEXT[] := ARRAY[
        'accrual_batches',
        'accruals',
        'payment_requests',
        'payment_request_items',
        'payments',
        'payment_allocations',
        'annulments',
        'petty_cashes',
        'petty_cash_periods',
        'petty_cash_vouchers'
    ];
BEGIN
    FOREACH tbl IN ARRAY immutable_tables LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I ON %I',
            'trg_immutable_delete_' || tbl,
            tbl
        );
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE DELETE ON %I FOR EACH ROW EXECUTE FUNCTION fn_block_financial_deletion()',
            'trg_immutable_delete_' || tbl,
            tbl
        );
    END LOOP;
END;
$$;
