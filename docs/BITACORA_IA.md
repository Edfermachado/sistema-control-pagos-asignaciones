# Bitácora de Uso de Inteligencia Artificial (Entregable #5)

**Universidad de Carabobo — Escuela de Computación**  
**Asignatura:** Sistemas de Información  
**Proyecto:** Sistema de Control de Pagos y Asignaciones

De acuerdo con la sección **4. Entregables del Proyecto (Punto 5 - Uso de IA)**, este documento registra de manera transparente las indicaciones (prompts) suministradas al asistente de Inteligencia Artificial generativa, el propósito de cada interacción y la validación/sustentación técnica aplicada por el equipo de desarrollo.

---

## Registro Cronológico de Interacciones (Prompts y Decisiones)

### Interacción #1 — Análisis de Requerimientos y Planificación por Etapas
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Crea un plan de desarrollo por etapas para este proyecto, pregúntame lo que necesites"* (adjuntando el enunciado oficial del proyecto de Sistemas de Información - UC).
* **Parámetros definidos por el equipo:**
  * Stack: TypeScript Full-Stack (React +Node.js + PostgreSQL).
  * Duración: 2 a 3 semanas (intensivo) para un equipo de 4 integrantes.
  * Prioridades adicionales: Docker Compose, pruebas unitarias para el motor financiero (prorrateo, FIFO e inmutabilidad) y bitácora de uso de IA desde el día 1.
* **Resultado generado y validado:**
  * Se estructuró un plan de trabajo dividido en 5 etapas (Etapa 0 a Etapa 4) y una matriz de responsabilidades para los 4 integrantes del equipo sin bloqueos cruzados.

---

### Interacción #2 — Definición Arquitectónica, Documentación de Defensa y Repositorio Inicial
* **Indicaciones suministradas a la IA (Prompt):**
  > *"Hazlo con la arquitectura modular y en el segundo caso explícame las ventajas y desventajas"*  
  > *"Usa React + Vite y el enfoque de flujo segregado, crea un documento explicando el porqué de cada decisión técnica para estudiar la defensa, así como crea el repo público en GitHub con el README del proyecto antes de empezar a construirlo, deberías poder hacerlo desde la terminal ya que tengo mi sesión iniciada"*
* **Decisiones arquitectónicas adoptadas por el equipo tras evaluar ventajas y desventajas:**
  1. **Backend con Arquitectura Modular en NestJS:** Separación estricta en `Controllers` (HTTP/DTOs), `Services` (reglas de negocio: prorrateo, FIFO, inmutabilidad) y `Prisma/PostgreSQL` (persistencia ACID con tipos decimales exactos `NUMERIC(12,2)`).
  2. **Frontend SPA con React + Vite:** Se eligió sobre Next.js para garantizar una separación Cliente-Servidor 100% pura (un único servidor backend en NestJS y un cliente puro en el navegador), facilitando su sustentación académica y reduciendo el consumo de recursos en Docker.
  3. **Flujo Segregado en Cajas Chicas:** El rol *Generador (Coordinador)* solicita vales y rinde comprobantes, mientras que el rol *Receptor (Gerente de Administración)* aprueba aperturas, autoriza vales, desembolsa y cierra el período mensual con arrastre de saldo, cumpliendo estrictamente el principio de Segregación de Funciones.
* **Artefactos generados:**
  * `docs/DECISIONES_TECNICAS_DEFENSA.md`: Documento de estudio técnico y justificación arquitectónica.
  * `docs/BITACORA_IA.md`: Este registro de trazabilidad de uso de IA.
  * `README.md`: Documentación principal del repositorio.
