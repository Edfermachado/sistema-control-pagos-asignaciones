# DESIGN.md — Identidad visual del Sistema de Control de Pagos y Asignaciones (USD)

**Universidad de Carabobo · FACYT · Escuela de Computación · Sistemas de Información**
Documento normativo de diseño. Cualquier cambio de interfaz debe respetarlo.

---

## 1. Punto de partida y problema

La interfaz anterior usaba el kit por defecto de la IA generativa: barra azul oscura, tarjetas
blancas idénticas con borde gris, tipografía del sistema, emojis como iconografía (📊 🗂️ ⚙️ 💵 🛡️),
 badges verde/rojo con texto en mayúsculas y una franja de borde de color a la izquierda de cada
tarjeta. El resultado era genérico y no comunicaba el dominio real del sistema: **un libro mayor
de asignaciones científicas en dólares**.

Este documento define el reemplazo.

---

## 2. Concepto: instrumento de laboratorio + libro mayor

El sistema lo usan tres roles con responsabilidades separadas (RN-SEG-02) sobre dinero de
proyectos de Física, Química y Biología. No es una app de marketing: es **modo Operate** — la
persona viene a completar una tarea, no a admirar una animación. La ambición se demuestra como
**precisión**, no como decoración.

La identidad se apoya en dos referencias concretas y verificables:

1. **El libro mayor contable**: cifras alineadas a la derecha con numeración tabular, renglones
   reglados, totales que cierran, encabezados que funcionan como títulos de columna de un folio.
2. **El cuaderno de laboratorio**: jerarquía documental — folios, encabezados que funcionan como
   título de columna de un folio, referencias a normas (`RN-CAUS-02`) tratadas como anotaciones al
   margen, y densidad propia de una hoja de registro.

Nada de esto se usa como ornamento: las reglas separan registros, los números se alinean para poder
compararse de un vistazo. **No se usa fondo cuadriculado**: el detector determinista de anti-patrones
marca las cuadrículas de líneas de dos ejes como firma de interfaz generada, así que el fondo es un
plano frío continuo (`--paper`) y la estructura la aportan los folios y las reglas de tabla.

---

## 3. Prohibiciones explícitas (anti-slop)

Queda prohibido, y cualquier aporte que lo introduzca se rechaza:

| Prohibido | Por qué |
|---|---|
| Degradados morados/azules, glassmorphism, "glow" | Firma de plantilla generada |
| Fondo crema cálido (#F4F1EA) + serif de alto contraste + acento terracota (#D97757) | Es el look por defecto de la IA en 2026 |
| Fondo casi negro con un único acento ácido | Modo oscuro de plantilla; además el equipo pidió interfaz clara |
| Cuadrícula de tarjetas idénticas con el mismo radio y la misma sombra suave | El "SaaS card kit" |
| Bordes de color gruesos a un solo lado de una tarjeta (`border-left: 4px solid`) | Tell detectado por el detector determinista |
| Emojis como iconografía de navegación, botones o estados | Ruido, no información |
| Etiquetas en MAYÚSCULAS con tracking como "eyebrow" sobre cada título | Chrome de plantilla |
| Cadenas meta unidas con puntos medios ("A · B · C") o guion largo decorativo | Chrome de plantilla |
| Tipografía por defecto (Inter, Roboto, system-ui) como única voz | Sin personalidad |
| Animaciones de entrada por sección, hover "lift" en cada tarjeta | Efecto genérico |
| Números en fuente proporcional, sin alineación decimal | Ilegible para dinero |

Permitido y esperado: densidad, tablas, formularios densos, texto pequeño legible, contraste alto.

---

## 4. Tipografía

Dos familias, roles nítidos, sin tercera fuente.

| Rol | Familia | Uso |
|---|---|---|
| Voz documental | **Spectral** (serif, 600) | Títulos de área de trabajo, títulos de sección, cifras de marca, números de pase |
| Trabajo diario | **Public Sans** (400/500/600) | Todo el texto de interfaz, tablas, formularios, botones |

Reglas:
- Las **cifras monetarias** se componen en Public Sans 600 con `font-variant-numeric: tabular-nums`
  y alineación a la derecha (`.num`, `th.num`). Nunca en serif: el serif es la voz, la sans es el dato.
- Un solo tamaño grande por pantalla como máximo (la cifra de deuda del resumen). La jerarquía se
  construye con peso, color y espacio, no apilando tamaños.
- Longitud de línea ≤ 68 caracteres en párrafos (`.ws-lead`, `.sheet__hint`).
- Sin `letter-spacing` positivo. Solo negativo (-0,01 / -0,02 em) en titulares.
- Nada de texto justificado.

Escala: 12 / 13 / 15 / 16 / 20 / 28 / 36 px (`--fs-xs` … `--fs-2xl`).

---

## 5. Color

Paleta fría, papel verdegris, acento verde oxidado. El color **codifica**, no decora.

| Token | Hex | Significado |
|---|---|---|
| `--paper` | `#EEF1F0` | Fondo de la aplicación (papel cuadriculado) |
| `--surface` | `#FFFFFF` | Folios, tablas, formularios |
| `--surface-alt` | `#F6F8F7` | Encabezados de tabla, hover de fila |
| `--ink` | `#17202A` | Texto principal |
| `--ink-2` | `#3C4A54` | Texto secundario |
| `--ink-3` | `#5F6C76` | Metadatos, ayudas, texto deshabilitado |
| `--line` / `--line-strong` | `#D4DCDA` / `#A6B3B0` | Reglas de registro / reglas estructurales |
| `--accent` | `#0B6B5B` | Acción primaria, estado correcto, dinero pagado |
| `--alert` | `#9B2C2C` | Deuda, error, anulación |
| `--warn` | `#8A5A00` | Pendiente de revisión, advertencia |
| `--area-fisica` | `#2F4C7E` | Física |
| `--area-quimica` | `#1D6B72` | Química |
| `--area-biologia` | `#4A6B2A` | Biología |

Reglas semánticas fijas:
- **Causado** → tinta (`--ink`). **Pagado** → acento verde. **Adeudado** → rojo (`--alert`).
- Un área científica se marca con una barra vertical de 3 px + nombre en `.area--*`. Nunca con fondo
  de color a toda la fila.
- Contraste verificado (calculado, no estimado): `#17202A` sobre `#FFFFFF` = 16,45:1;
  `#3C4A54` sobre `#FFFFFF` = 9,13:1; `#5F6C76` sobre `#FFFFFF` = 5,39:1;
  `#0B6B5B` sobre `#FFFFFF` = 6,43:1; blanco sobre `#0B6B5B` = 6,43:1; `#9B2C2C` = 7,53:1;
  `#8A5A00` = 5,93:1. Todo ≥ AA (4,5:1) para texto normal.

---

## 6. Estructura y layout

```
┌──────────────┬───────────────────────────────────────────────────────────┐
│ RIEL 252 px  │ CABECERA DEL ÁREA (título serif + línea guía + controles) │
│ marca        │ ─────────────────────────────────────────────────────────  │
│ 1..5 pasos   │ FOLIO / libro mayor / sub-folios                          │
│ pie: sesión  │                                                           │
└──────────────┴───────────────────────────────────────────────────────────┘
```

- **Riel izquierdo fijo** (`position: sticky`, 252 px). Contiene la marca institucional, los cinco
  espacios de trabajo numerados 1–5 (la numeración es legítima: el enunciado define una secuencia de
  cinco módulos) y, al pie, el estado de sesión y el cambio de rol.
- **Sin barra superior azul.** La marca vive en el riel; el área de trabajo empieza con su título.
- **Un solo nivel de "folio"**: `.sheet` contiene la sección; si hace falta agrupar, se usa
  `.subsheet` dentro, nunca dos capas de tarjeta con sombra.
- **Resumen**: no es una cuadrícula de cuatro tarjetas iguales. Es un `.ledger`: tres cifras
  separadas por reglas verticales y una columna lateral con el conteo de proyectos y beneficiarios.
  La cifra de deuda es la única grande y solo puede ser roja si es mayor que 0.
- Espaciado en múltiplos de 4. Separación entre secciones 24 px; dentro de un folio 16 px.
- Rejilla fluida con `repeat(auto-fit, minmax(...))`; ancho máximo de lectura, no ancho de pantalla.
- Radios: 3 px (controles) y 5 px (folios). No hay otros.

### Responsive
- ≥ 901 px: riel fijo a la izquierda.
- ≤ 900 px: el riel se convierte en una franja horizontal desplazable arriba; los folios ocupan el
  ancho completo; las cifras del libro mayor se apilan; **toda tabla vive dentro de `.table-scroll`**
  (desplazamiento horizontal con encabezados pegados a su columna).
- ≤ 600 px: formularios a una columna, botones a ancho completo cuando formen un grupo.

### Rutas y navegación (una vista por URL)

Cada espacio de trabajo tiene su propia ruta y el navegador es la fuente de verdad de la navegación:

| Ruta | Espacio | Roles con acceso |
|---|---|---|
| `/login` | Portal de acceso | público |
| `/resumen` | Resumen y deudas (1) | ADMIN, GENERADOR, RECEPTOR |
| `/catalogos` | Catálogos y asignaciones (2) | ADMIN, GENERADOR, RECEPTOR |
| `/causacion` | Causación y pagos (3) | GENERADOR, RECEPTOR |
| `/cajas-chicas` | Cajas chicas (4) | GENERADOR, RECEPTOR |
| `/auditoria` | Usuarios y auditoría (5) | ADMIN, RECEPTOR |

Reglas:
- La raíz `/` redirige al primer espacio permitido del rol o al portal si no hay sesión.
- Una ruta prohibida para el rol **no se muestra vacía**: redirige al primer espacio permitido y
  explica el motivo citando `RN-SEG-02`. El riel nunca ofrece una ruta que el rol no puede abrir.
- Cualquier ruta desconocida muestra una pantalla propia con dos salidas (resumen y acceso).
- La sesión se guarda en `sessionStorage` (ámbito de pestaña): recargar mantiene la vista y la
  sesión; cerrar la pestaña la elimina. El `logout` limpia el almacenamiento y vuelve a `/login`.
- Al entrar sin sesión a una ruta protegida, el portal recuerda el destino y vuelve a él tras
  autenticarse.
- Mientras se restaura la sesión se muestra un estado de carga (`.app-boot`), nunca la pantalla de
  acceso a medio pintar.

### Acciones destructivas y justificaciones

Las operaciones que una regla de negocio obliga a justificar (anular pago, causación, lote, solicitud
o vale; rechazar solicitud o vale) siguen una sola pauta en todas las vistas:

- El campo de motivo **nunca viene precargado**: lo escribe quien decide.
- El botón que ejecuta la acción permanece **inhabilitado** hasta que el motivo alcanza el mínimo que
  exige la regla (10 caracteres para anular, 5 para rechazar), y su `title` explica por qué.
- El campo se **vacía al terminar** la operación, para que la justificación de una acción no quede
  disponible para la siguiente.
- El resultado se comunica por el aviso de la vista citando la regla aplicada, y el registro queda en
  la bitácora de auditoría con el texto escrito.

---

## 7. Componentes y clases canónicas

Definidas en `frontend/src/styles/design-system.css`. **No se crean estilos inline nuevos**; si falta
una variante, se extiende la hoja de estilos con un token existente.

- Estructura: `.shell`, `.rail`, `.brand`, `.nav`, `.nav__item[aria-current="page"]`, `.workspace`,
  `.ws-head`, `.ws-title`, `.ws-lead`, `.ws-tools`, `.ws-body`.
- Contenedores: `.sheet`, `.sheet__head`, `.sheet__title`, `.sheet__hint`, `.sheet__body`,
  `.sheet__body--flush`, `.subsheet`, `.divider`, `.ledger`, `.figure`.
- Tablas: `.table-scroll` > `.table`; cabeceras numéricas `th.num`; celdas de dinero `td.num`;
  fila vacía `.table__empty`.
- Controles: `.btn`, `.btn--ghost`, `.btn--danger`, `.btn--sm`, `.btn--block`, `.btn-group`;
  `.field`, `.field__label`, `.input`, `.select`, `.textarea`, `.form-grid`, `.form-row`.
- Estado: `.badge`, `.badge--ok`, `.badge--alert`, `.badge--warn`, `.badge--plain`, `.chip`,
  `.area--fisica|quimica|biologia`, `.notice--ok`, `.notice--error`, `.empty`.
- Navegación interna: `.subtabs` + `.subtab[aria-selected="true"]`.
- Utilidades: `.stack`, `.stack--lg`, `.row`, `.row--between`, `.grid-2`, `.grid-3`, `.num`,
  `.muted`, `.nowrap`, `.text-right`, `.sr-only`.

### Accesibilidad obligatoria
- Todo control es `<button type="button">` o un `<input>`/`<select>` con `<label>` asociado.
- Cada acción destructiva (anular) lleva `.btn--danger` y su etiqueta dice qué anula.
- Los estados nunca se comunican solo por color: badge con texto explícito (`PENDIENTE`,
  `ANULADO`, `RENDIDO`).
- Foco visible siempre (`:focus-visible` ya definido). No se elimina el contorno.
- Tablas con `<thead>`/`<th scope="col">`; cifras con `aria-label` cuando el número va solo.

### Movimiento
- Solo transiciones de 120 ms en color/fondo/borde y el desvanecimiento del foco.
- Sin animaciones de entrada, sin parallax, sin "hover lift". `prefers-reduced-motion` respetado.

---

## 8. Voz y microcopy

- Español de Venezuela, registro administrativo, sin adornos.
- Se nombran las cosas por lo que el usuario hace: "Registrar pago", no "Enviar".
- Cada cifra monetaria se escribe con `formatUsdCurrency` (dos decimales y separador de miles).
- Los códigos de norma (`RN-CAUS-01`, `RN-PAG-02`) se citan en las ayudas de cada sección: son el
  argumento de defensa del proyecto y aquí funcionan como anotaciones al margen.
- Errores: dicen qué pasó y qué hacer, sin disculpas ni signos de admiración.
- Estados vacíos: explican por qué no hay datos y cuál es el siguiente paso.

---

## 9. Reglas por vista

| Vista | Regla propia |
|---|---|
| **1. Resumen y deudas** | Abre con `.ledger` (tres cifras + lateral). Debajo, un único folio con el estado de cuenta por beneficiario y el filtro de proyecto en la cabecera del folio. Nada más. |
| **2. Catálogos y asignaciones** | Cuatro bloques (proyectos, grupos de pago y cortes, beneficiarios, asignaciones) en sub-pestañas `.subtabs` o en folios consecutivos; cada uno con su tabla y su formulario en `.form-grid` arriba del registro. Los formularios son parte del folio, no modales flotantes. |
| **3. Causación, solicitudes y pagos** | Orden lógico del flujo: lote de causación → solicitud → revisión → pago FIFO → anulación. Cada paso es un folio con su código de norma en `.sheet__hint`. Las cifras de saldo usan `.num`; los estados, badges. |
| **4. Cajas chicas y reportes** | Una caja = un folio; sus períodos y vales, en tablas dentro del mismo folio. El saldo disponible de la caja es la cifra dominante, en `.figure__value`. |
| **5. Usuarios y auditoría** | Tabla de usuarios compacta y visor de `audit_log` con tipografía pequeña y `JSONB` en bloque desplazable. El ADMIN nunca ve controles de dinero. |

---

## 10. Criterios de aceptación visual

Una vista está terminada cuando:
1. Compila (`tsc -b && vite build`) y sus pruebas siguen en verde.
2. Se ve sin desbordamientos ni solapamientos a 1440×900 y a 390×844.
3. No hay errores en consola.
4. `impeccable detect` no reporta anti-patrones nuevos.
5. Ningún estilo inline introduce color, radio, sombra o tipografía fuera de los tokens.
6. Las reglas de negocio, los endpoints y el RBAC no cambiaron.
7. Su ruta se puede abrir directamente, recargar y compartir; un rol sin permiso es redirigido con
   explicación y el botón Atrás del navegador devuelve a la vista anterior.
