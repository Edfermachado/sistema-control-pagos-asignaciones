# reporte.md — Herramientas de diseño instaladas en el proyecto

**Qué es este documento:** el registro de lo que se instaló, cómo se usó y cuánto sirvió, para que
cualquier integrante del equipo (o su agente de IA) pueda repetir el trabajo, evaluarlo o decidir si
lo necesita. No es un sustituto de [`DESIGN.md`](./DESIGN.md): aquel define **cómo se ve** el sistema;
este cuenta **con qué herramientas se construyó y cómo volver a usarlas**.

**Fecha:** noviembre de 2026 · **Ámbito:** 100 % local al repositorio, sin instalaciones globales.
**Estado final:** interfaz rediseñada en las 5 vistas, build y pruebas en verde, 0 hallazgos del
detector de anti-patrones.

---

## 1. Resumen en una página

| Pregunta | Respuesta corta |
|---|---|
| ¿Se instalaron skills? | Sí, 3, en `.opencode/skills/` (ámbito de proyecto, sin `-g`). |
| ¿Se configuraron MCP? | Sí, 3 servidores locales en `opencode.json` (raíz, ignorado por git). |
| ¿Se usaron? | Las skills: sí, de forma activa. Los MCP: conectados y disponibles; solo `chrome-devtools` aportó trabajo real (indirecto). |
| ¿Cuánto pesan? | `.opencode/` = 25 MB: 2,4 MB de skills + 23 MB de caché (motor del detector). |
| ¿Rompen algo del proyecto? | No. No tocan el backend, las reglas de negocio ni los endpoints. |
| ¿Hacen falta para trabajar en el proyecto? | No para backend. Sí (recomendado) para cualquier cambio de interfaz. |
| ¿Cuánto trabajo ahorraron? | Mucho en criterio y verificación; casi nada en generación de componentes. |

---

## 2. Inventario de lo instalado

### 2.1 Skills (project-local)

| Skill | Origen | Versión | Para qué sirve de verdad |
|---|---|---|---|
| `impeccable` | `pbakaus/impeccable` | 4.9.1 (motor 0.1.24) | Criterio de dirección de arte + **detector determinista** de anti-patrones de IA sobre archivos o sobre una URL en ejecución. |
| `frontend-design` | `anthropics/skills` | — | Proceso de diseño: plan de tokens → revisión contra clichés → construcción → crítica. Su catálogo de "tells" generados es el mejor insumo del proyecto. |
| `web-design-guidelines` | `vercel-labs/agent-skills` | 1.0.0 | Lista de reglas de interfaz web (accesibilidad, contraste, semántica) que descarga desde `raw.githubusercontent.com` antes de cada revisión. |

Rutas:

```
.opencode/skills/impeccable/            # SKILL.md + 60 referencia + agentes + scripts
.opencode/skills/impeccable/scripts/impeccable      # lanzador (sh) del motor
.opencode/skills/impeccable/scripts/impeccable.cmd  # lanzador para Windows nativo
.opencode/skills/frontend-design/       # SKILL.md + LICENSE
.opencode/skills/web-design-guidelines/ # SKILL.md
.opencode/.cache/impeccable/            # motor binario verificable (cache local, ignorado por git)
.opencode/prompts/                      # especificaciones dadas a los agentes (reutilizables)
skills-lock.json                        # hashes de origen de cada skill
```

### 2.2 Servidores MCP

| Nombre | Comando | Estado | Uso real en este trabajo |
|---|---|---|---|
| `shadcn` | `npx -y shadcn@latest mcp` | conectado | **No usado.** Ver §5.2. |
| `chrome-devtools` | `npx -y chrome-devtools-mcp@latest --no-usage-statistics` | conectado | Disponible; la validación visual se hizo con el navegador CDP del orquestador (equivalente y con capturas). |
| `magic-21st` | `npx -y @21st-dev/magic@latest` + `API_KEY` | conectado | **No usado.** Ver §5.2. |

Configuración vigente en `opencode.json` (esquema **v2**, servidores bajo `mcp.servers`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "shadcn":          { "type": "local", "command": ["npx", "-y", "shadcn@latest", "mcp"] },
      "chrome-devtools": { "type": "local", "command": ["npx", "-y", "chrome-devtools-mcp@latest", "--no-usage-statistics"] },
      "magic-21st":      { "type": "local", "command": ["npx", "-y", "@21st-dev/magic@latest"],
                           "environment": { "API_KEY": "<clave real en el archivo, nunca en git>" } }
    }
  }
}
```

`opencode.json` está en `.gitignore` porque contiene la clave de 21st.dev. Comprobado que la clave no
aparece en ningún archivo versionado (`git ls-files -z | xargs -0 grep -l` buscando el prefijo de la
clave no devuelve nada).

---

## 3. Cómo se instaló (reproducible)

```bash
# 1. Skills (ámbito de proyecto: SIN -g; --copy deja archivos reales, no enlaces)
npx -y skills@latest add pbakaus/impeccable      -a opencode -y --copy
npx -y skills@latest add anthropics/skills       -s frontend-design      -a opencode -y --copy
npx -y skills@latest add vercel-labs/agent-skills -s web-design-guidelines -a opencode -y --copy
#    El instalador escribe en .agents/skills/; se trasladó a .opencode/skills/
#    (OpenCode v2 lee ambas rutas; se deja una sola para no duplicar nombres).

# 2. Configuración MCP + recarga
#    (editar opencode.json con el esquema mcp.servers y luego:)
opencode reload
opencode debug config   # confirma que el proyecto carga los 3 servidores
opencode mcp list       # confirma conexión: ✓ shadcn, ✓ chrome-devtools, ✓ magic-21st

# 3. Motor del detector, con caché dentro del proyecto
export IMPECCABLE_HOME="E:/Vigilia/SisInf/proyecto/repo/.opencode/.cache/impeccable"
sh .opencode/skills/impeccable/scripts/impeccable --version   # 0.1.24+engine
```

El motor se descarga desde los *releases* de GitHub y se valida contra
`.opencode/skills/impeccable/scripts/engine-checksums.txt` (SHA-256). Si no coincide, se niega a
ejecutarlo. Esa es la única descarga binaria de todo el conjunto.

---

## 4. Auditoría de seguridad realizada

Se inspeccionó cada `SKILL.md` y **todo** el código auxiliar antes de usar nada:

| Comprobación | Resultado |
|---|---|
| Instrucciones ocultas / prompt injection en los `SKILL.md` | Ninguna. Los tres son guías de diseño legibles. |
| `child_process`, `execSync`, `eval(`, `new Function` | Sin apariciones. |
| Lectura de variables sensibles (`*_KEY`, `*_TOKEN`, `*_SECRET`) | Sin apariciones. |
| Tuberías peligrosas (`curl … \| bash`), `base64 -d`, `rm -rf` | Sin apariciones. |
| Caracteres bidireccionales / zero-width (trucos de ocultación) | Sin apariciones. |
| Hosts referenciados | Solo `localhost`, `w3.org`, `github.com`, `raw.githubusercontent.com`, `impeccable.style`. |
| Binarios | El lanzador de `impeccable` descarga un ejecutable, con caché redirigida al proyecto y verificación de checksum. Todo lo demás es texto. |

Riesgo residual aceptado y documentado: `web-design-guidelines` **descarga** su lista de reglas desde
`raw.githubusercontent.com` en cada revisión. Sin red, la skill no aporta nada; con red, el contenido
llega de la organización Vercel y no ejecuta código.

---

## 5. Cómo se usó cada herramienta (sin adornos)

### 5.1 Skills — sí aportaron

| Herramienta | Uso concreto en este trabajo | ¿Sirvió? |
|---|---|---|
| `frontend-design` | Su lista de cinco "clústeres" que delatan diseño generado fue la base de las **11 prohibiciones** de `DESIGN.md`. Evitó directamente el destino obvio: fondo crema + serif de alto contraste + acento terracota (mi primera intuición, que habría sido un cliché más). | **Sí, alto impacto en criterio.** No tiene comandos: es pensamiento. |
| `impeccable` (referencias) | `craft-floor`, `operate` y `audit` dieron el estándar de calidad y la regla de que un panel administrativo es modo *Operate*: la ambición se demuestra como precisión, no como decoración. | **Sí, define el tono.** |
| `impeccable` (detector) | `impeccable detect` sobre `frontend/src` y sobre la app viva. Encontró tres defectos reales que yo no había visto: borde de color de 4 px a un lado en la portada original, **fondo cuadriculado de dos ejes** (que yo mismo había diseñado y que es firma de IA) y **contraste 4,4:1** en `--ink-3`. Resultado final: `[]`. | **Sí, es la red de seguridad objetiva.** Lo más valioso del conjunto. |
| `web-design-guidelines` | Checklist de accesibilidad y convenciones (foco, etiquetas, jerarquía). Se usó como referencia mental; no se ejecutó su flujo formal de descarga. | **Parcial.** Útil como lista, prescindible si no hay red. |

### 5.2 MCP — conectados, poco o nada usados (y por qué)

- **`shadcn`**: no se usó para generar componentes. Su salida es JSX con **Tailwind**, y el proyecto
  no tiene Tailwind ni alias de rutas. Adoptarlo habría significado reescribir el sistema de tokens y
  empujar la interfaz hacia el "kit de tarjetas idénticas" que el rediseño debía erradicar. Se dejó
  configurado para el día en que el equipo decida migrar a Tailwind.
- **`magic-21st`**: misma razón. Genera bloques de marketing (héroes, tarjetas) con su propio estilo;
  usarlos dentro de un panel contable habría introducido una segunda voz visual. Queda disponible para
  una landing o una presentación, no para este panel.
- **`chrome-devtools`**: disponible para el agente; la verificación visual se ejecutó con el navegador
  CDP del orquestador, que ofrece lo mismo (viewport, DOM, consola, captura) con más control y dejando
  evidencia en PNG. El MCP es la vía natural si se quiere que **OpenCode** se valide a sí mismo.

**Conclusión honesta:** los MCP no aportaron al resultado de este trabajo; las skills sí. Los MCP son
infraestructura lista para cuando se necesite *generar* componentes o *inspeccionar* el navegador desde
el propio agente.

### 5.3 OpenCode — el que hizo el trabajo pesado

- CLI **v2.3.0**, modelo `deepseek/deepseek-v4-pro`, `--auto` para ejecución no interactiva.
- Cuatro sesiones en paralelo, una por archivo de vista, con la especificación escrita en
  `.opencode/prompts/` (`spec-comun.md` + `vista-*.md`). Resultado: 4.080 líneas migradas de estilo
  inline a clases, sin cambiar endpoints ni lógica.
- La verificación **no** se delegó: build, pruebas, contrato de endpoints y auditoría visual los hizo
  el orquestador. Los agentes tienden a declarar éxito sin comprobarlo.

---

## 6. Recetas para reutilizar (copiar y pegar)

```bash
cd /e/Vigilia/SisInf/proyecto/repo

# ¿Está todo vivo?
docker compose ps
opencode mcp list

# Detector de anti-patrones sobre la app en ejecución (lo más útil del conjunto)
export IMPECCABLE_HOME="E:/Vigilia/SisInf/proyecto/repo/.opencode/.cache/impeccable"
sh .opencode/skills/impeccable/scripts/impeccable detect http://localhost:5173 --json

# Detector sobre el código (parcial: no evalúa contraste ni tamaños, avisa de ello)
sh .opencode/skills/impeccable/scripts/impeccable detect frontend/src --json

# Ver el catálogo completo de reglas que aplica
sh .opencode/skills/impeccable/scripts/impeccable detect --list-rules

# Ejecutar un agente de rediseño acotado a UN archivo
env -u PWD -u OLDPWD "/c/Program Files/nodejs/node_modules/@opencode/cli/bin/opencode.exe" \
  run --model deepseek/deepseek-v4-pro --auto --title "rediseno-x" \
  "Lee .opencode/prompts/spec-comun.md y .opencode/prompts/vista-caja.md y aplícalo en frontend/src/components/PettyCashAndReportsPanel.tsx. No ejecutes builds ni toques otros archivos."

# Verificación estándar después de tocar interfaz
cd frontend && npx tsc -b && npx vitest run && cd ..
docker compose build frontend && docker compose up -d frontend
node scripts/api-smoke-test.mjs          # 68 comprobaciones end-to-end
```

Comprobación de que un rediseño **no rompió el contrato** con la API (endpoints, handlers e
interfaces exportadas iguales a `HEAD`):

```python
import subprocess, re
files = ["frontend/src/App.tsx"] + [f"frontend/src/components/{n}" for n in
         ["CatalogsAndAssignmentsWorkspace.tsx","FinancialEnginePanel.tsx",
          "PettyCashAndReportsPanel.tsx","UsersAndAuditWorkspace.tsx"]]
# captura la ruta literal pasada a apiRequest/downloadAuthenticatedPdf, incluso en plantillas
ep   = re.compile(r"""(?:apiRequest<[^>]*>\(\s*|downloadAuthenticatedPdf\(\s*|`?)['"`](/[a-zA-Z0-9\-/:._${}?=&]*)['"`]""")
hand = re.compile(r"const (handle\w+|load\w+|refresh\w+)\s*=")
for f in files:
    old = subprocess.run(["git","show",f"HEAD:{f}"],capture_output=True,text=True,encoding="utf-8").stdout
    new = open(f,encoding="utf-8").read()
    print(f.split("/")[-1],
          "endpoints:", len(set(ep.findall(old))), "->", len(set(ep.findall(new))),
          "| faltantes:", set(ep.findall(old))-set(ep.findall(new)),
          "| handlers faltantes:", set(hand.findall(old))-set(hand.findall(new)))
```

Salida esperada con el estado actual (todas las listas de faltantes vacías):
`App.tsx 15->15`, `CatalogsAndAssignmentsWorkspace 13->13`, `FinancialEnginePanel 14->14`,
`PettyCashAndReportsPanel 12->12`, `UsersAndAuditWorkspace 4->4` (58 en total).

Estándar de validación visual usado (y exigible de ahora en adelante): 5 vistas × 1440×900 y
390×844, midiendo en el DOM errores de consola, desbordes horizontales, texto recortado y contraste
real de cada nodo de texto contra su fondo. Así se pasó de "parece que se ve bien" a 0 defectos
medidos.

---

## 7. Trampas conocidas (esto ahorra horas)

1. **OpenCode desde git-bash falla con `Failed to change directory to /e/...`.** El binario nativo
   recibe el `PWD` estilo MSYS. Ni `--standalone`, ni reiniciar el servicio, ni PowerShell lo
   arreglan (heredan la variable). Solución: llamar al `.exe` con `env -u PWD -u OLDPWD`.
2. **El esquema de configuración cambió en v2:** `mcp.servers.<nombre>`, no `mcp.<nombre>`.
   `opencode mcp list` puede mostrar estado incompleto justo después de editar; hacer
   `opencode reload` y comprobar con `opencode debug config`.
3. **`IMPECCABLE_HOME` debe ser ruta estilo Windows** (`E:/...`). Con `/e/...` el `curl` interno del
   lanzador no puede escribir el archivo y el error que da es "no se pudo descargar".
4. **El puerto 5173 lo ocupa el contenedor** del frontend. Para desarrollo con recarga en caliente,
   usar `npx vite --port 5174`; el contenedor solo se actualiza al reconstruir la imagen.
5. **Cuota de Google agotada:** `google/gemini-3.1-pro-preview` responde *quota exceeded* (nivel
   gratuito). `deepseek/deepseek-v4-pro` funcionó sin problema.
6. **Los MCP arrancan con `npx -y`**, así que la primera conexión de cada sesión descarga el paquete.
   Si `opencode mcp list` tarda, es normal.
7. **No se puede editar `AGENTS.md`** sin aprobación explícita del usuario (archivo protegido). Las
   reglas de diseño quedaron en `.agent/rules/reglas-proyecto.md` y en `DESIGN.md`.

---

## 8. ¿Necesito estas herramientas?

- **Cambio de lógica, backend, base de datos o reglas `RN-*`:** no. Nada de esto interviene. Se usan
  las pruebas de Jest y la prueba de humo de la API.
- **Vista nueva, rediseño o revisión de calidad visual:** sí. El orden que funcionó fue
  `DESIGN.md` → clases del sistema → agente por archivo → `impeccable detect` → medición en el DOM a
  dos tamaños.
- **Un ajuste puntual de estilo:** basta `frontend/src/styles/design-system.css` y el detector. No
  hace falta instalar ni configurar nada más.
- **Generar componentes con shadcn o 21st.dev:** solo si el equipo acepta **adoptar Tailwind** y
  rehacer el sistema de tokens. Decisión pendiente, no un ajuste cosmético.

---

## 9. Qué NO hacen estas herramientas

- No validan lógica de negocio ni cálculos financieros (eso son las 225 pruebas de Jest y el smoke).
- El detector no sustituye una auditoría de accesibilidad seria (teclado, lectores de pantalla,
  ARIA avanzado). Revisa tipografía, contraste, layout y patrones visuales.
- No levantan el proyecto ni arreglan el entorno: Docker, Node y PostgreSQL siguen siendo tu
  responsabilidad.
- No deciden el diseño. Aportan criterio y frenan los clichés; la dirección sigue siendo una decisión
  humana (y está escrita en `DESIGN.md`).

---

## 10. Estado verificado al cierre

| Comprobación | Resultado |
|---|---|
| `tsc -b` + `vite build` (dentro de la imagen Docker) | Sin errores |
| Backend Jest | 30 suites / **225** pruebas en verde |
| Frontend Vitest | 5 suites / **27** pruebas en verde |
| Prueba de humo API (`scripts/api-smoke-test.mjs`) | **68 / 68** |
| `impeccable detect` sobre `frontend/src` y sobre la app viva | `[]` (cero hallazgos) |
| Capturas 5 vistas × 1440×900 y 390×844 | 0 errores de consola, 0 desbordes, 0 recortes, 0 fallos de contraste |
| Estilos inline en el frontend | 0 |
| Endpoints / handlers / interfaces exportadas vs. `HEAD` | Idénticos (58 endpoints) |
| Contenedores | `scpa_frontend`, `scpa_backend` y `scpa_postgres` arriba; web y API responden 200 |

Evidencia visual: `.opencode/.cache/shots/desktop-1..5.png` y `mobile-1..5.png`.
Bitácora del trabajo: `docs/BITACORA_IA.md`, Interacción #14.

---

## 11. Pendientes y decisiones abiertas

1. **Commit.** Todo el rediseño está sin confirmar en git, más `DESIGN.md`, `.opencode/`,
   `skills-lock.json` y `.gitignore` modificado. Nada se subió ni se hizo merge.
2. **`skills-lock.json`:** conviene confirmarlo en el repo para que las versiones de las skills sean
   reproducibles; `.opencode/.cache/` nunca debe versionarse (ya está ignorado).
3. **shadcn/Tailwind:** decidir si se adopta ese stack de componentes o se mantiene el sistema CSS
   propio. Hoy la decisión es "no", por coherencia visual.
4. **`FE-02` (máximo 200 líneas por `.tsx`):** el rediseño no fragmentó los componentes; siguen en
   500–1.330 líneas. Es la siguiente deuda técnica, ya visible antes de este trabajo.
5. **`AGENTS.md`:** falta añadir la regla de lectura de `DESIGN.md`; requiere que el usuario apruebe
   la escritura del archivo.
6. **Redes de seguridad automatizadas:** el detector y las mediciones se ejecutaron a mano. Llevarlas
   a un script `npm run audit:ui` (o a CI) evitaría que el estándar se pierda en el próximo cambio.
