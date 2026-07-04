# Plan de Integración de Pagos (Fase 2)

## Contexto y estado actual (ya implementado)
- `companies`: `is_active`, `plan`, `extra_member_packs`.
- `authMiddleware` bloquea empresas inactivas (403 `COMPANY_INACTIVE`); modal de suspensión en login (admin/secretaria) y mensaje para el resto.
- Enforcement de límite de miembros en `studentsController.create` (403 `MEMBER_LIMIT_REACHED`).
- Panel super admin (`AdminSistema.tsx`): CRUD empresas, plan, packs, columnas "Último pago"/"Próx. vto" (placeholder).
- Banner de aviso al 90% del límite; pestaña "Plan" en Configuración.
- Catálogo de planes: `src/lib/plans.ts` (front) + `src/config/plans.js` (back), `PACK_SIZE=25`.

## Principio rector
La **base de datos es la fuente de verdad** del acceso (`is_active` / `due_date`). Mercado Pago solo
dispara cambios vía **webhook**. Siempre hay un camino **manual/transferencia** en paralelo.
`is_active`/`due_date` solo cambian por webhook o por el super admin, nunca desde el front.

## Reglas de negocio definidas
- **Anual = 2 meses gratis**: `price_yearly = price_monthly × 10`. Idem packs anuales.
- **Prorrateo de packs a mitad de ciclo**:
  ```
  dias_restantes = due_date − hoy
  dias_del_ciclo = 30 (mensual) | 365 (anual)
  cargo_pack = pack_price × (dias_restantes / dias_del_ciclo)
  ```
  Se cobra como pago único; al confirmarse, `extra_member_packs++` (capacidad inmediata) y se
  actualiza el monto recurrente para el próximo débito.
- **Downgrade de packs**: aplica al próximo ciclo; nunca por debajo de `member_count`.
- **Self-service de packs**: el admin de la empresa compra packs desde su panel (disparado por el
  banner de límite). Capacidad se habilita al confirmar el pago, no al hacer click.

---

## FASE A — Base de pagos (SIN Mercado Pago, sin precios) → implementar YA
Testable de punta a punta con pagos manuales. No requiere credenciales MP ni precios finales
(el monto lo ingresa el super admin).

### Datos (migración)
Agregar a `companies`:
- `billing_cycle text NOT NULL DEFAULT 'mensual'` (mensual|anual)
- `last_payment_date date`
- `due_date date`  (próximo vencimiento = "paid until")

Nueva tabla `payments`:
- `id`, `company_id`, `amount numeric`, `currency text default 'ARS'`,
  `billing_cycle text`, `period_start date`, `period_end date`,
  `source text` (manual|transferencia|mp_link|mp_subscription),
  `notes text`, `created_at timestamptz default now()`.

### Backend (ccdt-back, controller/route system)
- `POST /api/system/companies/:id/payments` (super admin): body `{ amount, billing_cycle, source, notes? }`.
  - `last_payment_date = hoy`; `due_date = hoy + 1 mes` (mensual) o `+ 1 año` (anual).
  - `is_active = true`; inserta fila en `payments` (period_start=hoy, period_end=due_date).
- `GET /api/system/companies/:id/payments` (super admin): historial.
- `listCompanies`: incluir `billing_cycle, last_payment_date, due_date` en el select y en la respuesta.
- Job diario de vencimiento (patrón `birthdayService`): `due_date < hoy` → `is_active = false`.
  (Alternativa MVP: endpoint `POST /api/system/run-expiration` que el super admin/cron dispara.)

### Frontend (ccdt)
- `AdminSistema.tsx`:
  - Acción "Registrar pago" por empresa (dialog: monto, ciclo mensual/anual, método, nota).
  - Las columnas "Último pago"/"Próx. vto" se llenan con datos reales.
  - Historial de pagos por empresa (dialog o vista).
- `Configuration.tsx` (pestaña Plan): mostrar estado de suscripción
  (Al día / Por vencer / Vencido), próximo vencimiento y ciclo.
- `api.ts`: `recordPayment(id, data)`, `getCompanyPayments(id)`; extender `AdminCompany`.

### Verificación Fase A
- Migración corrida. tsc + build front OK. Back carga OK.
- Registrar pago → due_date/last_payment_date actualizados, is_active=true, fila en payments.
- Forzar due_date pasado → job/endpoint deja is_active=false → login muestra modal de suspensión.

---

## FASE B — Mercado Pago + self-service (requiere credenciales MP + precios finales)
### Precios (a definir por el cliente, en ARS)
- `plans`: `price_monthly` por plan (`price_yearly = ×10`), `pack_price_monthly` (`pack_yearly = ×10`).
- Mover precios a tabla `plans` en DB (editables sin redeploy) o mantener en catálogo de código.

### Backend
- `mercadopagoService`: crear link de pago (preference) y suscripción (preapproval);
  consultar pago. `MP_ACCESS_TOKEN` en env (nunca en front). `MP_WEBHOOK_SECRET` en env.
- Webhook público `POST /api/webhooks/mercadopago` (ANTES de authMiddleware): valida firma,
  **idempotente**. Pago aprobado → inserta en `payments`, extiende `due_date`, `is_active=true`
  (y para packs: `extra_member_packs++`).
- Empresa: `POST /api/subscription/pay` (link/suscripción), `GET /api/subscription` (estado).
- Packs self-service con **prorrateo**: `GET /api/subscription/pack-quote` (calcula cargo prorrateado)
  y flujo de pago único MP; al confirmar, incrementa packs y actualiza monto de la suscripción.

### Frontend
- Configuración (empresa): botón "Pagar" (link/suscripción MP + datos de transferencia),
  historial de pagos propios, comprobantes.
- Banner de límite y modal de suspensión: botón "Pagar ahora" → link MP.
- Botón "Agregar pack" con quote prorrateado antes de pagar.

### Seguridad
- Webhook con firma + idempotencia. Token MP solo en back. Entitlement solo por webhook o super admin.

### Orden de ejecución global
1. Fase A (migración → back → front → verificación).
2. Fase B en **sandbox** MP (link → webhook → transferencia manual → recién después preapproval).
3. Deploy back + front juntos + correr migraciones en prod.

### Recomendación de arranque de Fase B
MVP: **link de pago MP + transferencia manual** (cubre a todo el público). Suscripción automática
(preapproval) y self-service de packs con prorrateo en una segunda vuelta.

---

## FASE B — Decisiones tomadas (implementación)
- **Integración MP vía API REST con `fetch`** (sin dependencia npm). Env: `MP_ACCESS_TOKEN`,
  `MP_WEBHOOK_SECRET`, `API_PUBLIC_URL` (notification_url), `APP_PUBLIC_URL` (back_urls).
- **Precios en DB** (tabla `plans`), editables por el super admin en el panel (seed en 0).
  Columnas: `value` (pk), `label`, `member_limit` (null=ilimitado), `price_monthly`,
  `pack_price_monthly`, `sort`. Anual = ×10.
- **Cambios de plan/packs: self-service directo** (sin aprobación del super admin).
  - Upgrade de plan / sumar packs → **cargo prorrateado** vía MP; se aplica al confirmar el webhook.
  - Downgrade de plan / restar packs → **al próximo ciclo** (columnas `pending_plan`,
    `pending_extra_member_packs`); el precio se recalcula al renovar. Nunca dejar la capacidad por
    debajo de `member_count`.
- **Webhook** `/api/webhooks/mercadopago` (público, valida `MP_WEBHOOK_SECRET`, idempotente por
  `mp_payment_id`): al aprobarse, aplica el cambio codificado en `external_reference`/metadata,
  inserta en `payments`, extiende `due_date` y aplica `pending_*` en la renovación.

### Paso 1 (fundaciones): plans+precios en DB, edición super admin, servicio MP, webhook, renovación self-pay. ✅
### Paso 2 (self-service): change-plan y packs (+/-) con prorrateo en Configuración/Plan. ✅

### Paso 3 (suscripción automática — Preapproval): OPCIÓN PRINCIPAL al contratar.
- **Suscribirse** = crear un `preapproval` de MP (débito recurrente). Monto recurrente =
  `cyclePrice(plan) + packs × cyclePrice(pack)`. Frecuencia: mensual = 1 mes, anual = 12 meses
  (monto anual = ×10). El pagador autoriza en el `init_point`; se guarda `mp_preapproval_id`.
- **Agregar pack**: se cobra el **prorrateo one-off** ahora (Paso 2) y, al aplicarse, se **actualiza
  el monto del preapproval** (PUT) → el próximo débito ya incluye el pack.
- **Cambiar plan**: upgrade → prorrateo one-off + update del monto del preapproval; downgrade →
  update del monto (menor) que aplica en el próximo débito + cambio de capacidad al renovar.
- **Webhooks**: `subscription_preapproval` (estado de la suscripción) y
  `subscription_authorized_payment` (cada cobro recurrente → extiende `due_date`, inserta payment,
  aplica pendientes, `is_active=true`).
- El pago único / transferencia queda como opción secundaria (para quien no usa tarjeta).
- REQUIERE validación en sandbox MP con tarjeta de prueba (flujo de autorización del pagador).
