# AGENTS.md — Guía para Agentes de IA del Equipo

Este archivo es leído automáticamente por asistentes de codificación (Antigravity, Claude Code, Cursor, GitHub Copilot, etc.).

## Reglas de Lectura Obligatoria antes de Codificar
1. **Reglas de Negocio e Invariantes (`RN-*`):** Lee [`docs/REGLAS_DE_NEGOCIO.md`](./docs/REGLAS_DE_NEGOCIO.md) antes de escribir cualquier código.
2. **Clean Code y Unit Tests 1:1 (`CC-*` / `TEST-01`):** Lee [`docs/ESTANDARES_DESARROLLO_CLEAN_CODE.md`](./docs/ESTANDARES_DESARROLLO_CLEAN_CODE.md). Toda función debe seguir principios de Clean Code y tener su prueba unitaria (`*.spec.ts`) con patrón AAA pasando en verde.
3. **Decisiones Arquitectónicas:** Lee [`docs/DECISIONES_TECNICAS_DEFENSA.md`](./docs/DECISIONES_TECNICAS_DEFENSA.md) para respetar la arquitectura modular en capas (`Controller -> Service -> Prisma`).
4. **Reglas del Agente:** Sigue estrictamente todas las directrices de [`.agent/rules/reglas-proyecto.md`](./.agent/rules/reglas-proyecto.md).
5. **Bitácora de IA (Entregable #5):** Registra cada avance asistido por IA en [`docs/BITACORA_IA.md`](./docs/BITACORA_IA.md).
