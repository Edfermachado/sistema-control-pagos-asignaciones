# Vista 4 — `frontend/src/components/PettyCashAndReportsPanel.tsx`

Aplica `spec-comun.md` a este archivo. Cajas chicas por proyecto, períodos mensuales, vales y
reportes PDF.

## Orden y agrupación requeridos

1. **Apertura de caja y período** (`RN-CAJA-01`, `RN-CAJA-02`): formulario de creación de caja
   (código, nombre, proyecto, monto autorizado) y formulario de solicitud de apertura mensual
   (caja, mes `YYYY-MM`, reposición/arrastre). Ambos en `.form-grid`, con el botón al final.
2. **Emisión de vale** (`RN-CAJA-03`): formulario con período, beneficiario, concepto, monto
   estimado y (si existe) adjunto de comprobante.
3. **Cajas y sus movimientos**: **un `.sheet` por caja** (`key={box.id}`), con el saldo disponible
   como cifra dominante usando `.figure` (`.figure__label`, `.figure__value num`, `.figure__note`)
   y, debajo, dos tablas: períodos (mes, arrastre, saldo inicial, disponible, estado, acciones de
   aprobar/cerrar) y vales (código, beneficiario, concepto, solicitado, desembolsado, rendido,
   estado, acciones de aprobar/rechazar/desembolsar/rendir/anular y enlace al comprobante).
   El título del folio es el `code — name` de la caja y el proyecto va en `.sheet__hint`.
4. **Reportes** (si el archivo los expone): acciones de descarga de PDF en un folio propio con
   `.btn-group`, sin tablas vacías decorativas.

## Notas específicas

- Conserva exactamente las condiciones por rol (quién ve aprobar, quién ve desembolsar, quién rinde).
- Los campos de archivo (`type="file"`) llevan `<label className="field__label">` visible y el
  `.input` correspondiente; no los escondas.
- Los estados se muestran como badge con el texto del dominio: `SOLICITADO`, `APROBADO`, `RECHAZADO`,
  `DESEMBOLSADO`, `RENDIDO`, `ANULADO`, `ABIERTO`, `CERRADO`, `ACTIVA`.
- Si hay un indicador de porcentaje de ejecución del período, exprésalo con texto y, si usas una
  barra, hazlo con `<progress>` nativo (sin estilos inline); nada de gráficos inventados.
- No cambies ninguna llamada a `apiRequest`, ni el manejo de comprobantes, ni los mensajes.
