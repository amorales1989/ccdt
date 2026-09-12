---
name: test-pantalla
description: Prueba E2E exploratoria de UNA pantalla de ccdt con Playwright MCP, en PC (1440x900) y móvil (360x780). Recorre todos los controles, detecta bugs funcionales, errores de consola/red y errores visuales (overflow, solapamientos, texto cortado, botones chicos). Usar cuando el usuario diga "testea/probá la pantalla X".
argument-hint: <nombre de pantalla o ruta> (ej. "TomarAsistencia", "historial", "/autorizaciones/simple")
allowed-tools: Read, Bash, mcp__playwright__browser_navigate, mcp__playwright__browser_snapshot, mcp__playwright__browser_click, mcp__playwright__browser_type, mcp__playwright__browser_fill_form, mcp__playwright__browser_select_option, mcp__playwright__browser_press_key, mcp__playwright__browser_hover, mcp__playwright__browser_resize, mcp__playwright__browser_evaluate, mcp__playwright__browser_console_messages, mcp__playwright__browser_network_requests, mcp__playwright__browser_take_screenshot, mcp__playwright__browser_wait_for, mcp__playwright__browser_handle_dialog, mcp__playwright__browser_navigate_back, mcp__playwright__browser_close
---

# Test de pantalla: $ARGUMENTS

Objetivo: encontrar bugs y errores visuales en la pantalla indicada, en PC y móvil. NO arreglar nada: solo reportar.

## 1. Resolver la pantalla

- Buscar en `src/App.tsx` la ruta que corresponde a `$ARGUMENTS` (acepta nombre del componente en `src/pages/`, ruta, o nombre aproximado en español: "asistencia" → `/asistencia`).
  `grep -n "path:" -A1 src/App.tsx` + `grep -n "@/pages/" src/App.tsx`.
- Si hay ambigüedad (varias coincidencias) o no existe, preguntar al usuario y parar.
- Leer el componente de la página (solo lo necesario: JSX de controles, dialogs, tabs, condiciones de rol) para saber QUÉ hay que probar. Anotar la lista de interacciones esperadas.
- Revisar `src/lib/rolePermissions.ts` si la pantalla depende de permisos: el usuario de prueba puede no verla.

## 2. Precondiciones

1. Servicios arriba: `ss -ltnp | grep -E ":(8080|3001|54321) "`. Front en `http://localhost:8080`. Si el front no responde, pedir al usuario que corra `./dev-start.sh` y parar.
2. Detectar entorno de datos:
   `grep -E "^VITE_SUPABASE_URL" .env.development.local .env.local .env 2>/dev/null` (gana el primero que exista, en ese orden).
   - Si apunta a `127.0.0.1`/`localhost` → **modo LOCAL**: se permiten acciones que escriben datos.
   - Si apunta a `*.supabase.co` → **modo PROD (solo lectura)**: avisarlo al inicio del reporte.
3. Credenciales: leer `.claude/test-credentials.local` (gitignoreado) con formato:
   ```
   EMAIL=...
   PASSWORD=...
   COMPANY_ID=1
   ```
   Si no existe, pedírselas al usuario. NUNCA escribir la contraseña en el reporte ni en consola.

## 3. Reglas de seguridad (obligatorias)

- **Modo PROD**: prohibido confirmar acciones que crean/editan/borran/envían (Guardar, Crear, Agregar, Eliminar, Borrar, Archivar, Promover, Enviar, Notificar, WhatsApp, Subir archivo, Confirmar asistencia, Aprobar/Rechazar). Se puede abrir el formulario/dialog, validar campos vacíos/invalidos, y luego **Cancelar/cerrar**.
- **Modo LOCAL**: se pueden confirmar, usando datos obviamente de prueba (prefijo `TEST_`). Borrar solo lo que el propio test creó.
- Nunca cerrar sesión de otros usuarios, cambiar contraseñas, ni tocar configuración de la company.
- Si un click abre un `confirm()`/`alert()` nativo en modo PROD → `browser_handle_dialog` con `accept: false`.

## 4. Login

1. `browser_navigate` a `http://localhost:8080/login?companyId=<COMPANY_ID>`.
2. `browser_snapshot`, completar email/password con `browser_fill_form`, enviar.
3. Esperar a salir de `/login` (`browser_wait_for`). Si aparecen modales iniciales (tour, alerta de DNI faltante, novedades), cerrarlos y anotarlos.
4. Si el login falla → reportar y parar.

## 5. Ciclo de prueba (repetir para cada viewport)

Viewports, en este orden:
- **PC**: `browser_resize` 1440 x 900
- **Móvil**: `browser_resize` 360 x 780 (breakpoint de la app: `< 768px` = móvil, ver `src/hooks/use-mobile.tsx`)

Para cada viewport:

### 5.1 Carga
- `browser_navigate` a la ruta. Esperar a que desaparezcan loaders/skeletons (`browser_wait_for` con `textGone: "Cargando"` o el texto que use la pantalla).
- `browser_take_screenshot` con `fullPage: true`, nombre `<pantalla>-<pc|movil>-inicial.png`.
- `browser_console_messages` (nivel error y warning) y `browser_network_requests`: anotar respuestas 4xx/5xx y requests fallidos.

### 5.2 Auditoría visual automática
Ejecutar `browser_evaluate` con esta función y anotar lo que devuelva:

```js
() => {
  const vw = window.innerWidth, out = { viewport: vw, overflowX: null, fueraDeViewport: [], textoCortado: [], solapados: [], tapChicos: [], imgRotas: [], sinLabel: [] };
  const desc = (el) => {
    const t = (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '').trim().slice(0, 40);
    return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${t ? ` "${t}"` : ''}`;
  };
  const visible = (el) => { const r = el.getBoundingClientRect(), s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const sw = document.documentElement.scrollWidth;
  if (sw > vw + 1) out.overflowX = `scrollWidth ${sw}px > viewport ${vw}px`;
  const all = [...document.body.querySelectorAll('*')].filter(visible);
  for (const el of all) {
    const r = el.getBoundingClientRect();
    const conContenido = el.matches('button, a, input, select, textarea, img, [role]') || [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (conContenido && (r.right > vw + 1 || r.left < -1) && !el.closest('[data-radix-scroll-area-viewport], .overflow-x-auto, .overflow-auto, .overflow-x-scroll, table')) out.fueraDeViewport.push(`${desc(el)} [${Math.round(r.left)}→${Math.round(r.right)}]`);
    const s = getComputedStyle(el);
    if (el.children.length === 0 && el.innerText?.trim() && (el.scrollWidth > el.clientWidth + 1) && s.overflow !== 'visible' && s.textOverflow !== 'ellipsis') out.textoCortado.push(desc(el));
  }
  const interactivos = [...document.querySelectorAll('button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="checkbox"], [role="combobox"]')].filter(visible);
  if (vw < 768) for (const el of interactivos) { const r = el.getBoundingClientRect(); if (r.width < 32 || r.height < 32) out.tapChicos.push(`${desc(el)} ${Math.round(r.width)}x${Math.round(r.height)}`); }
  for (let i = 0; i < interactivos.length; i++) for (let j = i + 1; j < interactivos.length; j++) {
    const a = interactivos[i], b = interactivos[j];
    if (a.contains(b) || b.contains(a)) continue;
    const abs = (el, otro) => getComputedStyle(el).position === 'absolute' && el.parentElement?.contains(otro);
    if (abs(a, b) || abs(b, a)) continue; // iconos superpuestos a propósito (ej. ojo del password)
    const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect();
    const ix = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left), iy = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
    if (ix > 4 && iy > 4) out.solapados.push(`${desc(a)} ⟷ ${desc(b)}`);
  }
  for (const img of document.querySelectorAll('img')) if (img.complete && img.naturalWidth === 0 && visible(img)) out.imgRotas.push(img.getAttribute('src')?.slice(0, 80));
  for (const el of document.querySelectorAll('input:not([type=hidden]), select, textarea')) {
    if (!visible(el)) continue;
    const ok = el.getAttribute('aria-label') || el.getAttribute('placeholder') || (el.id && document.querySelector(`label[for="${el.id}"]`)) || el.closest('label');
    if (!ok) out.sinLabel.push(desc(el));
  }
  for (const k of Object.keys(out)) if (Array.isArray(out[k])) out[k] = out[k].slice(0, 15);
  return out;
}
```

Los resultados son candidatos: confirmar con screenshot/snapshot antes de reportarlos como bug (ej. un carrusel horizontal intencional no es bug).

### 5.3 Recorrido interactivo
Con `browser_snapshot` como guía, probar TODO lo interactivo de la pantalla (según la lista del paso 1):
- **Navegación interna**: tabs, acordeones, paginación, "ver más", links internos (volver atrás después).
- **Filtros y búsqueda**: cada select/combobox con al menos 2 opciones; búsqueda con texto que existe, texto que no existe (`zzzz`), y vacío. Verificar estado vacío ("sin resultados") y que limpiar filtros restaura la lista.
- **Formularios**: enviar vacío (deben aparecer validaciones), valores inválidos (email mal, fecha futura/pasada absurda, texto de 300 caracteres, caracteres especiales `<b>á'"`), y en modo LOCAL un envío válido.
- **Dialogs/Sheets/Dropdowns**: abrir, verificar que se ven completos en el viewport (en móvil que no queden cortados ni tapados por la barra inferior/teclado), cerrar con X, con Escape y clickeando afuera.
- **Tablas/listas**: scroll horizontal en móvil, ordenamiento si existe, acciones por fila (en PROD solo abrir, no confirmar).
- **Menú/sidebar en móvil**: abrir y cerrar el menú, verificar que no tape contenido de forma permanente.
- **Doble click** en botones de acción principal: detectar envíos duplicados (en LOCAL) o botones que no se deshabilitan mientras cargan.
- **Recarga** (`browser_navigate` a la misma URL): el estado/filtros no deben romper la pantalla.

Después de cada interacción relevante: si algo se ve raro → `browser_take_screenshot` (`<pantalla>-<viewport>-<paso>.png`); revisar `browser_console_messages` periódicamente (errores nuevos = bug). Re-ejecutar la auditoría 5.2 con dialogs abiertos y en estados distintos (lista vacía, lista con datos, formulario con errores).

## 6. Cierre

- `browser_close`.
- Borrar snapshots `.yml`/logs que haya dejado Playwright MCP: `rm -f .playwright-mcp/*.yml .playwright-mcp/*.log`. Dejar los `.png` del test.

## 7. Reporte (en la respuesta, en español)

```
## Test: <Pantalla> (<ruta>) — modo LOCAL|PROD (solo lectura)
Usuario: <email> | Rol: <rol> | Fecha: <fecha>

### 🔴 Críticos (rompen la tarea)
- [PC|Móvil|Ambos] Descripción concreta. Pasos: 1… 2… Esperado vs obtenido. Evidencia: <screenshot>/<error de consola>. Probable origen: [archivo.tsx:línea](src/...)

### 🟠 Mayores (funciona pero mal)
### 🟡 Visuales / menores
### ⚪ No probado
- Qué quedó sin probar y por qué (modo PROD, permisos del rol, datos faltantes).

### Resumen
N críticos, N mayores, N menores | Consola: N errores | Red: N requests fallidos
```

Reglas del reporte:
- Solo bugs confirmados; nada de sugerencias de diseño genéricas.
- Cada bug con viewport, pasos para reproducir y, si se puede ubicar, archivo y línea en el código.
- No incluir datos personales (DNI, teléfonos) ni credenciales en el reporte.
