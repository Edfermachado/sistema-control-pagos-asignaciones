# Vista 5 — `frontend/src/components/UsersAndAuditWorkspace.tsx`

Aplica `spec-comun.md` a este archivo. Usuarios, parámetros globales y bitácora de auditoría.

## Orden y agrupación requeridos

1. **Usuarios** (exclusivo ADMIN — `RN-SEG-02`): formulario de alta en `.form-grid` (correo, nombre,
   rol, contraseña) + tabla con correo, nombre, rol, estado (badge `ACTIVO`/`INACTIVO`) y la acción
   de activar/desactivar. El rol se muestra como texto (`ADMIN`, `GENERADOR`, `RECEPTOR`).
2. **Parámetros globales** (exclusivo ADMIN — RF 2.1): CRUD clave-valor. Tabla con clave, valor,
   descripción editable y acciones; el formulario de alta en `.form-row` arriba de la tabla.
3. **Bitácora `audit_log`** (`RN-AUD-03`): tabla de solo lectura con fecha, usuario, rol, acción,
   tabla, registro. Los bloques JSON de `old_values` / `new_values` no se imprimen como texto plano
   gigante: muéstralos en un `<details>` por fila o en una celda con `<code>` de tamaño pequeño y
   `overflow-wrap: anywhere` mediante la clase existente más cercana; si necesitas saltos de línea,
   usa `white-space: pre-wrap` a través de `<pre>` sin estilos inline.
4. Si el RECEPTOR ve este panel sin permisos de usuarios/parámetros, conserva exactamente esa
   condición y deja solo la bitácora.

## Notas específicas

- **No** expongas `password_hash` ni ningún campo que hoy no se muestra.
- No cambies las condiciones de rol ni los endpoints (`/users`, `/parameters`, `/audit-logs`).
- La bitácora puede ser larga: no añadas paginación nueva (no existe en la lógica actual); solo
  mantén el desplazamiento vertical razonable mediante `.table-scroll`.
- Los avisos internos de este panel pasan a `.notice--ok` / `.notice--error` sin emojis.
