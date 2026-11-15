# Vista 3 — `frontend/src/components/FinancialEnginePanel.tsx`

Aplica `spec-comun.md` a este archivo. Es el motor financiero: causación, solicitudes, pagos FIFO y
anulaciones. Es el archivo más importante del sistema; el orden de los folios debe seguir el flujo
real del negocio.

## Orden y agrupación requeridos

1. **Lote de causación y prorrateo** (`RN-CAUS-01` a `RN-CAUS-04`): formulario en `.form-grid`
   (proyecto, grupo de pago, fecha de corte/período) + botones "Previsualizar" (`.btn .btn--ghost`) y
   "Generar lote" (`.btn`). La previsualización, si existe como tabla o lista, va en
   `.table-scroll > .table` con columnas: beneficiario, días activos / días totales, monto prorrateado.
2. **Lotes emitidos** (`RN-CAUS-04` / `RN-GLOB-04`): tabla con código, proyecto, período, días,
   monto total, estado (badge) y acción de anulación (`.btn--sm .btn--danger`).
3. **Ciclo de solicitudes** (`RN-PAG-01`): formulario de creación (proyecto + selección de
   causaciones pendientes con checkbox en la tabla) y, debajo, tabla de solicitudes con código,
   proyecto, total, pagado, saldo, estado (badge) y las acciones de enviar / aprobar / rechazar /
   cerrar / anular según el rol. Los botones que hoy existen deben seguir existiendo con las mismas
   condiciones de visibilidad y las mismas llamadas.
4. **Entrega de fondos FIFO** (`RN-PAG-02`, `RN-PAG-03`): formulario (solicitud, beneficiario, monto,
   fecha, referencia) + tabla de pagos con código de recibo, beneficiario, monto, fecha, estado y
   acciones de descargar PDF y anular.

## Notas específicas

- Las cifras de dinero van siempre con `formatUsdCurrency` y `className="num"`; el saldo pendiente
  puede llevar `.table__strong`.
- Si hay un bloque de "saldo pendiente de la solicitud" o similar, represéntalo con `.figure`
  (`.figure__label`, `.figure__value num`, `.figure__note`) dentro del folio correspondiente.
- Los mensajes de validación y las llamadas `apiRequest` no cambian en absoluto.
- El RECEPTOR no puede anular causaciones y el ADMIN no ve nada de este panel: conserva esas
  condiciones tal cual, incluidas las que ocultan botones.
- No reordenes ni renombres estados: `CREADA`, `ENVIADA`, `APROBADA`, `RECHAZADA`, `ENTREGADA`,
  `CERRADA`, `ANULADA`; badges con esos textos.
