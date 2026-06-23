# Reglas para Claude Code — Ahorra Tokens

## 1. No programar sin contexto
- ANTES de escribir codigo: lee los archivos relevantes, revisa git log, entiende la arquitectura.
- Si no tienes contexto suficiente, pregunta. No asumas.

## 2. Respuestas cortas
- Responde en 1-3 oraciones. Sin preambulos, sin resumen final.
- No repitas lo que el usuario dijo. No expliques lo obvio.
- Codigo habla por si mismo: no narres cada linea que escribes.

## 3. No reescribir archivos completos
- Usa Edit (reemplazo parcial), NUNCA Write para archivos existentes salvo que el cambio sea >80% del archivo.
- Cambia solo lo necesario. No "limpies" codigo alrededor del cambio.

## 4. No releer archivos ya leidos
- Si ya leiste un archivo en esta conversacion, no lo vuelvas a leer salvo que haya cambiado.
- Toma notas mentales de lo importante en tu primera lectura.

## 5. Validar antes de declarar hecho
- Despues de un cambio: compila, corre tests, o verifica que funciona.
- Nunca digas "listo" sin evidencia de que funciona.

## 6. Cero charla aduladora
- No digas "Excelente pregunta", "Gran idea", "Perfecto", etc.
- No halagues al usuario. Ve directo al trabajo.

## 7. Soluciones simples
- Implementa lo minimo que resuelve el problema. Nada mas.
- No agregues abstracciones, helpers, tipos, validaciones, ni features que no se pidieron.
- 3 lineas repetidas > 1 abstraccion prematura.

## 8. No pelear con el usuario
- Si el usuario dice "hazlo asi", hazlo asi. No debatas salvo riesgo real de seguridad o perdida de datos.
- Si discrepas, menciona tu concern en 1 oracion y procede con lo que pidio.

## 9. Leer solo lo necesario
- No leas archivos completos si solo necesitas una seccion. Usa offset y limit.
- Si sabes la ruta exacta, usa Read directo. No hagas Glob + Grep + Read cuando Read basta.

## 10. No narrar el plan antes de ejecutar
- No digas "Voy a leer el archivo, luego modificar la funcion, luego compilar...". Solo hazlo.
- El usuario ve tus tool calls. No necesita un preview en texto.

## 11. Paralelizar tool calls
- Si necesitas leer 3 archivos independientes, lee los 3 en un solo mensaje, no uno por uno.
- Menos roundtrips = menos tokens de contexto acumulado.

## 12. No duplicar codigo en la respuesta
- Si ya editaste un archivo, no copies el resultado en tu respuesta. El usuario lo ve en el diff.
- Si creaste un archivo, no lo muestres entero en texto tambien.

## 13. No usar Agent cuando Grep/Read basta
- Agent duplica todo el contexto en un subproceso. Solo usalo para busquedas amplias o tareas complejas.
- Para buscar una funcion o archivo especifico, usa Grep o Glob directo.

---

# Estandares de Desarrollo — Frontend (ccdt)

## 14. Las APIs viven en ccdt-back, no en el front
- TODA logica de negocio, escritura de datos y operaciones sensibles van por el API Express de `ccdt-back` (vía `src/lib/api.ts` con axios + token Bearer).
- NO agregar nuevas funciones serverless en `api/` ni nuevos `supabase.from()` directos para crear/editar/borrar. Si necesitas un endpoint nuevo, créalo en ccdt-back.
- `supabase.from()` directo desde el browser SOLO se permite para lecturas no sensibles ya existentes que dependen 100% de RLS. Toda escritura nueva = endpoint en el back.
- Al tocar codigo que hace `supabase.from()` directo para mutaciones, migrarlo al API si es de bajo riesgo; si no, dejar comentario `// TODO: mover a API back`.

## 15. Auth y multi-tenant
- Nunca confiar en `company_id` del cliente como fuente de verdad: el back lo deriva del perfil. El front solo lo manda como header `x-company-id` por conveniencia.
- No exponer la `service_key` de Supabase en el front jamas. El front solo usa `VITE_SUPABASE_ANON_KEY`.
- Toda llamada al API debe incluir el token Bearer; si un endpoint nuevo no lo requiere, justificarlo.

## 16. Seguridad en el front
- Nunca hardcodear secrets, URLs de servicio con keys, ni tokens. Usar `import.meta.env.VITE_*`.
- Sanitizar/escapar cualquier HTML que venga de datos de usuario. No usar `dangerouslySetInnerHTML` sin sanitizar.
- Validar inputs en el form (zod/react-hook-form ya está disponible) ademas de en el back.
- No loguear datos personales (DNI, telefonos, tokens) en `console.log` en codigo que va a prod.

## 17. Tests antes de declarar hecho (regla 5 reforzada)
- Cambios de UI: correr `npm run lint` y verificar el build (`npm run build`) sin errores de TS.
- Cambios de logica en `src/lib/`: agregar/actualizar test (Vitest). Si no hay setup de tests aun, crearlo minimalista antes de la primera funcion critica.
- Flujos criticos (login, asistencia, autorizaciones): verificar manualmente o con Playwright MCP antes de cerrar.

## 18. Consistencia visual y componentes
- Reusar componentes de `src/components/ui` (shadcn). No crear botones/inputs custom si existe el de la libreria.
- No mezclar MUI y shadcn para el mismo proposito en una misma vista sin razon; preferir el que ya domina la pantalla.
