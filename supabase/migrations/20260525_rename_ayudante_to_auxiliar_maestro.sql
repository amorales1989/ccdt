-- Renombrar rol 'ayudante' -> 'auxiliar_maestro'
-- El rol ahora tiene acceso al sistema (login), puede tomar asistencia
-- y agregar miembros limitado a su departamento/clase (igual que maestro).

-- 1. Renombrar el valor del enum (actualiza automaticamente profiles.role y demas columnas)
ALTER TYPE app_role RENAME VALUE 'ayudante' TO 'auxiliar_maestro';

-- 2. Migrar overrides de permisos guardados por empresa (JSON key)
UPDATE companies
SET role_permissions =
  (role_permissions - 'ayudante')
  || jsonb_build_object('auxiliar_maestro', role_permissions->'ayudante')
WHERE role_permissions ? 'ayudante';

-- 3. Migrar el rol dentro de los assignments en metadata de usuarios existentes
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  raw_user_meta_data,
  '{assignments}',
  (
    SELECT jsonb_agg(
      CASE WHEN elem->>'role' = 'ayudante'
           THEN jsonb_set(elem, '{role}', '"auxiliar_maestro"')
           ELSE elem END
    )
    FROM jsonb_array_elements(raw_user_meta_data->'assignments') elem
  )
)
WHERE raw_user_meta_data->'assignments' @> '[{"role":"ayudante"}]';
