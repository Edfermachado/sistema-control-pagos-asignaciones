# QA de la interfaz — Vistas, checklist y resultados

**Proyecto:** Sistema de Control de Pagos y Asignaciones (USD) — FACYT, Universidad de Carabobo.
**Fecha de ejecución:** noviembre de 2026 · **Entorno:** Docker Compose (`scpa_frontend` en `:5173`,
`scpa_backend` en `:3000`, `scpa_postgres` en `:55432`) + build de producción de Vite.
**Ejecutado por:** agente de QA automatizado (navegador Chromium vía CDP) con datos reales de la API.
**Resultado global:** los flujos del enunciado funcionan de punta a punta; **2 defectos corregidos**
antes de la entrega y **4 hallazgos menores documentados** para decisión del equipo.

---

## Parte A — Inventario de vistas y checklist de pruebas

La aplicación tiene **cinco espacios de trabajo** y **tres roles** con visibilidad distinta. Cada
espacio se compone de secciones (folios) que se listan abajo con lo que hay que probar en cada una.

### Vista 1 — Resumen y deudas (`RESUMEN`)

| Sección | Qué probar |
|---|---|
| Libro mayor (causado / pagado / deuda) | Que las tres cifras coincidan con el total real; que la deuda se pinte en rojo solo si es > 0; que los montos tengan formato `$1.234,56` inválido → revisar separadores y decimales. |
| Cobertura (proyectos / beneficiarios / causaciones) | Que los conteos cambien al crear o desactivar catálogos. |
| Estado de cuenta por beneficiario | Filtro por proyecto; orden y alineación de montos; fila vacía con mensaje cuando no hay causaciones; que el saldo adeudado cuadre con causado − pagado. |

### Vista 2 — Catálogos, beneficiarios y asignaciones (`CATALOGOS`)

| Sección | Qué probar |
|---|---|
| Proyectos | Crear (código único, área, ámbito, vigencia); editar; activar/desactivar; rechazo de fecha fin < inicio (`RN-CAT-01`) y de código duplicado. |
| Grupos de pago y fechas de corte | Crear grupo (genera períodos automáticos); listar cortes; agregar corte personalizado; eliminar corte; rechazo por solapamiento (`RN-CAT-03`). |
| Beneficiarios | Crear (cédula única); editar; activar/desactivar; que **no** exista contraseña ni usuario (`RN-SEG-01`). |
| Asignaciones | Crear beneficiario + proyecto + grupo + monto + vigencia; bloqueo de solapamiento en el mismo proyecto (`RN-CAT-04`); bloqueo en proyecto inactivo (`RN-CAT-02`); desactivar. |

### Vista 3 — Causación, solicitudes y pagos (`MOTOR_FINANCIERO`)

| Sección | Qué probar |
|---|---|
| Lote de causación | Previsualización con días activos / días totales y monto; ejecución del lote; bloqueo de doble causación; validación del corte contra el grupo. |
| Lotes emitidos | Listado, estado, anulación de lote con motivo (`RN-GLOB-04`). |
| Solicitudes | Crear seleccionando causaciones pendientes (total en vivo); enviar; aprobar/rechazar; reintento de una causación ya incluida en otra solicitud activa. |
| Pagos FIFO | Pago parcial, pago total, sobrepago rechazado, cierre solo al 100 %, PDF del recibo, anulación con reversión (`RN-PAG-03`); que el rol sin permiso no vea los botones. |

### Vista 4 — Cajas chicas (`CAJA_CHICA`)

| Sección | Qué probar |
|---|---|
| Crear caja | Código único, proyecto, tope autorizado. |
| Apertura mensual | Mes `YYYY-MM`, arrastre del mes anterior, reposición; aprobación por Gerencia. |
| Vales | Solicitar, aprobar (no mueve saldo), desembolsar (descuenta), rechazar con motivo. |
| Rendición | Comprobante obligatorio (parámetro `PETTY_CASH_REQUIRE_ATTACHMENT=true`), monto real, vuelto al disponible. |
| Cierre | Bloqueo con vales pendientes (`RN-CAJA-04`); saldo final congelado; cierre definitivo de la caja. |

### Vista 5 — Usuarios, parámetros y auditoría (`AUDITORIA`)

| Sección | Qué probar |
|---|---|
| Usuarios | Crear con rol; listar sin `password_hash`; activar/desactivar; que el ADMIN no pueda desactivarse a sí mismo. |
| Parámetros | Crear, editar en línea, eliminar; visibilidad solo para el ADMIN. |
| Bitácora `audit_log` | Orden cronológico, columnas (fecha, usuario, rol, acción, tabla, registro), desplegable con `old_values` / `new_values`, ausencia de edición. |

### Transversales (probar siempre)

1. **Login automático por rol** (selector del riel) y **login manual** con credenciales correctas e incorrectas.
2. **RBAC:** el ADMIN no ve Causación ni Cajas Chicas; el RECEPTOR no ve usuarios ni parámetros; el GENERADOR no aprueba ni paga.
3. **Consola:** cero errores de JavaScript durante todo el recorrido.
4. **Layout:** 1440×900 y 390×844 sin desbordes horizontales ni texto recortado; tablas con desplazamiento interno.
5. **Contraste:** todo el texto ≥ AA (4,5:1 normal, 3:1 grande).
6. **Persistencia:** recargar la página tras cada operación y comprobar que el dato sigue ahí.

### Rutas (una vista por URL)

| Comprobación | Cómo |
|---|---|
| Entrada directa | Abrir `/causacion` con sesión: debe cargar la vista, no el resumen. |
| Recarga | `F5` sobre cualquier ruta: la sesión y la vista se mantienen. |
| Ruta prohibida | Con rol GENERADOR abrir `/auditoria`: redirige a `/resumen` con aviso `RN-SEG-02`. |
| Ruta inexistente | Abrir `/ruta-inventada`: pantalla propia con salidas a resumen y acceso. |
| Historial | Atrás y adelante del navegador devuelven a las vistas visitadas. |
| Sin sesión | Abrir una ruta protegida sin sesión lleva al portal; tras el login vuelve a esa ruta. |
| Cierre de sesión | El botón "Cerrar sesión" limpia el almacenamiento y deja el portal; recargar no reabre la sesión. |
| Enlaces del riel | Cada ítem es un enlace real: se puede abrir en otra pestaña y marca `aria-current` en la vista activa. |

---

## Parte B — Resultados de la ejecución (datos reales)

### Flujos verificados de punta a punta

| # | Flujo | Resultado |
|---|---|---|
| 1 | Login automático y manual (3 roles), credenciales inválidas | OK — "Credenciales de acceso inválidas." |
| 2 | Alta, edición y cambio de estado de proyecto | OK — avisos y refresco de tabla |
| 3 | Validaciones de proyecto (`RN-CAT-01`, código duplicado) | OK — mensajes con código de norma |
| 4 | Alta de beneficiario y disponibilidad inmediata en los selects | OK |
| 5 | Alta de asignación y bloqueo de solapamiento (`RN-CAT-04`) | OK — rechazo con mensaje |
| 6 | Bloqueo de asignación en proyecto inactivo (`RN-CAT-02`) | OK |
| 7 | Alta de grupo de pago con generación automática de cortes | OK — 118 períodos generados |
| 8 | Alta y baja de corte personalizado (rango libre) | OK — 48 → 49 → 48 |
| 9 | Previsualización de prorrateo (15/15 días → $250,00) | OK |
| 10 | Ejecución de lote y aparición de la causación PENDIENTE | OK |
| 11 | Crear solicitud con selección de causaciones (total en vivo $250) | OK |
| 12 | Enviar → aprobar → pagar parcial $100 (FIFO) → estado PARCIAL | OK — causación $100/$150 |
| 13 | Descarga del PDF del recibo | OK — PDF 1.4 con desglose FIFO y firmas |
| 14 | Anulación del pago con reversión FIFO | OK — deuda devuelta, solicitud reabierta |
| 15 | Pago total, sobrepago rechazado (`RN-PAG-02`), cierre de solicitud | OK |
| 16 | Caja chica: crear → apertura → aprobar → vale → aprobar → desembolsar | OK — saldo 500 → 380 |
| 17 | Cierre de mes bloqueado con vale sin rendir (`RN-CAJA-04`) | OK |
| 18 | Rendición con comprobante subido (multipart) y vuelto de $10 | OK — saldo 390 |
| 19 | Cierre de mes con saldo congelado y cierre definitivo de caja | OK — badge CERRADA |
| 20 | Usuarios: crear, desactivar; parámetros: crear, editar, eliminar | OK |
| 21 | Bitácora con detalle JSONB de `old_values` | OK |
| 22 | RBAC al cambiar de rol (visibilidad de pestañas y contenido) | OK tras corrección (F3, F4) |

### Rutas, sesión y RBAC por URL (implementado en noviembre de 2026)

| # | Comprobación | Resultado |
|---|---|---|
| 1 | `/` sin sesión → portal de acceso | OK — `/login` |
| 2 | Login demo (3 roles) y login manual | OK — redirige al resumen con la sesión del rol |
| 3 | Login con credenciales inválidas | OK — se queda en el portal con el aviso |
| 4 | Entrada directa a `/causacion` con sesión | OK — carga la vista, 4 folios |
| 5 | Recarga sobre `/causacion` | OK — sesión y vista se conservan (`sessionStorage`) |
| 6 | GENERADOR abre `/auditoria` | OK — redirige a `/resumen` y explica `RN-SEG-02` |
| 7 | Cambio de rol en el riel | OK — sesión, riel y permisos se recalculan |
| 8 | ADMIN abre `/causacion` por URL | OK — redirige con aviso |
| 9 | Ruta inexistente | OK — pantalla propia con dos salidas |
| 10 | Atrás / adelante del navegador | OK |
| 11 | Logout | OK — `/login`, almacenamiento limpio, recarga no reabre sesión |
| 12 | Deep link sin sesión → login → destino | OK — vuelve a `/cajas-chicas` tras autenticarse |

### Segundo recorrido: acciones destructivas y justificaciones (RN-PAG-01/03, RN-GLOB-04, RN-CAJA-03)

| # | Acción probada en la interfaz | Resultado |
|---|---|---|
| 1 | Rechazar una solicitud con el campo de motivo vacío | OK — el botón está inhabilitado y muestra el motivo en el tooltip |
| 2 | Rechazar la solicitud escribiendo el motivo | OK — queda `RECHAZADA` con el texto escrito por el usuario |
| 3 | Aprobar, pagar 50,00 y anular el pago con motivo | OK — `ANULADO`; la causación vuelve a 200,00 `PENDIENTE` y la solicitud a `APROBADA` |
| 4 | Anular la solicitud aprobada con motivo | OK — `ANULADA` |
| 5 | Anular un lote de causación con motivo | OK — lote `ANULADO` y causaciones liberadas |
| 6 | Rechazar un vale de caja chica sin motivo / con motivo | OK — inhabilitado / `RECHAZADO` con el texto escrito; el saldo del período no se mueve |
| 7 | Anular un vale antes del desembolso | OK — `ANULADO`, saldo intacto (200,00 disponibles) |
| 8 | Editar un proyecto (nombre) y guardar | OK — `projects.name` actualizado en PostgreSQL |
| 9 | Desactivar y reactivar un beneficiario | OK — `is_active` pasa a `false` y vuelve a `true` |
| 10 | El motivo escrito se limpia tras ejecutar la acción | OK — no queda una justificación reutilizable de la operación anterior |
| 11 | Anular una causación individual (no el lote) | OK — guard activo; causación `ANULADO` con saldo 0,00 |
| 12 | Enlace "Ver comprobante" de un vale rendido | OK — `200 application/pdf` con el archivo servido |
| 13 | Integridad del archivo subido | OK — PDF de 1.927 bytes guardado y servido con el mismo `sha256` que el original |
| 14 | Búsqueda dentro de las tablas de catálogos | OK — el buscador por código aísla el proyecto y habilita sus acciones |

### Reflejo en la base de datos (verificado con `psql` dentro del contenedor)

| Operación en la interfaz | Fila comprobada en PostgreSQL |
|---|---|
| Crear proyecto `QA2-PROY-01` | `projects` con estado `ACTIVO` |
| Crear beneficiario `V-QA2-111` | `beneficiaries` activo, sin credenciales |
| Crear asignación $200 | `assignments.amount_per_period = 200.00` activa |
| Generar lote `QA2-LOTE-01` | `accrual_batches` 2026-03-01/15, `total_amount 200.00`, `GENERADO` |
| Causación prorrateada | `accruals` 200.00 causado, 15/15 días, `PENDIENTE` |
| Solicitud `QA2-SOL-01` | `payment_requests` total 200.00, 1 ítem de 200.00 |
| Pago parcial $80 | `payments` `QA2-REC-01` 80.00 `VALIDO`; `payment_allocations` 80.00; causación `PARCIAL`, saldo 120.00 |
| Pago del saldo $120 | `QA2-REC-02` 120.00; causación `PAGADO`, saldo 0.00 |
| Cierre | `payment_requests.status = CERRADA`, pagado 200.00 |
| Caja `QA2-CAJA-01` | `petty_cashes.CERRADA`; período 2027-01 disponible 210.00, cierre 210.00, `CERRADO` |
| Vale `QA2-VAL-01` | 100 solicitado, 100 desembolsado, 90 rendido, 10 devuelto, `RENDIDO`, comprobante adjunto |
| Usuario y parámetro | `users` con rol RECEPTOR activo; `system_parameters` `QA2_PARAM=activo` |
| Auditoría | `audit_logs` con eventos de negocio (`USER_LOGIN`, `UPDATE`…) y de trigger (`INSERT` en `payment_group_periods`) |

### Mediciones

| Comprobación | Resultado |
|---|---|
| Errores de consola en todo el recorrido | 0 |
| Estilos inline renderizados | 0 |
| Desbordes horizontales (desktop y móvil) | 0 |
| Texto recortado | 0 |
| Fallos de contraste AA (5 vistas × 2 tamaños) | 0 |
| `impeccable detect` (archivos y URL) | 0 hallazgos |
| Rutas: deep link, recarga, guard por rol, 404 e historial | 12/12 comprobaciones OK |
| Frontend Vitest tras el enrutado | 8 suites / **58** pruebas en verde |

---

## Parte C — Hallazgos

### Corregidos en esta sesión

**F3 — El ADMIN conservaba el espacio de Cajas Chicas al cambiar de rol** (Alto, RBAC).
Al pasar de GENERADOR/RECEPTOR a ADMIN estando en la vista 4, la pestaña desaparecía del riel pero el
contenido de cajas chicas seguía visible con datos de la sesión anterior.
*Corrección:* `handleRoleSwitch` valida el espacio activo contra los permitidos por el rol y regresa a
Resumen. Verificado: ADMIN cae en Resumen y sus pestañas son 1, 2 y 5.

**F4 — El ADMIN veía la sección Asignaciones** (Medio, RBAC/UX).
Mostraba solo un estado vacío e invitaba a "vincular un beneficiario" aunque `RN-SEG-02` se lo prohíbe.
*Corrección:* la sección se renderiza solo si el rol no es ADMIN. Verificado: catálogos del ADMIN
quedan en 3 folios (proyectos, grupos, beneficiarios).

**F1 — Motivo de anulación y de rechazo precargado** (Medio, integridad; pre-existente). Corregido.
El campo nacía con un texto genérico ("Corrección contable autorizada por Gerencia…"), así que un solo
clic anulaba o rechazaba sin que nadie escribiera la justificación y la auditoría registraba una
plantilla, debilitando `RN-GLOB-04` y `RN-PAG-01`.
*Corrección:* los motivos arrancan vacíos y los botones destructivos (anular pago, causación, lote,
solicitud y vale; rechazar solicitud y vale) quedan inhabilitados hasta que el texto alcanza el mínimo
que exige la regla (10 caracteres para anular, 5 para rechazar), con el motivo en el tooltip.
Verificado: inhabilitado con el campo vacío, habilitado al escribir, y el texto que llega a la auditoría
es el escrito por el usuario.

**F9 — El motivo sobrevivía a la operación anterior** (Bajo, integridad; detectado en esta ronda).
Al compartirse un único campo de motivo, tras anular un pago quedaba su texto cargado y una segunda
anulación lo reutilizaba, pudiendo justificar otra operación con un motivo ajeno.
*Corrección:* el campo se limpia tras ejecutar con éxito la acción. Verificado en solicitud, pago, lote
y vale de caja chica.

### Documentados, pendientes de decisión del equipo

**F2 — Anulación de pago sin confirmación** (Medio, UX; pre-existente). Atenuado.
"Anular con reversión FIFO" sigue ejecutando en el primer clic, pero ya exige un motivo escrito por
quien decide (F1), lo que elimina el clic accidental. *Recomendación pendiente:* paso de confirmación
que muestre monto y recibo afectados.

**F5 — Validación de formulario ausente en el pago** (Bajo; pre-existente).
Si se envía el pago sin beneficiario, el aviso que aparece es `[RN-PAG-02] El beneficiario no posee
causaciones con saldo pendiente`, que describe el síntoma y no la causa.
*Recomendación:* `required` en los selects y mensaje propio antes de llamar a la API.

**F6 — Campos de anulación y rendición separados de sus botones** (Bajo, UX).
El motivo de anulación, el monto rendido y el archivo del comprobante viven en la sección
"Rendición", mientras los botones que los usan están en la tabla de vales o de pagos.
*Recomendación:* llevar esos campos junto a la acción o abrir una fila expandida por registro.

**F7 — `RN-CAT-03` impide cortes dentro de rangos ya generados** (Informativo).
Un corte personalizado solo se puede agregar fuera de 2026–2027 porque ya existen períodos
generados; el rechazo es correcto pero no se explica en la interfaz.
*Recomendación:* nota en el folio o acción explícita de "reemplazar corte".

**F8 — Tras crear un grupo, la tabla de cortes sigue mostrando otro grupo** (Bajo, UX).
Los períodos se generan bien (118 en el caso probado), pero el grupo nuevo no queda seleccionado.
*Recomendación:* seleccionarlo al crearlo.

---

## Parte D — Cómo repetir estas pruebas

```bash
# 1. Levantar el sistema con datos de demostración
cp .env.example .env
docker compose up -d --build          # web :5173 · API :3000 · PostgreSQL :55432

# 2. Pruebas automáticas
node scripts/api-smoke-test.mjs                       # 68 comprobaciones de API
npm --prefix backend test -- --runInBand              # 225 unitarias
npm --prefix frontend test                            # 27 unitarias

# 3. Detector de anti-patrones de interfaz
export IMPECCABLE_HOME="E:/Vigilia/SisInf/proyecto/repo/.opencode/.cache/impeccable"
sh .opencode/skills/impeccable/scripts/impeccable detect http://localhost:5173 --json
```

Para el recorrido manual, usar la tabla de la Parte A como guía y comprobar en cada paso: aviso en
pantalla, cambio en la tabla, ausencia de errores de consola y persistencia tras recargar.

Las capturas de esta ejecución están en `.opencode/.cache/qa/` (móvil) y `.opencode/.cache/shots/`
(escritorio y móvil), fuera del control de versiones.

---

## Parte E — Qué no cubre esta ronda

- **Accesibilidad profunda:** navegación completa por teclado y lectores de pantalla (solo se midió
  contraste AA y se revisaron `label`/`aria-current`).
- **Carga y concurrencia:** dos usuarios operando la misma solicitud al mismo tiempo.
- **Navegadores distintos de Chromium** (Firefox, Safari/iOS).
- **Impresión** de los PDFs y su legibilidad en papel.
- **Móvil:** se comprobó la maquetación a 390×844 en las cinco rutas (sin desbordes), pero los flujos
  se recorrieron con ratón a 1440×900, no con toques reales.
- **Cambio de contraseña y alta de usuario con credenciales propias:** se creó el usuario, no se probó
  su primer inicio de sesión.
- **Datos voluminosos:** las tablas se probaron con decenas de filas (paginación de 8–10 por página),
  no con miles.
