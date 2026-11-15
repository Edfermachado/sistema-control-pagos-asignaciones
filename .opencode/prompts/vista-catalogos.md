# Vista 2 — `frontend/src/components/CatalogsAndAssignmentsWorkspace.tsx`

Aplica `spec-comun.md` a este archivo. Es el espacio de trabajo de catálogos y asignaciones.

## Orden y agrupación requeridos

1. **Proyectos** (`RN-CAT-01`, `RN-CAT-02`): formulario de alta/edición en `.form-grid` y tabla con
   código, nombre, área (usa `<span className="area area--fisica|quimica|biologia">` con el nombre
   del área, sin mayúsculas forzadas), ámbito, vigencia y estado (badge). La acción de cambio de
   estado es un botón `.btn--sm .btn--ghost` dentro de la fila.
2. **Grupos de pago y fechas de corte** (`RN-CAT-03`): un `.sheet` para el grupo y, dentro del
   cuerpo, un `.subsheet` por grupo seleccionado con sus períodos en tabla (inicio, fin, etiqueta,
   acción eliminar). El formulario para agregar un corte va en `.form-row` dentro de ese `.subsheet`.
3. **Beneficiarios** (`RN-SEG-01`): formulario + tabla con cédula, nombre, correo, datos bancarios y
   estado. Recuerda en `.sheet__hint` que no tienen usuario en el sistema.
4. **Asignaciones** (`RN-CAT-04`): formulario (beneficiario, proyecto, grupo, monto por período,
   vigencia) + tabla con las asignaciones y su acción de desactivación.

## Notas específicas

- Los permisos por rol deben quedar exactamente como están (qué formulario/botón se muestra a
  ADMIN, GENERADOR o RECEPTOR). No añadas ni quites condiciones.
- `formatUsdCurrency` se usa tal cual para los montos; la celda lleva `className="num"`.
- Las fechas se muestran tal como hoy (`periodStart`, `endDate`…). No reformatees valores.
- Si actualmente un formulario está dentro de una tarjeta con título numerado ("1. …", "2. …"),
  quita la numeración: la secuencia real del enunciado son los cinco espacios, no los formularios.
