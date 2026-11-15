# Especificación común de migración visual (leer completo antes de editar)

Repositorio: Sistema de Control de Pagos y Asignaciones (USD) — React 18 + Vite + TypeScript.
Tu tarea es **migrar el marcado de UN archivo `.tsx` del estilo inline al sistema de clases CSS ya
definido**. No es un rediseño libre: el sistema visual ya está decidido y escrito.

## Lectura obligatoria, en este orden

1. `DESIGN.md` (raíz) — identidad, prohibiciones y regla por vista.
2. `frontend/src/styles/design-system.css` — inventario real de clases y tokens.
3. `frontend/src/App.tsx` — implementación de referencia del mismo sistema (riel, `.ws-body`,
   `.ledger`, `.sheet`, `.table-scroll`, badges, botones, formularios).

## Reglas duras

1. **No cambies lógica.** Ni `useState`, ni `useEffect`, ni handlers, ni llamadas a `apiRequest`, ni
   firmas de props, ni tipos exportados, ni condiciones de RBAC, ni mensajes de error/validación, ni
   URLs de endpoints. Solo cambia el marcado JSX y las clases.
2. **Cero estilos inline.** Elimina todos los `style={{ ... }}` y las constantes de estilo
   (`cardStyle`, `sectionTitleStyle`, `tableStyle`, `subTitleStyle`, `inputStyle`, etc.). Si una
   constante queda sin uso, bórrala: `tsconfig.json` tiene `noUnusedLocals: true` y el build falla.
3. **Solo clases que ya existen** en `design-system.css`. No agregues CSS, no uses `styled`, no
   inventes nombres. Si algo no encaja, usa la clase más cercana y reorganiza el marcado.
4. **Estructura de folio.** Cada bloque temático es un `<section className="sheet">` con
   `.sheet__head` (título `.sheet__title` + explicación `.sheet__hint`, citando la norma `RN-*`
   cuando corresponda) y `.sheet__body`. Puedes anidar un `.subsheet` dentro del cuerpo, nunca dos
   niveles de tarjeta.
5. **Tablas.** Toda tabla va dentro de `<div className="table-scroll"><table className="table">`.
   Encabezados `<th scope="col">`; columnas de dinero con `className="num"` en `th` y `td`;
   identificadores con `className="nowrap"`; nombre propio con `className="table__strong"`.
   Si no hay filas, usa una fila `<tr className="table__empty"><td colSpan={N}>…</td></tr>` que
   explique por qué está vacío y qué hacer.
6. **Formularios.** Cada campo: `<div className="field">` con `<label className="field__label"
   htmlFor="id">` y el `id` correspondiente en el control (`.input`, `.select`, `.textarea`).
   Agrupa los campos en `.form-grid` (varios) o `.form-row` (2–3 con botón al final). Prohibido el
   placeholder como única etiqueta.
7. **Botones.** `.btn` primario; `.btn .btn--ghost` secundario; `.btn .btn--danger` para anular o
   rechazar; `.btn--sm` dentro de tablas; agrupa con `.btn-group`. Todo `type="button"` salvo los
   `submit` de formularios.
8. **Estados.** Usa `.badge` + `--ok` / `--alert` / `--warn` con **texto** en español
   (`ANULADO`, `PARCIAL`, `DESEMBOLSADO`…). El estado nunca se comunica solo por color.
9. **Sin emojis.** Sustituye todo emoji por texto o por nada. Sin iconografía improvisada.
10. **Sin español inventado.** Mantén los textos existentes; puedes corregir tildes y quitar signos
    de admiración, pero no renombres conceptos del dominio (`Causación`, `Solicitud`, `Vale`,
    `Asignación`, `Rendición`).
11. **Accesibilidad.** `aria-label` en botones que solo muestran un símbolo; `aria-current`/`aria-selected`
    donde haya navegación; foco nunca suprimido.
12. **No ejecutes** `npm run build`, `npm test`, `vite`, ni comandos que levanten servidores. No
    modifiques ningún otro archivo del repositorio, ni `package.json`, ni `App.tsx`, ni el CSS.

## Cómo se compone cada bloque (patrón de referencia)

```tsx
<section className="sheet">
  <div className="sheet__head">
    <div>
      <h2 className="sheet__title">Proyectos</h2>
      <p className="sheet__hint">
        Área, ámbito y vigencia. RN-CAT-01 y RN-CAT-02.
      </p>
    </div>
    <div className="field">
      <label className="field__label" htmlFor="filtro-proyectos">
        Buscar
      </label>
      <input id="filtro-proyectos" className="input" /* … */ />
    </div>
  </div>
  <div className="sheet__body">
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Proyecto</th>
            <th scope="col" className="num">Período (USD)</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>{/* filas */}</tbody>
      </table>
    </div>
  </div>
</section>
```

Para cifras grandes o saldos destacados usa `.figure` con `.figure__label`, `.figure__value num` y
`.figure__note` (como en `App.tsx`). Para avisos internos, `.notice .notice--ok|--error`.

## Entrega

Cuando termines, responde en español, en menos de 15 líneas, con:
1. La ruta del archivo modificado y su número de líneas final.
2. La lista de secciones (`.sheet`) que quedaron.
3. Cualquier clase que hayas necesitado y no existiera (debe ser una lista vacía; si no lo es, di
   qué clase usaste en su lugar).
4. Confirmación explícita de que no cambiaste lógica, props ni endpoints.
