# Relevamiento para tests automáticos (ccdt front + ccdt-back)

Fecha: 2026-09-23. Cubre los dos repos: `ccdt` (front) y `ccdt-Back` (API).

## 1. Estado actual

### Front (`ccdt`)
- Vite 5 + React 18 + TS + shadcn/Radix + TanStack Query + react-hook-form/zod. Node 22.
- 29 páginas (`src/pages`), ~57 componentes propios + `src/components/ui`, 19 módulos en `src/lib`,
  8 hooks, 3 contexts (`AuthContext` 18KB es el más pesado).
- `src/lib/api.ts`: 71KB, ~200 funciones exportadas, un solo `apiCall()` con `fetch` + Bearer.
- 14 `supabase.from()` directos en 4 archivos: `MiniStatsCarousel`, `RegisterUserModal`,
  `Estadisticas`, `GestionUsuarios`.
- Scripts: solo `dev`, `build`, `lint`. **Sin runner de tests, sin tests, sin CI.**
- Existe la skill `.claude/skills/test-pantalla` (E2E exploratorio manual con Playwright MCP):
  define viewports (1440x900 / 360x780), modo PROD read-only y credenciales en
  `.claude/test-credentials.local`. Es la base conceptual del E2E automatizado.

### Back (`ccdt-Back`)
- Express 4 + supabase-js (cliente `supabase` anon y `supabaseAdmin` service key). CommonJS.
- 23 archivos de rutas → **155 endpoints**; 23 controllers (`studentsController` 55KB,
  `smallGroupsController` 34KB, `webhookController` 23KB), 11 services, `scheduler.js` con cron.
- `authMiddleware.js` (10KB) concentra: verificación de token, timeout por inactividad (60min),
  `SESSION_REVOKED` por `sessions_invalidated_at`, suspensión de usuario, empresa inactiva/vencida
  y derivación de `company_id` desde el perfil (anti tenant-spoofing).
- `npm test` es el stub `exit 1`. **Sin tests, sin CI.**

### Infraestructura ya disponible para testear
- Supabase local corriendo en Docker (CLI 2.104) + `supabase/migrations` + `migrations/sp/`.
- `scripts/sync-local-db.sh` recrea esquema local y carga datos.
- Playwright 1.63 disponible en el entorno (no es dependencia de ningún repo todavía).
- GlitchTip para errores en runtime (complementa, no reemplaza, los tests).

## 2. Prioridad por riesgo

| # | Área | Por qué primero |
|---|------|-----------------|
| 1 | Aislamiento multi-tenant (`company_id`) | El CLAUDE.md del back la llama "la vulnerabilidad #1": con `supabaseAdmin` no hay RLS que salve un `.eq('company_id')` olvidado. 155 endpoints sin una sola verificación automática. |
| 2 | `authMiddleware` | 6 caminos de rechazo distintos (401/403 con `code`), cada uno con su reacción en el front. Un bug acá abre o cierra la app entera. |
| 3 | Permisos por rol | `roleFilter.anyRole`, `COVERAGE_ROLES`, `rolePermissions.ts` y `suspension.ts` (espejo declarado del guard del back, hoy sin nada que verifique que siguen espejados). |
| 4 | Planes / límites / precios | `src/config/plans.js` ↔ `src/lib/plans.ts` "deben coincidir" por comentario; `effectiveLimit`, `monthlyPrice`, `recurringAmount` mueven plata. |
| 5 | Webhook Mercado Pago | `/api/webhooks/*` va **antes** de `authMiddleware` y muta `is_active`/`due_date`. |
| 6 | Asistencia | SPs `asistencia_cobertura` / `asistencia_matriz` + reglas de scope por departamento. |

## 3. Stack propuesto

- **Back: `node:test` nativo** (Node 22) + `fetch` global contra `app.listen(0)`. Cero dependencias
  nuevas, respeta la regla 11 del CLAUDE.md del back (no sumar capas). `node --test` ya trae
  runner, mocks y `--experimental-test-coverage`.
- **Front: Vitest + jsdom + @testing-library/react.** Vitest reutiliza `vite.config.ts` (alias `@`)
  sin configuración duplicada; es el runner natural del stack y el que la regla 17 del CLAUDE.md
  del front ya nombra.
- **E2E: Playwright** como dependencia del front, en dos modos (ver Fase 4).
- Sin MSW por ahora: los tests de `lib/` son puros y los de `api.ts` se resuelven stubbeando
  `globalThis.fetch`. Si aparece necesidad de mockear muchos endpoints, ahí sí evaluar MSW.

Layout:

```
ccdt-Back/
  src/app.js            # NUEVO: express app sin listen ni side effects
  server.js             # bootstrap: listen + scheduler + whatsapp
  tests/unit/*.test.js
  tests/integration/*.test.js
  tests/helpers/{app.js,auth.js,seed.js}
ccdt/
  src/**/*.test.ts      # colocados junto al módulo
  vitest.config.ts
  e2e/*.spec.ts         # Playwright
  playwright.config.ts
```

## 4. Fases

### Fase 0 — Prerrequisitos (bloqueantes)
1. **Extraer `app` de `server.js`.** Hoy requerir `server.js` levanta el scheduler de cron y
   Baileys (WhatsApp) e inicia `listen`. Sin un `src/app.js` que solo arme la app, no hay test
   HTTP posible. `server.js` queda como bootstrap.
2. **Seed sintético para tests.** `supabase/seed_data.sql` es un dump de producción con datos
   personales reales: no sirve como fixture ni puede ir a CI. Hace falta un seed chico y fijo con
   **dos empresas (A y B)** y un usuario por rol en cada una — es lo que habilita toda la suite de
   aislamiento multi-tenant.
3. `.env.test` en el back apuntando a la Supabase local (54321) + `npm test` real.
4. Front: instalar `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`;
   `vitest.config.ts` que herede el alias `@`.

### Fase 1 — Unit puros (sin infra, rápido)

Front:
- `lib/utils.ts` → `normalizeName` (apellidos con guión/apóstrofe, acentos, espacios múltiples,
  null), `formatDni`.
- `lib/rolePermissions.ts` → `rolesOf`, `hasPermission`, `isCustomRole`, `getActiveCustomRole`.
- `lib/suspension.ts` → `canManageSuspensions`, `canSuspendTarget` (actor==target, roles nunca
  suspendibles, director sin departamento compartido, peers).
- `lib/departments.ts` → `sinDepartamento`, `esSoloCongregacion`, `formatDepartmentName`.
- `lib/plans.ts` → `effectiveLimit`, `planLimit`, `PLAN_WARN_RATIO`.

Back:
- `config/plans.js` → `effectiveLimit` (plan desconocido, ilimitado, packs), `monthlyPrice`
  (escalón de corporativo a partir de 750 miembros).
- `utils/roleFilter.js` → `anyRole` con roles que llevan punto y guión (`secr.-calendario`),
  lista vacía, comillas escapadas.
- `subscriptionController.recurringAmount` (ya exportada aparte).

**Tests de paridad front↔back** (hoy solo garantizados por comentarios):
- `PLAN_LIMITS`/`PACK_SIZE` de `plans.js` vs `PLANS`/`PACK_SIZE` de `plans.ts`.
- `EVENT_COLORS` de `attendanceController.js` vs las keys de `lib/eventColors.ts`.
- Reglas de `suspension.ts` vs `profilesController.suspensionRejection`.

Requiere extraer a módulos propios (hoy son privados del archivo): `weekdayOf` y
`lastScheduledDates` de `absenceService.js` (exporta una instancia de clase), y `todayInAR`,
`isDate`, `isUuid` de `attendanceController.js`.

### Fase 2 — Integración HTTP del back (mayor valor)

Con `src/app.js` + Supabase local + seed de dos empresas:

- **`authMiddleware`, una prueba por rama:** sin token → 401; token inválido → 401;
  `last_active_at` > 60min → 401 `INACTIVITY_TIMEOUT`; login fresco (<5min por `amr`) no dispara
  el timeout; `sessions_invalidated_at` posterior al login → 401 `SESSION_REVOKED`;
  `suspended` → 403 `USER_SUSPENDED` salvo los prefijos permitidos (`/api/heartbeat`,
  `/api/company`, `/api/tours`, `/api/tokens`, `/api/fcm`, GET `/api/events`);
  empresa `is_active=false` o `due_date` vencido → 403 `COMPANY_INACTIVE` salvo `/api/subscription`;
  `x-company-id` de otra empresa → se ignora y se usa el del perfil; `system_admin` → `companyId` null.
- **Matriz de aislamiento multi-tenant:** test parametrizado que recorre los endpoints con token
  de la empresa A pidiendo recursos de la empresa B → nunca 200 con datos. Es el test que más
  paga de todo el plan.
- **Smoke de carga de rutas:** ninguna respuesta debe contener `'Controller not available'`
  (el try/catch de `server.js` hoy devuelve 200 vacío si un controller no carga — deuda que el
  propio CLAUDE.md marca).
- **Por recurso:** `students` (límite de plan `MEMBER_LIMIT_REACHED`, DNI duplicado/`ARCHIVED_DNI`,
  `merge`, `promote`, `restore`, `archived`), `attendance` (403 por rol en `coverage`, rangos de
  `matrix`, re-marcado del mismo día), `authorizations`, `accounting`, `small-groups`,
  `system` (solo `system_admin`), `subscription`.
- **Webhooks:** `/api/webhooks/*` no pasa por `authMiddleware` → verificar que valida su propio
  secreto y que un pago aprobado actualiza `is_active`/`due_date`.

### Fase 3 — Front unit/componentes (acotado)

- `api.ts` → manejo de errores de `apiCall`: cada `code` (`COMPANY_INACTIVE`, `USER_SUSPENDED`,
  `INACTIVITY_TIMEOUT`, `SESSION_REVOKED`) y su efecto (sessionStorage, limpieza de localStorage,
  `signOut`, redirect). Hoy es la lógica de sesión más frágil del front y no tiene red.
- `hooks/useRoles` (`labelOf`, mezcla builtin+custom), `hooks/useDepartments`.
- Componentes con reglas propias: `DniIdentityInput`, `PersonSearchInput`, validaciones de
  `EditStudentModal`.
- **No** testear las 29 páginas con Testing Library: costo alto, valor bajo. Eso va a E2E.

### Fase 4 — E2E Playwright

- **4a. Modo demo (sin backend, determinista, barato):** `src/lib/demo.ts` ya provee sesión
  simulada, dataset completo y bloqueo de escrituras, activable con `localStorage` vía
  `addInitScript`. Permite un smoke de las 29 pantallas × 4 roles demo (admin, secretaría,
  director, maestro) que detecta crashes de render, rutas rotas y permisos mal aplicados, en
  segundos y sin datos reales. Es el candidato para correr en cada PR.
- **4b. Flujos reales contra Supabase local:** login, tomar asistencia → historial, alta de
  miembro → tope de plan, autorización de salida con firma, promoción masiva.
- Viewports 1440x900 y 360x780, tomando de la skill `test-pantalla` los asserts visuales
  (overflow horizontal, solapamientos, área de click < 44px) ya especificados ahí.

### Fase 5 — CI (no existe `.github/` en ninguno de los dos repos)

- Front: `lint` + `tsc --noEmit` + `vitest run` + `build` + E2E demo en cada PR.
- Back: `node --test` (unit) en cada PR; integración con `supabase start` en el runner.
- E2E real contra local: nightly, no por PR.

## 5. Obstáculos concretos detectados

1. `server.js` no exporta `app` y arranca cron + WhatsApp al requerirlo → **bloquea todo test HTTP**.
2. `seed_data.sql` es dump de producción con PII → no reutilizable como fixture.
3. `npm test` del back hoy es `exit 1`: cualquier CI que lo llame falla de entrada.
4. Front: `getApiBaseUrl()` hardcodea `localhost:3001` y hace un health-check con `fetch`;
   `_resolvedLocalUrl` es estado de módulo que hay que resetear entre tests.
5. `api.ts` con ~200 exports en un archivo complica el mock por endpoint (no impide testear).
6. Fechas: `todayInAR()`, `yesterdayInAR()` leen el reloj real → asistencia, cumpleaños y
   vencimientos necesitan fake timers o inyección de fecha.
7. `pickEventColor` usa `Math.random()` → testear la selección del mínimo, no el color devuelto.
8. Los 14 `supabase.from()` directos del front obligan a mockear el cliente de Supabase además
   de `fetch` en los tests de esas 4 pantallas.
9. Servicios externos (Baileys, FCM, Resend, Mercado Pago) se inicializan en import → hay que
   aislarlos por env/flag en el entorno de test.

## 6. Orden sugerido

Fase 0 → Fase 1 (unit + paridad) → Fase 2 (authMiddleware y aislamiento) → Fase 5 parcial (CI de
unit) → Fase 4a (smoke demo) → Fase 3 → Fase 2 resto por recurso → Fase 4b.

El corte mínimo que ya cambia el riesgo del proyecto: **Fase 0 + authMiddleware + matriz de
aislamiento multi-tenant**.

## 7. Estado de avance

- **Fase 0.1 — hecho.** `ccdt-Back/src/app.js` arma la app (rutas + middlewares) y exporta `app`;
  `server.js` quedó como bootstrap (95 líneas: listen, cron, WhatsApp, apagado controlado).
  Verificado: `app.listen(0)` responde `GET /` 200 y `GET /api/students` 401 sin levantar
  Baileys ni el scheduler.
- **Fase 0.4 — hecho.** Front con `vitest@3` + `jsdom` (vitest 5 pide Vite 6; el repo está en
  Vite 5) y `vitest.config.ts` propio con el alias `@`. Scripts: `npm test` / `npm run test:watch`.
- **Back: runner listo.** `node:test` sin dependencias nuevas. `npm test` =
  `node --test "tests/**/*.test.js"` (el patrón es necesario: Node 22.12 no acepta un directorio,
  y sin él tomaría `test-notify.js` / `test-whatsapp-2.js` de la raíz).
- **Fase 1 — parcial (67 tests en verde).**
  - Back (15): `config/plans.js`, `utils/roleFilter.js`.
  - Front (52): `lib/utils.ts`, `lib/departments.ts`, `lib/plans.ts`, `lib/suspension.ts`,
    `lib/rolePermissions.ts`.
  - La paridad front↔back de planes se cubre con el mismo assert duplicado en los dos repos
    (no hay import cruzado entre repos, así que si uno cambia falla el otro).
  - Falta: extraer a módulos propios `weekdayOf`/`lastScheduledDates` (`absenceService.js`) y
    `todayInAR`/`isDate`/`isUuid` (`attendanceController.js`) para poder testearlos, y la paridad
    de `EVENT_COLORS`.
- **Fase 0.2 y 0.3 — hecho.** `ccdt-Back/.env.test` (gitignoreado) generado desde
  `supabase status -o env`, y `tests/helpers/env.js` corta la corrida si `SUPABASE_URL` no apunta
  a `127.0.0.1`. El guard no es opcional: el `.env` del repo apunta a **producción**.
  El fixture (`tests/helpers/fixture.js`) arma dos congregaciones completas por corrida
  (departamento, clases, alumnos y usuarios `admin`/`maestro` con token real) y las borra al final.
- **Fase 2 — arrancada (20 tests de integración en verde).**
  - `tests/integration/authMiddleware.test.js` (11): las seis ramas de rechazo, el eco de
    `x-company-id`, la excepción de `/api/subscription` con la empresa vencida y el heartbeat
    del usuario suspendido.
  - `tests/integration/multiTenant.test.js` (6): 9 listados y 12 recursos por id pedidos con el
    token de la empresa A contra datos de la B, más cuatro mutaciones cruzadas (editar/dar de baja
    un alumno, editar un departamento, cargar una observación). Ninguna filtró.
  - Para probar el timeout por inactividad y el cierre global de sesiones hay que re-firmar un
    token **real** cambiando el `amr` conservando el `session_id`: GoTrue rechaza un JWT
    inventado de cero ("Auth session missing").

### Bloqueante para seguir la Fase 2: la DB local está desactualizada

La local se recrea desde `ccdt/supabase/migrations` (5 archivos), pero el esquema vivo se fue
armando en `ccdt-Back/migrations` (~35 sueltos + `migrations/sp/`). Hoy le faltan a la local:

- Tablas: `plans`, `payments`, `company_roles`, `user_notifications`, `notification_broadcasts`,
  `badges`. Por eso `GET /api/subscription` responde 500 localmente.
- Valores del enum `app_role`: `miembro` y `system_admin` (no se pueden testear los guards de
  system admin ni el rol miembro).
- SPs del schema `api`: están 9 de los 14 versionados (faltan `contabilidad_por_motivo` y
  `departamento_eliminar`, entre otros).

**Decisión tomada: baseline desde producción.** `scripts/baseline-schema.sh` hace el trabajo
completo: dump del esquema de la DB linkeada (solo lectura), archiva las migraciones actuales en
`supabase/migrations_historico/`, deja una única migración base y resetea la local. Hay que
correrlo a mano (`bash scripts/baseline-schema.sh`) — lee de producción. Después de eso,
`supabase db push` intentaría aplicar la baseline sobre prod: este repo no lo usa, y si se
empieza a usar hay que marcarla como aplicada con `supabase migration repair`.

**Ya corrido (24/09).** La local quedó con el esquema de prod: aparecieron `plans`, `payments`,
`company_roles`, `user_notifications`, `notification_broadcasts` y `badges`, los valores
`system_admin` y `miembro` del enum `app_role`, y los 11 SPs del schema `api`. La suite siguió en
verde después del reset, que es la prueba de que el fixture no depende de datos preexistentes.
El baseline trae **esquema sin datos**: el catálogo de `plans` queda vacío y lo siembra el test
que lo necesita.

### Fase 2, segunda tanda: alta de miembros (9 tests)

`tests/integration/students.test.js`: validación de nombre, DNI duplicado (409), DNI de ficha
archivada (`ARCHIVED_DNI` con los datos para reactivarla), mismo DNI en congregaciones distintas,
tope del plan (`MEMBER_LIMIT_REACHED`) y búsqueda sin cruce entre empresas.

Dos cosas que encontraron estos tests:

1. **`errorHandler` se comía el `code` de los errores lanzados con `next(err)`** — corregido.
   `MEMBER_LIMIT_REACHED`, `GROUP_ARCHIVED` y `GROUP_CAPACITY_REACHED` llegaban al front como un
   403/409 sin código, indistinguible de un error genérico. Los códigos que el front sí usa hoy
   (`ARCHIVED_DNI`, `COMPANY_INACTIVE`, `USER_SUSPENDED`, `INACTIVITY_TIMEOUT`, `SESSION_REVOKED`)
   viajan por `res.json()` directo, así que nunca se vio el problema.
2. **La normalización de nombres vive solo en el front** (`normalizeStudentNames` en `api.ts`).
   Un POST directo al API guarda `"maría   josé"` tal cual. El test quedó marcado como `todo`
   hasta decidir si el back también debe normalizar.

### Fase 2, tercera tanda: super admin y suscripción (15 tests)

- `tests/integration/systemAdmin.test.js` (5): barrido de **los 18 endpoints de `/api/system`**
  con token de admin de congregación y con token de maestro — los 36 intentos dan 403 — más la
  verificación de que la empresa atacada quedó intacta y el caso positivo del `system_admin`.
  Al sumar un endpoint nuevo al panel, va a la tabla `endpoints()` de ese archivo.
- `tests/integration/subscription.test.js` (10): permisos de lectura, upgrade con prorrateo,
  downgrade agendado, el tope que impide bajar por debajo del padrón, packs y validaciones.
  Siembra un catálogo de planes sintético (precios redondos) y lo borra al terminar.

**Hallazgo del trigger `sync_profile_to_student`:** todo perfil con rol `maestro` o `colaborador`
genera una ficha en `students` cuando se actualiza, y `authMiddleware` actualiza `last_active_at`
en **cada** request. O sea: un maestro que entra a la app pasa a contar contra el límite de
miembros del plan. No es un bug, pero no es evidente y afecta la facturación.

### Fase 5 — CI (hecho)

`.github/workflows/tests.yml` en los dos repos, disparado en cada push y a mano
(`workflow_dispatch`).

- **Front:** `npm ci` → lint (informativo, `continue-on-error`: el repo arrastra ~420 problemas
  previos) → `npm test` → `npm run build`.
- **Back:** dos jobs. `unit` corre solo. `integracion` checkoutea **también el repo del front**
  (ahí viven `supabase/config.toml` y las migraciones), levanta la Supabase local con
  `supabase/setup-cli`, genera el `.env.test` con el mismo pipeline que en local y corre
  `npm run test:integration`.

**Lo que encontró la primera corrida verde.** Correr la suite en una máquina limpia sacó a la
luz tres cosas que en local estaban tapadas:

1. `config/serviceAccountKey.json` está gitignoreado, así que sin él `firebase.js` reventaba en
   el `require` y se llevaba puestos **siete routers** (events, students, fcm, webhooks,
   maintenance, notifications, profiles). El `try/catch` de `app.js` se tragaba el error y esas
   rutas quedaban sin montar, respondiendo 404 "Ruta no encontrada". Si esa credencial falta en
   producción, medio API desaparece sin un error visible. Ahora la app levanta igual y `messaging`
   queda como un stub que rechaza con un mensaje explícito.
2. PostgREST no exponía el schema `api` — **tampoco en local**. Grupos pequeños, cobertura y
   matriz de asistencia y delete-impact respondían 400. Se arregla en `supabase/config.toml`
   (requiere `supabase stop && supabase start`).
3. El barrido multi-tenant pedía `status < 500`, así que un endpoint roto que devolvía 400 pasaba
   el test **sin haberse ejercitado nunca**: así es como el punto 2 estuvo oculto. Los listados
   ahora exigen 200 y los recursos ajenos 200/403/404.

De paso, dos not-found con el código equivocado: `delete-impact` daba 500 (el SP levanta P0001) y
`observations` daba 400 por usar `.single()`. Los dos pasan a 404. Quedan otros cuatro `.single()`
con el mismo patrón en `observationsController`, sin tocar.

Único paso manual: si `ccdt` es un repo privado, hay que crear en `ccdt-Back` el secret
`CCDT_FRONT_TOKEN` con un PAT de lectura. Si es público, el token del workflow alcanza.

Que el proyecto de Supabase viva en el repo del front y lo necesite el del back es una costura
incómoda. La alternativa (mover `supabase/` a ccdt-Back, que es el dueño de la DB según su
CLAUDE.md) queda anotada, no hecha.

Verificado tras los cambios: CI verde en los dos repos — back 23 unit + 44 integración (1 todo),
front 52/52,
`npx eslint` limpio en los archivos nuevos, `npm run build` OK.
