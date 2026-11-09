# AGENTS.md — Guía para Agentes de IA del Equipo

Este archivo es leído automáticamente por asistentes de codificación (Antigravity, Claude Code, Cursor, GitHub Copilot, etc.).

## Reglas de Lectura Obligatoria antes de Codificar
1. **Reglas de Negocio e Invariantes (`RN-*`):** Lee [`docs/REGLAS_DE_NEGOCIO.md`](./docs/REGLAS_DE_NEGOCIO.md) antes de escribir cualquier código.
2. **Decisiones Arquitectónicas:** Lee [`docs/DECISIONES_TECNICAS_DEFENSA.md`](./docs/DECISIONES_TECNICAS_DEFENSA.md) para respetar la arquitectura modular en capas (`Controller -> Service -> Prisma`).
3. **Reglas del Agente:** Sigue estrictamente todas las directrices de [`.agent/rules/reglas-proyecto.md`](./.agent/rules/reglas-proyecto.md).
4. **Bitácora de IA (Entregable #5):** Registra cada avance asistido por IA en [`docs/BITACORA_IA.md`](./docs/BITACORA_IA.md).
