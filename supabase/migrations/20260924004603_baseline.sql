

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "api";


ALTER SCHEMA "api" OWNER TO "postgres";


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."app_role" AS ENUM (
    'admin',
    'lider',
    'director',
    'maestro',
    'secretaria',
    'secr.-calendario',
    'colaborador',
    'director_general',
    'vicedirector',
    'conserje',
    'auxiliar_maestro',
    'system_admin',
    'miembro'
);


ALTER TYPE "public"."app_role" OWNER TO "postgres";


CREATE TYPE "public"."department_type" AS ENUM (
    'escuelita_central',
    'pre_adolescentes',
    'adolescentes',
    'jovenes',
    'jovenes_adultos',
    'adultos'
);


ALTER TYPE "public"."department_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."asistencia_cobertura"("p_company_id" integer, "p_fecha" "text" DEFAULT NULL::"text", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_department_names" "text"[] DEFAULT NULL::"text"[]) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH deps AS MATERIALIZED (
  SELECT d.id, d.name, d.classes, d.activity_days
    FROM departments d
   WHERE d.company_id = p_company_id
     AND (p_department_id IS NULL OR d.id = p_department_id)
     AND (p_department_names IS NULL
          OR lower(d.name) = ANY (SELECT lower(x) FROM unnest(p_department_names) x))
),
dias AS (
  SELECT DISTINCT unnest(activity_days) AS dia FROM deps
),
fecha AS (
  -- Sin fecha explícita: se retrocede hasta 6 días buscando un día de actividad. Si ningún
  -- departamento tiene activity_days configurado, la condición deja pasar los 7 y gana hoy.
  SELECT COALESCE(
    p_fecha,
    (SELECT to_char(x.d, 'YYYY-MM-DD')
       FROM (SELECT ((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - i) AS d
               FROM generate_series(0, 6) i) x
      WHERE NOT EXISTS (SELECT 1 FROM dias)
         OR EXTRACT(DOW FROM x.d)::smallint IN (SELECT dia FROM dias)
      ORDER BY x.d DESC
      LIMIT 1),
    to_char((now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date, 'YYYY-MM-DD')
  ) AS f
),

roster AS MATERIALIZED (
  SELECT DISTINCT dept_id, cls, student_id FROM (
    SELECT s.department_id AS dept_id, btrim(lower(s.assigned_class)) AS cls, s.id AS student_id
      FROM students s
     WHERE s.company_id = p_company_id
       AND s.deleted_at IS NULL
       AND s.department_id IN (SELECT id FROM deps)
    UNION ALL
    SELECT sd.department_id, btrim(lower(sd.assigned_class)), sd.student_id
      FROM student_departments sd
      JOIN students s2 ON s2.id = sd.student_id AND s2.deleted_at IS NULL
     WHERE sd.company_id = p_company_id
       AND sd.department_id IN (SELECT id FROM deps)
  ) u
  WHERE dept_id IS NOT NULL AND cls IS NOT NULL AND cls <> '' AND student_id IS NOT NULL
),
padron AS (
  SELECT dept_id, cls, count(*)::int AS total FROM roster GROUP BY dept_id, cls
),

tomada AS (
  SELECT a.department_id AS dept_id,
         btrim(lower(a.assigned_class)) AS cls,
         count(*)::int                        AS total,
         count(*) FILTER (WHERE a.status)::int AS presentes
    FROM attendance a, fecha
   WHERE a.company_id = p_company_id
     AND a.date = fecha.f
     AND a.department_id IN (SELECT id FROM deps)
   GROUP BY 1, 2
),

eventos AS (
  SELECT e.department_id AS dept_id,
         btrim(lower(e.assigned_class)) AS cls, -- NULL = todo el departamento
         e.title
    FROM class_events e, fecha
   WHERE e.company_id = p_company_id
     AND e.date = fecha.f
     AND e.department_id IN (SELECT id FROM deps)
),

clases AS (
  SELECT d.id AS dept_id, d.name, u.label, u.ord,
         p.total                                        AS total,
         (t.dept_id IS NOT NULL OR ev.title IS NOT NULL) AS tomada,
         COALESCE(t.presentes, 0)                       AS presentes,
         (t.dept_id IS NULL AND ev.title IS NOT NULL)   AS sin_clase,
         ev.title                                       AS motivo
    FROM deps d
    CROSS JOIN LATERAL unnest(COALESCE(d.classes, '{}'::text[])) WITH ORDINALITY u(label, ord)
    JOIN padron p ON p.dept_id = d.id AND p.cls = btrim(lower(u.label)) AND p.total > 0
    LEFT JOIN tomada t ON t.dept_id = d.id AND t.cls = btrim(lower(u.label))
    LEFT JOIN LATERAL (
      SELECT e.title
        FROM eventos e
       WHERE e.dept_id = d.id
         AND (e.cls IS NULL OR e.cls = btrim(lower(u.label)))
       ORDER BY (e.cls IS NULL) -- el evento de la clase puntual gana sobre el de todo el depto
       LIMIT 1
    ) ev ON true
)

SELECT jsonb_build_object(
  'date', (SELECT f FROM fecha),
  'departments', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
             'department_id', d.id,
             'name',          d.name,
             'total_clases',  (SELECT count(*) FROM clases c WHERE c.dept_id = d.id),
             'tomadas',       (SELECT count(*) FROM clases c WHERE c.dept_id = d.id AND c.tomada),
             'classes',       COALESCE((
                                SELECT jsonb_agg(jsonb_build_object(
                                         'clase',     c.label,
                                         'tomada',    c.tomada,
                                         'presentes', c.presentes,
                                         'total',     c.total,
                                         'sin_clase', c.sin_clase,
                                         'motivo',    c.motivo
                                       ) ORDER BY c.ord)
                                  FROM clases c WHERE c.dept_id = d.id
                              ), '[]'::jsonb)
           ) ORDER BY d.name)
      FROM deps d
  ), '[]'::jsonb)
);
$$;


ALTER FUNCTION "api"."asistencia_cobertura"("p_company_id" integer, "p_fecha" "text", "p_department_id" "uuid", "p_department_names" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."asistencia_eventos_listar"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_department_names" "text"[] DEFAULT NULL::"text"[], "p_assigned_class" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
SELECT COALESCE(jsonb_agg(x ORDER BY x->>'date', x->>'title'), '[]'::jsonb)
FROM (
  SELECT jsonb_build_object(
           'id',             e.id,
           'date',           e.date,
           'title',          e.title,
           'description',    e.description,
           'color',          e.color,
           'department_id',  e.department_id,
           'department',     d.name,
           'assigned_class', e.assigned_class,
           'created_by',     e.created_by,
           'created_at',     e.created_at
         ) AS x
    FROM class_events e
    JOIN departments d ON d.id = e.department_id
   WHERE e.company_id = p_company_id
     AND e.date >= p_start
     AND e.date <= p_end
     AND (p_department_id IS NULL OR e.department_id = p_department_id)
     AND (p_department_names IS NULL
          OR lower(d.name) = ANY (SELECT lower(v) FROM unnest(p_department_names) v))
     -- assigned_class NULL en el evento = todo el departamento.
     AND (p_assigned_class IS NULL
          OR e.assigned_class IS NULL
          OR e.assigned_class ILIKE p_assigned_class)
) s;
$$;


ALTER FUNCTION "api"."asistencia_eventos_listar"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."asistencia_matriz"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_department_names" "text"[] DEFAULT NULL::"text"[], "p_assigned_class" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH att AS (
  -- bool_or: si un alumno tiene más de un registro el mismo día (ej. dos deptos), cuenta como presente.
  SELECT a.student_id, a.date, bool_or(a.status) AS status
  FROM attendance a
  -- attendance.department (texto) esta NULL en toda la tabla: el departamento se resuelve por
  -- department_id, con fallback al departamento primario del alumno (igual que hacia el front).
  LEFT JOIN departments dep ON dep.id = a.department_id
  LEFT JOIN students s ON s.id = a.student_id
  LEFT JOIN departments sdep ON sdep.id = s.department_id
  WHERE a.company_id = p_company_id
    AND a.student_id IS NOT NULL
    AND a.date >= p_start
    AND a.date <= p_end
    AND (p_department_id IS NULL OR a.department_id = p_department_id)
    AND (
      p_department_names IS NULL
      OR lower(COALESCE(dep.name, sdep.name, a.department))
         = ANY (SELECT lower(x) FROM unnest(p_department_names) x)
    )
    AND (p_assigned_class IS NULL OR a.assigned_class ILIKE p_assigned_class)
  GROUP BY a.student_id, a.date
),
ev AS (
  -- Días especiales del mismo scope. assigned_class NULL en el evento = todo el departamento.
  SELECT e.id, e.date, e.title, e.description, e.color,
         e.department_id, dp.name AS department, e.assigned_class
  FROM class_events e
  JOIN departments dp ON dp.id = e.department_id
  WHERE e.company_id = p_company_id
    AND e.date >= p_start
    AND e.date <= p_end
    AND (p_department_id IS NULL OR e.department_id = p_department_id)
    AND (
      p_department_names IS NULL
      OR lower(dp.name) = ANY (SELECT lower(x) FROM unnest(p_department_names) x)
    )
    AND (p_assigned_class IS NULL
         OR e.assigned_class IS NULL
         OR e.assigned_class ILIKE p_assigned_class)
),
d AS (
  -- Fechas con actividad + fechas de eventos, numeradas: idx = posición dentro de `marks`.
  SELECT date, row_number() OVER (ORDER BY date)::int AS idx
  FROM (SELECT date FROM att UNION SELECT date FROM ev) x
),
n AS (SELECT count(*)::int AS total FROM d),
seq AS (
  -- Una fila por registro real (nada de cruzar alumnos × fechas: eso hacía nested loop
  -- sobre la CTE y el año entero se iba a statement timeout).
  SELECT a.student_id,
         d.idx,
         CASE WHEN a.status THEN 'P' ELSE 'A' END AS mark,
         d.idx - COALESCE(lag(d.idx) OVER (PARTITION BY a.student_id ORDER BY d.idx), 0) - 1 AS gap
  FROM att a
  JOIN d ON d.date = a.date
),
marks AS (
  -- Los huecos (fechas sin registro) se rellenan con el `gap` previo y el resto al final.
  SELECT student_id,
         string_agg(repeat('-', gap) || mark, '' ORDER BY idx)
           || repeat('-', (SELECT total FROM n) - max(idx)) AS marks,
         count(*) FILTER (WHERE mark = 'P') AS total
  FROM seq
  GROUP BY student_id
)
SELECT jsonb_build_object(
  'dates', COALESCE((SELECT jsonb_agg(date ORDER BY date) FROM d), '[]'::jsonb),
  'rows',  COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'student_id', student_id,
               'marks',      marks,
               'total',      total
             ))
             FROM marks
           ), '[]'::jsonb),
  'events', COALESCE((
             SELECT jsonb_agg(jsonb_build_object(
               'id',             id,
               'date',           date,
               'title',          title,
               'description',    description,
               'color',          color,
               'department_id',  department_id,
               'department',     department,
               'assigned_class', assigned_class
             ) ORDER BY date, title)
             FROM ev
           ), '[]'::jsonb)
);
$$;


ALTER FUNCTION "api"."asistencia_matriz"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."contabilidad_balance"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_assigned_class" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH tot AS (
  -- Una sola pasada por idx_accounting_tx_company_dept_date.
  SELECT COALESCE(sum(t.amount) FILTER (WHERE t.type = 'ingreso'), 0)  AS ingresos,
         COALESCE(sum(t.amount) FILTER (WHERE t.type <> 'ingreso'), 0) AS egresos
    FROM accounting_transactions t
   WHERE t.company_id = p_company_id
     AND t.department_id = p_department_id
     AND (p_from IS NULL OR t.movement_date >= p_from)
     AND (p_to   IS NULL OR t.movement_date <= p_to)
     AND (p_assigned_class IS NULL OR t.assigned_class = p_assigned_class)
),
ob AS (
  -- El saldo inicial se carga por departamento: filtrando por clase no se le puede atribuir
  -- a ninguna, así que el balance de la clase es solo ingresos - egresos.
  SELECT CASE WHEN p_assigned_class IS NOT NULL THEN 0
              ELSE COALESCE((SELECT b.opening_balance
                               FROM accounting_opening_balances b
                              WHERE b.company_id = p_company_id
                                AND b.department_id = p_department_id), 0)
         END AS opening
)
SELECT jsonb_build_object(
  'opening_balance', ob.opening,
  'total_ingresos',  tot.ingresos,
  'total_egresos',   tot.egresos,
  'balance',         ob.opening + tot.ingresos - tot.egresos
)
FROM tot, ob;
$$;


ALTER FUNCTION "api"."contabilidad_balance"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."contabilidad_por_motivo"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date" DEFAULT NULL::"date", "p_to" "date" DEFAULT NULL::"date", "p_assigned_class" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH agg AS (
  SELECT COALESCE(NULLIF(btrim(t.category), ''), 'Sin motivo') AS category,
         t.type,
         sum(t.amount) AS total,
         count(*)      AS cantidad
    FROM accounting_transactions t
   WHERE t.company_id = p_company_id
     AND t.department_id = p_department_id
     AND (p_from IS NULL OR t.movement_date >= p_from)
     AND (p_to   IS NULL OR t.movement_date <= p_to)
     AND (p_assigned_class IS NULL OR t.assigned_class = p_assigned_class)
   GROUP BY 1, 2
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'category', category,
      'type',     type,
      'total',    total,
      'cantidad', cantidad
    ) ORDER BY total DESC
  ),
  '[]'::jsonb
)
FROM agg;
$$;


ALTER FUNCTION "api"."contabilidad_por_motivo"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."departamento_eliminar"("p_company_id" integer, "p_department_id" "uuid", "p_dry_run" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_name          text;
  v_miembros      integer;
  v_reasignados   integer;
  v_sin_depto     integer;
  v_usuarios      integer;
BEGIN
  SELECT name INTO v_name
    FROM departments
   WHERE id = p_department_id AND company_id = p_company_id;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'Departamento no encontrado';
  END IF;

  -- Miembros cuyo departamento principal es el que se borra.
  SELECT count(*) INTO v_miembros
    FROM students s
   WHERE s.company_id = p_company_id AND s.department_id = p_department_id;

  -- De esos, los que tienen otra asignación a la que mudarse.
  SELECT count(*) INTO v_reasignados
    FROM students s
   WHERE s.company_id = p_company_id
     AND s.department_id = p_department_id
     AND EXISTS (SELECT 1 FROM student_departments sd
                  WHERE sd.student_id = s.id
                    AND sd.department_id <> p_department_id);

  v_sin_depto := v_miembros - v_reasignados;

  SELECT count(*) INTO v_usuarios
    FROM profiles p
   WHERE p.company_id = p_company_id AND p.department_id = p_department_id;

  IF NOT p_dry_run THEN
    -- 1. Los que tienen otra asignación se mudan a ella (la más antigua, criterio estable).
    UPDATE students s
       SET (department_id, assigned_class) = (
             SELECT sd.department_id, sd.assigned_class
               FROM student_departments sd
              WHERE sd.student_id = s.id
                AND sd.department_id <> p_department_id
              ORDER BY sd.created_at
              LIMIT 1
           )
     WHERE s.company_id = p_company_id
       AND s.department_id = p_department_id
       AND EXISTS (SELECT 1 FROM student_departments sd
                    WHERE sd.student_id = s.id
                      AND sd.department_id <> p_department_id);

    -- 2. El resto queda como miembro de la congregación sin departamento.
    UPDATE students
       SET department_id = NULL, assigned_class = NULL
     WHERE company_id = p_company_id
       AND department_id = p_department_id;

    -- 3. Usuarios asignados: se les quita el departamento (id y nombre en el array).
    UPDATE profiles
       SET department_id = NULL,
           departments = COALESCE(array_remove(departments, v_name), departments)
     WHERE company_id = p_company_id
       AND department_id = p_department_id;

    -- El nombre puede seguir en el array de usuarios que no lo tenían como principal.
    UPDATE profiles
       SET departments = array_remove(departments, v_name)
     WHERE company_id = p_company_id
       AND departments @> ARRAY[v_name];

    -- 4. student_departments cae por ON DELETE CASCADE.
    DELETE FROM departments
     WHERE id = p_department_id AND company_id = p_company_id;
  END IF;

  RETURN jsonb_build_object(
    'miembros', v_miembros,
    'miembros_reasignados', v_reasignados,
    'miembros_sin_departamento', v_sin_depto,
    'usuarios', v_usuarios,
    'eliminado', NOT p_dry_run
  );
END;
$$;


ALTER FUNCTION "api"."departamento_eliminar"("p_company_id" integer, "p_department_id" "uuid", "p_dry_run" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."estadisticas_resumen"("p_company_id" integer, "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_department_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_assigned_class" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH cfg AS (
  -- El front calcula los meses con la fecha local del navegador; fijamos el huso para que
  -- el corte de mes coincida y no se corra un mes durante la madrugada.
  SELECT (now() AT TIME ZONE 'America/Argentina/Buenos_Aires')::date AS today,
         NULLIF(p_assigned_class, 'all') AS cls
),

stud_dept AS MATERIALIZED (
  SELECT s.id, s.gender, s.birthdate, s.created_at, s.nuevo, s.assigned_class,
         -- Clases del alumno dentro del depto en foco (junction). El front mira dept_assignments.
         (SELECT array_agg(sd.assigned_class)
            FROM student_departments sd
           WHERE sd.student_id = s.id
             AND (p_department_id IS NULL OR sd.department_id = p_department_id)) AS sd_classes,
         -- ¿Tiene alguna inscripción? Si no, se cae al legacy students.assigned_class.
         EXISTS (SELECT 1 FROM student_departments sd2 WHERE sd2.student_id = s.id) AS has_assigns
    FROM students s
   WHERE s.company_id = p_company_id
     AND s.deleted_at IS NULL
     AND (
       CASE
         WHEN p_department_id IS NOT NULL THEN
           s.department_id = p_department_id
           OR EXISTS (SELECT 1 FROM student_departments sd3
                       WHERE sd3.student_id = s.id AND sd3.department_id = p_department_id)
         WHEN p_department_ids IS NOT NULL THEN
           s.department_id = ANY (p_department_ids)
           OR EXISTS (SELECT 1 FROM student_departments sd3
                       WHERE sd3.student_id = s.id AND sd3.department_id = ANY (p_department_ids))
         ELSE true
       END
     )
),

stud AS MATERIALIZED (
  SELECT sd.*,
         EXTRACT(YEAR FROM age((SELECT today FROM cfg), sd.birthdate))::int AS age
    FROM stud_dept sd, cfg
   WHERE cfg.cls IS NULL
      OR (CASE WHEN sd.has_assigns
               THEN cfg.cls = ANY (COALESCE(sd.sd_classes, '{}'::text[]))
               ELSE sd.assigned_class = cfg.cls END)
),

att_month AS MATERIALIZED (
  SELECT COALESCE(NULLIF(left(a.date, 7), ''),
                  to_char(a.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM')) AS month_key,
         count(*) FILTER (WHERE a.status)     AS present,
         count(*) FILTER (WHERE NOT a.status) AS absent
    FROM attendance a, cfg
   WHERE a.company_id = p_company_id
     AND (p_department_id IS NULL OR a.department_id = p_department_id)
     AND (p_department_id IS NOT NULL OR p_department_ids IS NULL
          OR a.department_id = ANY (p_department_ids))
     AND (cfg.cls IS NULL OR a.assigned_class = cfg.cls)
   GROUP BY 1
),
att_total AS (
  SELECT COALESCE(sum(present + absent), 0)::bigint AS total,
         COALESCE(sum(present), 0)::bigint          AS present
    FROM att_month
),

prof AS MATERIALIZED (
  SELECT p.id,
         p.role::text AS base_role,
         CASE
           WHEN p_department_id IS NOT NULL
                AND jsonb_array_length(COALESCE(p.assignments, '[]'::jsonb)) > 0
           THEN COALESCE((
                  SELECT array_agg(a->>'role' ORDER BY ord)
                    FROM jsonb_array_elements(p.assignments) WITH ORDINALITY t(a, ord), cfg
                   WHERE NULLIF(a->>'department_id', '')::uuid = p_department_id
                     AND (cfg.cls IS NULL OR a->>'assigned_class' = cfg.cls)
                     AND a->>'role' IS NOT NULL
                ), '{}'::text[])
           ELSE array_remove(ARRAY[p.role::text] || COALESCE(p.roles, '{}'::text[]), NULL)
         END AS eff_roles
    FROM profiles p, cfg
   WHERE p.company_id = p_company_id
     AND (
       p_department_id IS NULL
       OR (CASE
             WHEN jsonb_array_length(COALESCE(p.assignments, '[]'::jsonb)) = 0
             THEN p.department_id = p_department_id
                  AND (cfg.cls IS NULL OR p.assigned_class = cfg.cls)
             ELSE EXISTS (
                    SELECT 1 FROM jsonb_array_elements(p.assignments) a
                     WHERE NULLIF(a->>'department_id', '')::uuid = p_department_id
                       AND (cfg.cls IS NULL OR a->>'assigned_class' = cfg.cls))
           END)
     )
),

months12 AS (
  SELECT to_char((SELECT today FROM cfg) - (i || ' month')::interval, 'YYYY-MM') AS month_key,
         11 - i AS ord
    FROM generate_series(11, 0, -1) i
),
months6 AS (
  SELECT to_char((SELECT today FROM cfg) - (i || ' month')::interval, 'YYYY-MM') AS month_key,
         5 - i AS ord
    FROM generate_series(5, 0, -1) i
),
altas AS (
  SELECT to_char(created_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'YYYY-MM') AS month_key,
         count(*) AS cnt
    FROM stud
   GROUP BY 1
),
growth AS (
  SELECT m.month_key, m.ord, COALESCE(a.cnt, 0) AS cnt,
         -- Acumulado: los anteriores al primer mes de la serie + el running de la serie.
         (SELECT count(*) FROM altas x WHERE x.month_key < (SELECT min(month_key) FROM months12))
         + sum(COALESCE(a.cnt, 0)) OVER (ORDER BY m.ord) AS total
    FROM months12 m
    LEFT JOIN altas a ON a.month_key = m.month_key
),

gender AS (
  SELECT lower(COALESCE(NULLIF(gender, ''), 'desconocido')) AS key, count(*) AS value
    FROM stud GROUP BY 1
),
ages AS (SELECT age FROM stud WHERE birthdate IS NOT NULL AND age > 0),
buckets AS (
  SELECT b.name, b.ord,
         count(a.age) FILTER (WHERE a.age BETWEEN b.lo AND b.hi) AS value
    FROM (VALUES ('0–11',0,11,1), ('12–17',12,17,2), ('18–29',18,29,3), ('30–44',30,44,4),
                 ('45–59',45,59,5), ('60–79',60,79,6), ('80+',80,200,7)) AS b(name, lo, hi, ord)
    LEFT JOIN ages a ON true
   GROUP BY b.name, b.ord
),
exact_ages AS (
  SELECT i AS age, (SELECT count(*) FROM ages a WHERE a.age = i) AS value
    FROM generate_series(0, COALESCE((SELECT max(age) FROM ages), 0)) i
),
classes AS (
  SELECT c.cls, c.ord,
         (SELECT count(*) FROM stud_dept sd
           WHERE CASE WHEN sd.has_assigns
                      THEN c.cls = ANY (COALESCE(sd.sd_classes, '{}'::text[]))
                      ELSE sd.assigned_class = c.cls END) AS value
    FROM (SELECT cls, ord FROM departments d, unnest(d.classes) WITH ORDINALITY u(cls, ord)
           WHERE d.id = p_department_id AND d.company_id = p_company_id) c
),

roles AS (
  SELECT COALESCE(eff_roles[1], base_role, 'otro') AS role, count(*) AS value
    FROM prof GROUP BY 1 ORDER BY 2 DESC LIMIT 7
),
volunteers AS (
  SELECT count(*) AS value FROM prof
   WHERE eff_roles && ARRAY['lider','maestro','auxiliar_maestro','colaborador','director','vicedirector']
)

SELECT jsonb_build_object(
  'totalStudents',           (SELECT count(*) FROM stud),
  'totalProfiles',           (SELECT count(*) FROM prof),
  'totalAttendanceRecords',  (SELECT total FROM att_total),
  'attendanceRate',          (SELECT CASE WHEN total > 0
                                          THEN round(present * 100.0 / total, 1)
                                          ELSE 0 END FROM att_total),
  'avgAge',                  (SELECT COALESCE(round(avg(age)), 0)::int FROM ages),
  'newStudents',             (SELECT count(*) FROM stud WHERE nuevo),
  'totalVolunteers',         (SELECT value FROM volunteers),
  'genderData',              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'key',   key,
                               'name',  CASE key WHEN 'masculino' THEN 'Masculino'
                                                 WHEN 'femenino'  THEN 'Femenino'
                                                 ELSE 'Sin dato' END,
                               'value', value) ORDER BY value DESC) FROM gender), '[]'::jsonb),
  'ageBuckets',              COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'name', name, 'value', value) ORDER BY ord) FROM buckets), '[]'::jsonb),
  'exactAgeData',            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'name', age::text, 'value', value) ORDER BY age) FROM exact_ages), '[]'::jsonb),
  'last12Months',            COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'monthKey', month_key, 'count', cnt, 'total', total) ORDER BY ord) FROM growth), '[]'::jsonb),
  'last6Months',             COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'monthKey', m.month_key,
                               'present',  COALESCE(a.present, 0),
                               'absent',   COALESCE(a.absent, 0),
                               'rate',     CASE WHEN COALESCE(a.present, 0) + COALESCE(a.absent, 0) > 0
                                                THEN round(a.present * 100.0 / (a.present + a.absent))
                                                ELSE 0 END) ORDER BY m.ord)
                               FROM months6 m LEFT JOIN att_month a ON a.month_key = m.month_key), '[]'::jsonb),
  'roleData',                COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'name',  upper(left(role, 1)) || substr(role, 2),
                               'value', value) ORDER BY value DESC) FROM roles), '[]'::jsonb),
  'classDistributionData',   COALESCE((SELECT jsonb_agg(jsonb_build_object(
                               'name', cls, 'value', value) ORDER BY ord) FROM classes), '[]'::jsonb)
);
$$;


ALTER FUNCTION "api"."estadisticas_resumen"("p_company_id" integer, "p_department_id" "uuid", "p_department_ids" "uuid"[], "p_assigned_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."grupos_listar"("p_company_id" integer, "p_status" "text", "p_profile_id" "uuid", "p_department_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_global" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH visibles AS MATERIALIZED (
  SELECT g.*
    FROM small_groups g
   WHERE g.company_id = p_company_id
     AND g.status = p_status
     AND (
       p_global
       OR (p_department_ids IS NOT NULL
           AND g.department_id IS NOT NULL
           AND g.department_id = ANY (p_department_ids))
       OR EXISTS (SELECT 1 FROM small_group_members m
                   WHERE m.group_id = g.id
                     AND m.profile_id = p_profile_id
                     AND m.company_id = p_company_id
                     AND m.status = 'active')
     )
),
miembros AS MATERIALIZED (
  SELECT m.group_id,
         count(*)::int AS member_count,
         COALESCE(
           jsonb_agg(
             jsonb_build_object(
               'id',            p.id,
               'first_name',    p.first_name,
               'last_name',     p.last_name,
               'role_in_group', m.role_in_group
             )
             ORDER BY (m.role_in_group <> 'leader'), p.first_name
           ) FILTER (WHERE m.role_in_group IN ('leader', 'co_leader') AND p.id IS NOT NULL),
           '[]'::jsonb
         ) AS leaders
    FROM small_group_members m
    LEFT JOIN profiles p ON p.id = m.profile_id
   WHERE m.company_id = p_company_id
     AND m.status = 'active'
     AND m.group_id IN (SELECT id FROM visibles)
   GROUP BY m.group_id
)
SELECT COALESCE(
  (SELECT jsonb_agg(
            to_jsonb(v) || jsonb_build_object(
              'leaders',      COALESCE(mi.leaders, '[]'::jsonb),
              'member_count', COALESCE(mi.member_count, 0)
            )
            ORDER BY v.name)
     FROM visibles v
     LEFT JOIN miembros mi ON mi.group_id = v.id),
  '[]'::jsonb
);
$$;


ALTER FUNCTION "api"."grupos_listar"("p_company_id" integer, "p_status" "text", "p_profile_id" "uuid", "p_department_ids" "uuid"[], "p_global" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."miembro_linea_tiempo"("p_company_id" integer, "p_student_id" "uuid") RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
WITH miembro AS (
  -- Aislamiento multi-tenant: si la ficha no es de esta empresa, no hay nada que contar.
  SELECT s.*, d.name AS department_name
  FROM students s
  LEFT JOIN departments d ON d.id = s.department_id
  WHERE s.id = p_student_id AND s.company_id = p_company_id
),
eventos AS (
  SELECT e.event_type                AS tipo,
         e.occurred_at               AS fecha,
         d.name                      AS departamento,
         e.actor_name                AS actor,
         e.detail                    AS detalle
  FROM student_events e
  LEFT JOIN departments d ON d.id = e.department_id
  WHERE e.student_id = p_student_id AND e.company_id = p_company_id
),
observaciones AS (
  SELECT 'observacion'::text AS tipo,
         o.created_at        AS fecha,
         d.name              AS departamento,
         NULLIF(btrim(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), '') AS actor,
         jsonb_build_object('texto', o.observation) AS detalle
  FROM student_observations o
  LEFT JOIN departments d  ON d.id  = o.department_id
  LEFT JOIN profiles    pr ON pr.id = o.created_by
  WHERE o.student_id = p_student_id AND o.company_id = p_company_id
),
autorizaciones AS (
  SELECT 'autorizacion'::text AS tipo,
         au.created_at        AS fecha,
         d.name               AS departamento,
         NULL::text           AS actor,
         jsonb_build_object('clase', au.class) AS detalle
  FROM student_authorizations au
  LEFT JOIN departments d ON d.id = au.department_id
  WHERE au.student_id = p_student_id AND au.company_id = p_company_id
),
grupos AS (
  SELECT 'grupo_pequeno'::text AS tipo,
         COALESCE(m.approved_at, m.requested_at, m.created_at) AS fecha,
         NULL::text            AS departamento,
         NULL::text            AS actor,
         jsonb_build_object(
           'grupo',  g.name,
           'rol',    m.role_in_group,
           'estado', m.status
         ) AS detalle
  FROM small_group_members m
  JOIN small_groups g ON g.id = m.group_id
  WHERE m.student_id = p_student_id AND m.company_id = p_company_id
),
asistencia AS (
  -- Un renglón por mes y departamento, no por domingo.
  SELECT 'asistencia_mes'::text AS tipo,
         date_trunc('month', att.date::date)::timestamptz AS fecha,
         d.name                                           AS departamento,
         NULL::text                                       AS actor,
         jsonb_build_object(
           'presentes', count(*) FILTER (WHERE att.status),
           'total',     count(*),
           'clase',     max(att.assigned_class)
         ) AS detalle
  FROM attendance att
  LEFT JOIN departments d ON d.id = att.department_id
  WHERE att.student_id = p_student_id
    AND att.company_id = p_company_id
    AND att.date ~ '^\d{4}-\d{2}-\d{2}$'   -- `date` es varchar: descarta basura antes de castear
  GROUP BY 2, 3
),
todo AS (
  SELECT * FROM eventos
  UNION ALL SELECT * FROM observaciones
  UNION ALL SELECT * FROM autorizaciones
  UNION ALL SELECT * FROM grupos
  UNION ALL SELECT * FROM asistencia
)
SELECT jsonb_build_object(
  'miembro', (
    SELECT jsonb_build_object(
      'id',              m.id,
      'first_name',      m.first_name,
      'last_name',       m.last_name,
      'document_number', m.document_number,
      'photo_url',       m.photo_url,
      'department',      m.department_name,
      'assigned_class',  m.assigned_class,
      'created_at',      m.created_at,
      'deleted_at',      m.deleted_at,
      'deleted_reason',  m.deleted_reason,
      'activo',          m.deleted_at IS NULL
    ) FROM miembro m
  ),
  'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'tipo',         t.tipo,
      'fecha',        t.fecha,
      'departamento', t.departamento,
      'actor',        t.actor,
      'detalle',      t.detalle
    ) ORDER BY t.fecha DESC)
    FROM todo t
    WHERE t.fecha IS NOT NULL
  ), '[]'::jsonb)
)
WHERE EXISTS (SELECT 1 FROM miembro);
$_$;


ALTER FUNCTION "api"."miembro_linea_tiempo"("p_company_id" integer, "p_student_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."miembros_archivados"("p_company_id" integer, "p_search" "text" DEFAULT NULL::"text", "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_desde" "date" DEFAULT NULL::"date", "p_hasta" "date" DEFAULT NULL::"date", "p_limit" integer DEFAULT 30, "p_offset" integer DEFAULT 0) RETURNS "jsonb"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
WITH base AS (
  -- Aislamiento multi-tenant: SECURITY DEFINER ignora RLS, el filtro lo hace la función.
  SELECT s.id, s.first_name, s.last_name, s.document_number, s.birthdate, s.gender,
         s.phone, s.address, s.photo_url, s.deleted_at, s.deleted_reason, s.deleted_by,
         s.department_id, s.assigned_class, s.created_at
  FROM students s
  WHERE s.company_id = p_company_id
    AND s.deleted_at IS NOT NULL
    -- Solo bajas hechas con motivo. Las viejas (borradas antes de que el motivo existiera,
    -- y las copias que dejaron los duplicados) no cuentan como archivo consultable: la ficha
    -- y su historial siguen en la base, pero no ensucian el listado.
    AND s.deleted_reason IS NOT NULL
    AND (p_department_id IS NULL OR s.department_id = p_department_id)
    AND (p_desde IS NULL OR s.deleted_at >= p_desde::timestamptz)
    AND (p_hasta IS NULL OR s.deleted_at < (p_hasta + 1)::timestamptz)
    AND (
      p_search IS NULL OR btrim(p_search) = ''
      OR s.document_number ILIKE '%' || btrim(p_search) || '%'
      OR btrim(COALESCE(s.first_name, '') || ' ' || COALESCE(s.last_name, '')) ILIKE '%' || btrim(p_search) || '%'
    )
),
clave AS (
  SELECT b.*,
         COALESCE(
           NULLIF(btrim(b.document_number), ''),
           lower(btrim(COALESCE(b.first_name, '') || ' ' || COALESCE(b.last_name, '')))
             || '|' || COALESCE(b.department_id::text, '')
             || '|' || b.deleted_at::date::text
         ) AS persona
  FROM base b
),
dedup AS (
  SELECT c.*,
         row_number() OVER (PARTITION BY c.persona ORDER BY c.deleted_at DESC) AS rn,
         count(*)     OVER (PARTITION BY c.persona)                            AS fichas
  FROM clave c
),
pag AS (
  SELECT * FROM dedup
  WHERE rn = 1
  ORDER BY deleted_at DESC
  LIMIT COALESCE(p_limit, 30) OFFSET COALESCE(p_offset, 0)
)
SELECT jsonb_build_object(
  'total', (SELECT count(DISTINCT persona) FROM clave),
  'items', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id',                p.id,
      'first_name',        p.first_name,
      'last_name',         p.last_name,
      'document_number',   p.document_number,
      'birthdate',         p.birthdate,
      'gender',            p.gender,
      'phone',             p.phone,
      'address',           p.address,
      'photo_url',         p.photo_url,
      'created_at',        p.created_at,
      'deleted_at',        p.deleted_at,
      'deleted_reason',    p.deleted_reason,
      'deleted_by_name',   NULLIF(btrim(COALESCE(pr.first_name, '') || ' ' || COALESCE(pr.last_name, '')), ''),
      'department_id',     p.department_id,
      'department',        d.name,
      'assigned_class',    p.assigned_class,
      'asistencias',       COALESCE(a.presentes, 0),
      'ultima_asistencia', a.ultima,
      'fichas',            p.fichas
    ) ORDER BY p.deleted_at DESC)
    FROM pag p
    LEFT JOIN departments d  ON d.id  = p.department_id
    LEFT JOIN profiles    pr ON pr.id = p.deleted_by
    LEFT JOIN LATERAL (
      SELECT count(*) FILTER (WHERE att.status) AS presentes,
             max(att.date)                      AS ultima
      FROM attendance att
      WHERE att.student_id = p.id
        AND att.company_id = p_company_id
    ) a ON true
  ), '[]'::jsonb)
);
$$;


ALTER FUNCTION "api"."miembros_archivados"("p_company_id" integer, "p_search" "text", "p_department_id" "uuid", "p_desde" "date", "p_hasta" "date", "p_limit" integer, "p_offset" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "api"."miembros_fusionar"("p_company_id" integer, "p_source_id" "uuid", "p_target_id" "uuid", "p_dry_run" boolean DEFAULT false) RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_source public.students%ROWTYPE;
  v_target public.students%ROWTYPE;
  v_asistencias            integer := 0;
  v_asistencias_duplicadas integer := 0;
  v_departamentos          integer := 0;
  v_observaciones          integer := 0;
  v_autorizaciones         integer := 0;
  v_ausencias              integer := 0;
  v_grupos                 integer := 0;
  v_perfil_movido          boolean := false;
BEGIN
  IF p_source_id = p_target_id THEN
    RAISE EXCEPTION 'No se puede fusionar un miembro consigo mismo'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Aislamiento multi-tenant: SECURITY DEFINER ignora RLS, el filtro lo hace la funcion.
  SELECT * INTO v_source FROM public.students
   WHERE id = p_source_id AND company_id = p_company_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ficha a absorber no existe o ya fue eliminada'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT * INTO v_target FROM public.students
   WHERE id = p_target_id AND company_id = p_company_id AND deleted_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La ficha que sobrevive no existe o ya fue eliminada'
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Dos cuentas de usuario distintas = decision humana, no la toma el SP.
  -- students.profile_id es UNIQUE, asi que no se pueden conservar las dos.
  IF v_source.profile_id IS NOT NULL
     AND v_target.profile_id IS NOT NULL
     AND v_source.profile_id <> v_target.profile_id THEN
    RAISE EXCEPTION 'Las dos fichas tienen cuenta de usuario propia. Dar de baja una antes de fusionar'
      USING ERRCODE = 'check_violation';
  END IF;

  ---------------------------------------------------------------------------
  -- Conteo de lo que se va a mover (sirve para el dry-run y para el resumen).
  ---------------------------------------------------------------------------
  SELECT count(*) INTO v_asistencias
    FROM public.attendance WHERE student_id = p_source_id AND company_id = p_company_id;

  -- Filas que NO se pueden repuntar y hay que colapsar:
  --   a) mismo evento en las dos fichas  -> choca contra UNIQUE (student_id, event_id)
  --   b) misma fecha + depto + clase     -> no choca, pero duplicaria la presencia
  SELECT count(*) INTO v_asistencias_duplicadas
    FROM public.attendance s
   WHERE s.student_id = p_source_id AND s.company_id = p_company_id
     AND EXISTS (
       SELECT 1 FROM public.attendance t
        WHERE t.student_id = p_target_id AND t.company_id = p_company_id
          AND (
            (s.event_id IS NOT NULL AND t.event_id = s.event_id)
            OR (s.event_id IS NULL AND t.event_id IS NULL
                AND t.date = s.date
                AND t.department_id IS NOT DISTINCT FROM s.department_id
                AND COALESCE(t.assigned_class, '') = COALESCE(s.assigned_class, ''))
          )
     );

  -- Departamentos distintos del source: la junction MAS el primario legacy, que puede
  -- no tener fila en student_departments (lo normaliza el paso 1 mas abajo).
  SELECT count(*) INTO v_departamentos FROM (
    SELECT department_id FROM public.student_departments
     WHERE student_id = p_source_id AND company_id = p_company_id
    UNION
    SELECT v_source.department_id WHERE v_source.department_id IS NOT NULL
  ) q;
  SELECT count(*) INTO v_observaciones
    FROM public.student_observations WHERE student_id = p_source_id;
  SELECT count(*) INTO v_autorizaciones
    FROM public.student_authorizations WHERE student_id = p_source_id AND company_id = p_company_id;
  SELECT count(*) INTO v_ausencias
    FROM public.student_absence_notifications WHERE student_id = p_source_id;
  SELECT count(*) INTO v_grupos
    FROM public.small_group_members WHERE student_id = p_source_id AND company_id = p_company_id;

  v_perfil_movido := v_source.profile_id IS NOT NULL AND v_target.profile_id IS NULL;

  IF p_dry_run THEN
    RETURN jsonb_build_object(
      'dry_run', true,
      'source', jsonb_build_object('id', v_source.id, 'first_name', v_source.first_name,
                                   'last_name', v_source.last_name, 'document_number', v_source.document_number),
      'target', jsonb_build_object('id', v_target.id, 'first_name', v_target.first_name,
                                   'last_name', v_target.last_name, 'document_number', v_target.document_number),
      'asistencias', v_asistencias,
      'asistencias_duplicadas', v_asistencias_duplicadas,
      'departamentos', v_departamentos,
      'observaciones', v_observaciones,
      'autorizaciones', v_autorizaciones,
      'ausencias', v_ausencias,
      'grupos_pequenos', v_grupos,
      'mueve_cuenta_usuario', v_perfil_movido
    );
  END IF;

  ---------------------------------------------------------------------------
  -- 1. Normalizar el departamento primario a la junction.
  --    El modelo viejo (students.department_id) convive con student_departments:
  --    sin esto, un depto que solo existia como primario del source se perderia.
  ---------------------------------------------------------------------------
  INSERT INTO public.student_departments (student_id, department_id, assigned_class, role_in_dept, company_id)
  SELECT s.id, s.department_id, s.assigned_class, 'alumno', s.company_id
    FROM public.students s
   WHERE s.id IN (p_source_id, p_target_id)
     AND s.department_id IS NOT NULL
  ON CONFLICT (student_id, department_id, role_in_dept) DO NOTHING;

  ---------------------------------------------------------------------------
  -- 2. attendance. Primero colapsar los choques, despues repuntar el resto.
  --    Criterio: presente gana, igual que el bool_or de api.asistencia_matriz
  --    cuando un alumno tiene mas de un registro el mismo dia.
  ---------------------------------------------------------------------------
  UPDATE public.attendance t
     SET status = true, updated_at = now()
    FROM public.attendance s
   WHERE t.student_id = p_target_id AND t.company_id = p_company_id
     AND s.student_id = p_source_id AND s.company_id = p_company_id
     AND s.status = true AND t.status = false
     AND (
       (s.event_id IS NOT NULL AND t.event_id = s.event_id)
       OR (s.event_id IS NULL AND t.event_id IS NULL
           AND t.date = s.date
           AND t.department_id IS NOT DISTINCT FROM s.department_id
           AND COALESCE(t.assigned_class, '') = COALESCE(s.assigned_class, ''))
     );

  DELETE FROM public.attendance s
   WHERE s.student_id = p_source_id AND s.company_id = p_company_id
     AND EXISTS (
       SELECT 1 FROM public.attendance t
        WHERE t.student_id = p_target_id AND t.company_id = p_company_id
          AND (
            (s.event_id IS NOT NULL AND t.event_id = s.event_id)
            OR (s.event_id IS NULL AND t.event_id IS NULL
                AND t.date = s.date
                AND t.department_id IS NOT DISTINCT FROM s.department_id
                AND COALESCE(t.assigned_class, '') = COALESCE(s.assigned_class, ''))
          )
     );

  UPDATE public.attendance
     SET student_id = p_target_id, updated_at = now()
   WHERE student_id = p_source_id AND company_id = p_company_id;

  ---------------------------------------------------------------------------
  -- 3. Resto de las tablas que cuelgan de students.
  --    Mismo patron: borrar lo que chocaria contra el UNIQUE, repuntar el resto.
  ---------------------------------------------------------------------------

  -- student_departments: UNIQUE (student_id, department_id, role_in_dept)
  DELETE FROM public.student_departments s
   WHERE s.student_id = p_source_id AND s.company_id = p_company_id
     AND EXISTS (
       SELECT 1 FROM public.student_departments t
        WHERE t.student_id = p_target_id AND t.department_id = s.department_id
          AND t.role_in_dept = s.role_in_dept
     );
  UPDATE public.student_departments SET student_id = p_target_id
   WHERE student_id = p_source_id AND company_id = p_company_id;

  -- student_authorizations: UNIQUE (student_id, department_id)
  DELETE FROM public.student_authorizations s
   WHERE s.student_id = p_source_id AND s.company_id = p_company_id
     AND EXISTS (
       SELECT 1 FROM public.student_authorizations t
        WHERE t.student_id = p_target_id AND t.department_id = s.department_id
     );
  UPDATE public.student_authorizations SET student_id = p_target_id
   WHERE student_id = p_source_id AND company_id = p_company_id;

  -- student_absence_notifications: UNIQUE (student_id, department_id)
  DELETE FROM public.student_absence_notifications s
   WHERE s.student_id = p_source_id
     AND EXISTS (
       SELECT 1 FROM public.student_absence_notifications t
        WHERE t.student_id = p_target_id AND t.department_id = s.department_id
     );
  UPDATE public.student_absence_notifications SET student_id = p_target_id
   WHERE student_id = p_source_id;

  -- small_group_members: UNIQUE parcial (group_id, student_id) WHERE student_id IS NOT NULL.
  -- Tambien hay que contemplar el vinculo por profile_id: si el target entra al grupo con su
  -- cuenta, meter ademas al source por student_id duplicaria la persona en el mismo grupo.
  DELETE FROM public.small_group_members s
   WHERE s.student_id = p_source_id AND s.company_id = p_company_id
     AND EXISTS (
       SELECT 1 FROM public.small_group_members t
        WHERE t.group_id = s.group_id
          AND (t.student_id = p_target_id
               OR (v_target.profile_id IS NOT NULL AND t.profile_id = v_target.profile_id)
               OR (v_source.profile_id IS NOT NULL AND t.profile_id = v_source.profile_id))
     );
  UPDATE public.small_group_members SET student_id = p_target_id
   WHERE student_id = p_source_id AND company_id = p_company_id;

  -- student_observations: sin UNIQUE, se repunta todo.
  UPDATE public.student_observations SET student_id = p_target_id
   WHERE student_id = p_source_id;

  ---------------------------------------------------------------------------
  -- 4. Datos personales: el target manda, el source solo rellena lo que falta.
  --    Nunca se pisa un dato existente del target.
  ---------------------------------------------------------------------------
  IF v_perfil_movido THEN
    -- students.profile_id es UNIQUE: liberar el del source antes de asignarlo.
    UPDATE public.students SET profile_id = NULL WHERE id = p_source_id;
  END IF;

  UPDATE public.students t
     SET last_name       = COALESCE(NULLIF(t.last_name, ''), NULLIF(v_source.last_name, '')),
         phone           = COALESCE(t.phone, v_source.phone),
         address         = COALESCE(t.address, v_source.address),
         birthdate       = COALESCE(t.birthdate, v_source.birthdate),
         document_number = COALESCE(t.document_number, v_source.document_number),
         photo_url       = COALESCE(t.photo_url, v_source.photo_url),
         baptized        = t.baptized OR v_source.baptized,
         profile_id      = COALESCE(t.profile_id, CASE WHEN v_perfil_movido THEN v_source.profile_id END),
         updated_at      = now()
   WHERE t.id = p_target_id;

  -- Si el target no tenia departamento primario, promover uno de la junction
  -- (puede venir del source). Sin esto quedaria como "solo congregacion".
  UPDATE public.students t
     SET department_id  = sd.department_id,
         assigned_class = sd.assigned_class,
         updated_at     = now()
    FROM (
      SELECT department_id, assigned_class
        FROM public.student_departments
       WHERE student_id = p_target_id AND company_id = p_company_id
       ORDER BY created_at
       LIMIT 1
    ) sd
   WHERE t.id = p_target_id AND t.department_id IS NULL;

  ---------------------------------------------------------------------------
  -- 5. Baja de la ficha absorbida. Soft delete: se conserva para auditoria.
  --    El DNI se libera porque los chequeos de duplicado filtran deleted_at IS NULL,
  --    pero se blanquea igual para que no reaparezca en busquedas por documento.
  ---------------------------------------------------------------------------
  UPDATE public.students
     SET deleted_at      = now(),
         document_number = NULL,
         department_id   = NULL,
         assigned_class  = NULL,
         updated_at      = now()
   WHERE id = p_source_id AND company_id = p_company_id;

  RETURN jsonb_build_object(
    'dry_run', false,
    'source_id', p_source_id,
    'target_id', p_target_id,
    'asistencias', v_asistencias,
    'asistencias_duplicadas', v_asistencias_duplicadas,
    'departamentos', v_departamentos,
    'observaciones', v_observaciones,
    'autorizaciones', v_autorizaciones,
    'ausencias', v_ausencias,
    'grupos_pequenos', v_grupos,
    'mueve_cuenta_usuario', v_perfil_movido
  );
END;
$$;


ALTER FUNCTION "api"."miembros_fusionar"("p_company_id" integer, "p_source_id" "uuid", "p_target_id" "uuid", "p_dry_run" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_environment"() RETURNS "text"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    AS $$
BEGIN
    -- Default to 'development' 
    -- This function is a placeholder that can be expanded later with environment detection logic
    RETURN 'development';
END;
$$;


ALTER FUNCTION "public"."get_environment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_assigned_class" "text" DEFAULT NULL::"text", "p_gender" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text", "p_scope_department_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_scope_class" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "gender" "text", "birthdate" "date", "phone" "text", "address" "text", "document_number" "text", "photo_url" "text", "assigned_class" "text", "department_id" "uuid", "department_name" "text", "profile_id" "uuid", "nuevo" boolean, "baptized" boolean, "company_id" integer, "created_at" timestamp with time zone, "is_authorized" boolean, "active_enrollments_count" bigint, "small_groups_count" bigint, "dept_assignments" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$

WITH dept_ids AS (
  SELECT DISTINCT ON (s.id) s.id AS student_id,
    COALESCE(sd.assigned_class, s.assigned_class) AS resolved_class
  FROM students s
  LEFT JOIN student_departments sd
    ON sd.student_id = s.id
    AND p_department_id IS NOT NULL
    AND sd.department_id = p_department_id
    AND (p_assigned_class IS NULL OR p_assigned_class = 'all' OR sd.assigned_class ILIKE p_assigned_class)
  WHERE s.company_id = p_company_id
    AND s.deleted_at IS NULL
    AND (
      p_department_id IS NULL
      OR s.department_id = p_department_id
      OR sd.student_id IS NOT NULL
    )
    AND (
      p_assigned_class IS NULL OR p_assigned_class = 'all'
      OR s.assigned_class ILIKE p_assigned_class
      OR sd.assigned_class ILIKE p_assigned_class
    )
  ORDER BY s.id
),

authorized_ids AS (
  SELECT DISTINCT sa.student_id
  FROM student_authorizations sa
  WHERE p_department_id IS NOT NULL
    AND p_assigned_class IS NOT NULL
    AND p_assigned_class <> 'all'
    AND sa.department_id = p_department_id
    AND sa.class ILIKE p_assigned_class
    AND sa.company_id = p_company_id
),

scope_ids AS (
  SELECT s.id AS student_id
  FROM students s
  WHERE p_scope_department_ids IS NOT NULL
    AND s.company_id = p_company_id
    AND s.deleted_at IS NULL
    AND (
      s.department_id = ANY(p_scope_department_ids)
      OR EXISTS (
        SELECT 1 FROM student_departments sd
        WHERE sd.student_id = s.id
          AND sd.department_id = ANY(p_scope_department_ids)
      )
    )
    AND (
      p_scope_class IS NULL
      OR s.assigned_class ILIKE p_scope_class
      OR EXISTS (
        SELECT 1 FROM student_departments sd2
        WHERE sd2.student_id = s.id
          AND sd2.department_id = ANY(p_scope_department_ids)
          AND sd2.assigned_class ILIKE p_scope_class
      )
    )
),

scope_authorized_ids AS (
  SELECT DISTINCT sa.student_id
  FROM student_authorizations sa
  WHERE p_scope_department_ids IS NOT NULL
    AND sa.company_id = p_company_id
    AND sa.department_id = ANY(p_scope_department_ids)
    AND (
      p_scope_class IS NULL
      OR sa.class IS NULL
      OR sa.class = 'all'
      OR sa.class ILIKE p_scope_class
    )
),

all_ids AS (
  SELECT base.student_id
  FROM (
    SELECT student_id FROM dept_ids
    UNION
    SELECT student_id FROM authorized_ids
  ) base
  WHERE p_scope_department_ids IS NULL
     OR base.student_id IN (
       SELECT student_id FROM scope_ids
       UNION
       SELECT student_id FROM scope_authorized_ids
     )
),

assignments AS MATERIALIZED (
  SELECT
    sd.student_id,
    jsonb_agg(
      jsonb_build_object(
        'student_id',    sd.student_id,
        'department_id', sd.department_id,
        'assigned_class',sd.assigned_class,
        'role_in_dept',  COALESCE(sd.role_in_dept, 'alumno'),
        'departments',   jsonb_build_object(
                           'id',      d.id,
                           'name',    d.name,
                           'classes', d.classes
                         )
      )
    ) AS dept_assignments
  FROM student_departments sd
  JOIN departments d ON d.id = sd.department_id
  WHERE sd.student_id IN (SELECT student_id FROM all_ids)
  GROUP BY sd.student_id
),

enrollment_counts AS MATERIALIZED (
  SELECT student_id, COUNT(*) AS cnt
  FROM student_departments
  WHERE student_id IN (SELECT student_id FROM all_ids)
  GROUP BY student_id
),

small_group_counts AS MATERIALIZED (
  SELECT s.id AS student_id, COUNT(*) AS cnt
  FROM students s
  JOIN small_group_members sgm
    ON sgm.student_id = s.id
    OR (s.profile_id IS NOT NULL AND sgm.profile_id = s.profile_id)
  WHERE s.id IN (SELECT student_id FROM all_ids)
    AND sgm.company_id = p_company_id
    AND sgm.status = 'active'
  GROUP BY s.id
)

SELECT
  s.id,
  COALESCE(p.first_name, s.first_name)       AS first_name,
  COALESCE(p.last_name, s.last_name)         AS last_name,
  COALESCE(p.gender, s.gender)               AS gender,
  COALESCE(p.birthdate::date, s.birthdate)   AS birthdate,
  COALESCE(p.phone, s.phone)                 AS phone,
  COALESCE(p.address, s.address)             AS address,
  COALESCE(p.document_number, s.document_number) AS document_number,
  COALESCE(p.photo_url, s.photo_url)         AS photo_url,
  COALESCE(di.resolved_class, s.assigned_class) AS assigned_class,
  s.department_id,
  dep.name AS department_name,
  s.profile_id,
  s.nuevo,
  COALESCE(p.baptized, s.baptized)           AS baptized,
  s.company_id,
  s.created_at,
  -- Aparece en la lista por una autorizacion y no por ser de mi depto/clase.
  (ai.student_id IS NOT NULL
    OR (sai.student_id IS NOT NULL AND sci.student_id IS NULL)) AS is_authorized,
  COALESCE(ec.cnt, 0)          AS active_enrollments_count,
  COALESCE(sgc.cnt, 0)         AS small_groups_count,
  COALESCE(asgn.dept_assignments, '[]'::jsonb) AS dept_assignments
FROM students s
JOIN all_ids ON all_ids.student_id = s.id
LEFT JOIN profiles p        ON p.id = s.profile_id
LEFT JOIN dept_ids di       ON di.student_id = s.id
LEFT JOIN authorized_ids ai ON ai.student_id = s.id
LEFT JOIN scope_ids sci     ON sci.student_id = s.id
LEFT JOIN scope_authorized_ids sai ON sai.student_id = s.id
LEFT JOIN departments dep   ON dep.id = s.department_id
LEFT JOIN assignments asgn  ON asgn.student_id = s.id
LEFT JOIN enrollment_counts ec ON ec.student_id = s.id
LEFT JOIN small_group_counts sgc ON sgc.student_id = s.id
WHERE s.deleted_at IS NULL
  AND s.company_id = p_company_id
  AND (p_gender IS NULL OR COALESCE(p.gender, s.gender) = p_gender)
  AND (
    p_search IS NULL
    OR COALESCE(p.first_name, s.first_name) ILIKE '%' || p_search || '%'
    OR COALESCE(p.last_name, s.last_name)   ILIKE '%' || p_search || '%'
  )
ORDER BY COALESCE(p.first_name, s.first_name);

$$;


ALTER FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text", "p_scope_department_ids" "uuid"[], "p_scope_class" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  dept_id uuid;
BEGIN
  -- Determine department_id
  IF new.raw_user_meta_data->>'department_id' IS NOT NULL AND 
     (new.raw_user_meta_data->>'department_id') ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  THEN
    dept_id := (new.raw_user_meta_data->>'department_id')::uuid;
  ELSE
    dept_id := NULL;
  END IF;

  -- Insert into profiles
  INSERT INTO public.profiles (
    id,
    first_name,
    last_name,
    role,
    departments,
    department_id,
    assigned_class,
    phone,
    birthdate,
    gender,
    address,
    document_number,
    is_member,
    roles,
    company_id
  )
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', ''),
    COALESCE(new.raw_user_meta_data->>'last_name', ''),
    COALESCE((new.raw_user_meta_data->>'role')::public.app_role, 'maestro'::public.app_role),
    COALESCE(
      (SELECT ARRAY(
        SELECT jsonb_array_elements_text(new.raw_user_meta_data->'departments')
      )),
      '{}'::text[]
    ),
    dept_id,
    COALESCE(new.raw_user_meta_data->>'assigned_class', ''),
    new.raw_user_meta_data->>'phone',
    CASE WHEN new.raw_user_meta_data->>'birthdate' IS NOT NULL THEN (new.raw_user_meta_data->>'birthdate')::DATE ELSE NULL END,
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'address',
    new.raw_user_meta_data->>'document_number',
    COALESCE((new.raw_user_meta_data->>'is_member')::boolean, (new.raw_user_meta_data->>'role' IN ('maestro', 'colaborador')), false),
    ARRAY[COALESCE(new.raw_user_meta_data->>'role', 'maestro')],
    COALESCE((new.raw_user_meta_data->>'company_id')::bigint, 1)
  );

  -- Automatically create student record for 'Obreros' class if role is maestro or colaborador
  IF (new.raw_user_meta_data->>'role' IN ('maestro', 'colaborador')) THEN
    INSERT INTO public.students (
      first_name,
      last_name,
      document_number,
      birthdate,
      assigned_class,
      department_id,
      company_id,
      profile_id,
      gender
    ) VALUES (
      COALESCE(new.raw_user_meta_data->>'first_name', ''),
      COALESCE(new.raw_user_meta_data->>'last_name', ''),
      new.raw_user_meta_data->>'document_number',
      CASE WHEN new.raw_user_meta_data->>'birthdate' IS NOT NULL THEN (new.raw_user_meta_data->>'birthdate')::DATE ELSE NULL END,
      'Obreros',
      dept_id,
      COALESCE((new.raw_user_meta_data->>'company_id')::bigint, 1),
      new.id,
      COALESCE(new.raw_user_meta_data->>'gender', 'masculino')
    );
  END IF;

  RETURN new;
END;
$_$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_profile_to_student"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- If the role is maestro or colaborador, ensure a student record exists and is up to date
  IF (new.role IN ('maestro', 'colaborador')) THEN
    INSERT INTO public.students (
      first_name,
      last_name,
      document_number,
      birthdate,
      assigned_class,
      department_id,
      company_id,
      profile_id,
      gender
    ) VALUES (
      COALESCE(new.first_name, ''),
      COALESCE(new.last_name, ''),
      new.document_number,
      new.birthdate,
      'Obreros',
      new.department_id,
      new.company_id,
      new.id,
      COALESCE(new.gender, 'masculino')
    )
    ON CONFLICT (profile_id) DO UPDATE SET
      first_name = EXCLUDED.first_name,
      last_name = EXCLUDED.last_name,
      document_number = EXCLUDED.document_number,
      birthdate = EXCLUDED.birthdate,
      department_id = EXCLUDED.department_id,
      company_id = EXCLUDED.company_id,
      gender = EXCLUDED.gender;
  END IF;
  
  RETURN new;
END;
$$;


ALTER FUNCTION "public"."sync_profile_to_student"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_department_ids"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    dept record;
BEGIN
    -- For each department
    FOR dept IN SELECT id, name FROM departments LOOP
        -- Update profiles where the user has this department in their departments array
        UPDATE profiles
        SET department_id = dept.id
        WHERE departments @> ARRAY[dept.name]::text[] 
        AND (department_id IS NULL OR department_id != dept.id);
        
        -- Update students with department name
        UPDATE students
        SET department_id = dept.id
        WHERE department = dept.name
        AND (department_id IS NULL OR department_id != dept.id);
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."update_department_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_fecha_actualizacion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.fecha_actualizacion = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_fecha_actualizacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_maintenance_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_maintenance_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_pushalert_timestamp"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    IF (NEW.pushalert_id IS DISTINCT FROM OLD.pushalert_id) OR 
       (NEW.pushalert_subscribed IS DISTINCT FROM OLD.pushalert_subscribed) OR 
       (NEW.pushalert_attributes IS DISTINCT FROM OLD.pushalert_attributes) THEN
        NEW.pushalert_updated_at = timezone('utc'::text, now());
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_pushalert_timestamp"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."accounting_opening_balances" (
    "company_id" integer NOT NULL,
    "department_id" "uuid" NOT NULL,
    "opening_balance" numeric(12,2) DEFAULT 0 NOT NULL,
    "updated_by" "uuid",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."accounting_opening_balances" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."accounting_transactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" integer NOT NULL,
    "department_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "amount" numeric(12,2) NOT NULL,
    "category" "text",
    "description" "text",
    "movement_date" "date" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "assigned_class" "text",
    CONSTRAINT "accounting_transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "accounting_transactions_type_check" CHECK (("type" = ANY (ARRAY['ingreso'::"text", 'egreso'::"text"])))
);


ALTER TABLE "public"."accounting_transactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."students" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text" NOT NULL,
    "phone" "text",
    "address" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "gender" "text" DEFAULT 'masculino'::"text" NOT NULL,
    "birthdate" "date",
    "assigned_class" "text",
    "department" "text",
    "department_id" "uuid",
    "document_number" "text",
    "last_name" "text",
    "deleted_at" timestamp with time zone,
    "nuevo" boolean DEFAULT false,
    "profile_id" "uuid",
    "company_id" bigint DEFAULT 1,
    "photo_url" "text",
    "baptized" boolean DEFAULT false NOT NULL,
    "deleted_reason" "text",
    "deleted_by" "uuid",
    CONSTRAINT "students_gender_check" CHECK (("gender" = ANY (ARRAY['masculino'::"text", 'femenino'::"text"])))
);


ALTER TABLE "public"."students" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_students" AS
 SELECT "students"."id",
    "students"."first_name",
    "students"."phone",
    "students"."address",
    "students"."created_at",
    "students"."updated_at",
    "students"."gender",
    "students"."birthdate",
    "students"."assigned_class",
    "students"."department",
    "students"."department_id",
    "students"."document_number",
    "students"."last_name",
    "students"."deleted_at"
   FROM "public"."students"
  WHERE ("students"."deleted_at" IS NULL);


ALTER TABLE "public"."active_students" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "event_id" "uuid",
    "status" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "date" character varying,
    "assigned_class" "text",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "department" "text",
    "department_id" "uuid",
    "company_id" bigint DEFAULT 1
);


ALTER TABLE "public"."attendance" OWNER TO "postgres";


COMMENT ON TABLE "public"."attendance" IS 'Table for tracking student attendance';



CREATE TABLE IF NOT EXISTS "public"."badges" (
    "id" bigint NOT NULL,
    "code" "text" NOT NULL,
    "label" "text" NOT NULL,
    "description" "text",
    "icon" "text",
    "color" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "sort" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tier" "text" DEFAULT 'normal'::"text" NOT NULL
);


ALTER TABLE "public"."badges" OWNER TO "postgres";


ALTER TABLE "public"."badges" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."badges_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."class_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "department_id" "uuid" NOT NULL,
    "assigned_class" "text",
    "date" character varying NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "color" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."class_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."companies" (
    "id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "dark_mode" boolean DEFAULT false,
    "auto_save" boolean DEFAULT true,
    "notifications" boolean DEFAULT true,
    "show_attendance_history" boolean DEFAULT true,
    "compact_view" boolean DEFAULT false,
    "show_profile_images" boolean DEFAULT true,
    "show_name" boolean DEFAULT true,
    "congregation_name" "text",
    "whatsapp_status" "text" DEFAULT 'disconnected'::"text",
    "whatsapp_qr" "text",
    "auth_pdf_header" "jsonb" DEFAULT '[]'::"jsonb",
    "role_permissions" "jsonb" DEFAULT '{}'::"jsonb",
    "notification_settings" "jsonb" DEFAULT '{}'::"jsonb",
    "master_password_hash" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "plan" "text",
    "extra_member_packs" integer DEFAULT 0 NOT NULL,
    "billing_cycle" "text" DEFAULT 'mensual'::"text" NOT NULL,
    "last_payment_date" "date",
    "due_date" "date",
    "pending_plan" "text",
    "pending_extra_member_packs" integer,
    "mp_preapproval_id" "text",
    "subscription_status" "text",
    "baptized_enabled" boolean DEFAULT true NOT NULL,
    "sessions_invalidated_at" timestamp with time zone,
    "daily_verse_enabled" boolean DEFAULT true NOT NULL,
    "daily_verse_version" "text" DEFAULT 'RVR1960'::"text" NOT NULL
);


ALTER TABLE "public"."companies" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."companies_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."companies_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."companies_id_seq" OWNED BY "public"."companies"."id";



CREATE TABLE IF NOT EXISTS "public"."company_badges" (
    "id" bigint NOT NULL,
    "company_id" bigint NOT NULL,
    "badge_id" bigint NOT NULL,
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text"
);


ALTER TABLE "public"."company_badges" OWNER TO "postgres";


ALTER TABLE "public"."company_badges" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."company_badges_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."company_roles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."company_roles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."db_version" (
    "id" integer NOT NULL,
    "version" character varying(50) NOT NULL,
    "environment" character varying(20) NOT NULL,
    "applied_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."db_version" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."db_version_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."db_version_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."db_version_id_seq" OWNED BY "public"."db_version"."id";



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "classes" "text"[] DEFAULT ARRAY[]::"text"[],
    "name" "text",
    "company_id" bigint DEFAULT 1,
    "activity_days" smallint[] DEFAULT '{}'::smallint[] NOT NULL
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


COMMENT ON COLUMN "public"."departments"."activity_days" IS 'Días de la semana con actividad (0=Domingo .. 6=Sábado).';



CREATE TABLE IF NOT EXISTS "public"."director_class_access" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "director_id" "uuid" NOT NULL,
    "class_name" "text" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."director_class_access" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "date" "date" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "time" "text",
    "departamento" "text",
    "solicitud" boolean,
    "estado" "text",
    "solicitante" "uuid",
    "motivoRechazo" "text",
    "end_date" "date",
    "end_time" "text",
    "company_id" bigint DEFAULT 1
);


ALTER TABLE "public"."events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."maintenance_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "description" "text",
    "location" "text",
    "status" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "priority" "text" DEFAULT 'normal'::"text" NOT NULL,
    "requested_by" "uuid",
    "requester_name" "text",
    "company_id" integer,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "maintenance_requests_priority_check" CHECK (("priority" = ANY (ARRAY['baja'::"text", 'normal'::"text", 'alta'::"text"]))),
    CONSTRAINT "maintenance_requests_status_check" CHECK (("status" = ANY (ARRAY['pendiente'::"text", 'en_proceso'::"text", 'terminado'::"text", 'anulado'::"text"])))
);


ALTER TABLE "public"."maintenance_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."material_didactico" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint DEFAULT 1 NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "file_url" "text" NOT NULL,
    "age_range" "text" NOT NULL,
    "department_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "file_size" bigint,
    "storage_provider" "text" DEFAULT 'supabase'::"text" NOT NULL,
    CONSTRAINT "material_didactico_storage_provider_check" CHECK (("storage_provider" = ANY (ARRAY['supabase'::"text", 'r2'::"text"])))
);


ALTER TABLE "public"."material_didactico" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_broadcasts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "sent_by" "uuid",
    "channel" "text" NOT NULL,
    "title" "text",
    "message" "text" NOT NULL,
    "link" "text",
    "target_type" "text" NOT NULL,
    "target_label" "text" NOT NULL,
    "recipients" integer DEFAULT 0 NOT NULL,
    "push_sent" integer DEFAULT 0 NOT NULL,
    "wa_sent" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "email_sent" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."notification_broadcasts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" bigint NOT NULL,
    "company_id" bigint NOT NULL,
    "amount" numeric NOT NULL,
    "currency" "text" DEFAULT 'ARS'::"text" NOT NULL,
    "billing_cycle" "text",
    "period_start" "date",
    "period_end" "date",
    "source" "text" DEFAULT 'manual'::"text" NOT NULL,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "mp_payment_id" "text"
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


ALTER TABLE "public"."payments" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."payments_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."plans" (
    "value" "text" NOT NULL,
    "label" "text" NOT NULL,
    "member_limit" integer,
    "price_monthly" numeric DEFAULT 0 NOT NULL,
    "pack_price_monthly" numeric DEFAULT 0 NOT NULL,
    "sort" integer DEFAULT 0 NOT NULL
);


ALTER TABLE "public"."plans" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "first_name" "text",
    "last_name" "text",
    "role" "public"."app_role" DEFAULT 'maestro'::"public"."app_role" NOT NULL,
    "assigned_class" "text",
    "departments" "text"[],
    "department_id" "uuid",
    "email" "text",
    "phone" "text",
    "last_active_at" timestamp with time zone DEFAULT "now"(),
    "birthdate" "date",
    "gender" "text",
    "address" "text",
    "document_number" "text",
    "is_member" boolean DEFAULT false,
    "roles" "text"[] DEFAULT ARRAY[]::"text"[],
    "company_id" bigint DEFAULT 1,
    "assignments" "jsonb" DEFAULT '[]'::"jsonb",
    "photo_url" "text",
    "completed_tours" "text"[] DEFAULT ARRAY[]::"text"[],
    "baptized" boolean DEFAULT false NOT NULL,
    "suspended" boolean DEFAULT false NOT NULL,
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['masculino'::"text", 'femenino'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."small_group_attendance" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "meeting_id" "uuid" NOT NULL,
    "member_id" "uuid" NOT NULL,
    "present" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."small_group_attendance" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."small_group_meetings" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "group_id" "uuid" NOT NULL,
    "meeting_date" "date" NOT NULL,
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."small_group_meetings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."small_group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "group_id" "uuid" NOT NULL,
    "student_id" "uuid",
    "profile_id" "uuid",
    "role_in_group" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "requested_at" timestamp with time zone,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "small_group_members_leader_needs_profile" CHECK ((("role_in_group" = 'member'::"text") OR ("profile_id" IS NOT NULL))),
    CONSTRAINT "small_group_members_one_person" CHECK (((("student_id" IS NOT NULL) AND ("profile_id" IS NULL)) OR (("student_id" IS NULL) AND ("profile_id" IS NOT NULL)))),
    CONSTRAINT "small_group_members_role_in_group_check" CHECK (("role_in_group" = ANY (ARRAY['leader'::"text", 'co_leader'::"text", 'member'::"text"]))),
    CONSTRAINT "small_group_members_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'active'::"text", 'rejected'::"text", 'left'::"text"])))
);


ALTER TABLE "public"."small_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."small_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "category" "text",
    "requires_approval" boolean DEFAULT true NOT NULL,
    "capacity" integer,
    "frequency" "text",
    "weekday" integer,
    "meeting_time" time without time zone,
    "location" "text",
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "department_id" "uuid",
    CONSTRAINT "small_groups_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'inactive'::"text", 'archived'::"text"]))),
    CONSTRAINT "small_groups_weekday_check" CHECK ((("weekday" >= 0) AND ("weekday" <= 6)))
);


ALTER TABLE "public"."small_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."staff_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_by" "uuid",
    "target_user_id" "uuid",
    "report" "text" NOT NULL,
    "department" "text",
    "assigned_class" "text",
    "company_id" bigint,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "is_read" boolean DEFAULT false
);


ALTER TABLE "public"."staff_reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_absence_notifications" (
    "id" bigint NOT NULL,
    "company_id" bigint NOT NULL,
    "student_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "streak_start_date" "date" NOT NULL,
    "notified_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."student_absence_notifications" OWNER TO "postgres";


ALTER TABLE "public"."student_absence_notifications" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."student_absence_notifications_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."student_authorizations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid",
    "department_id" "uuid",
    "class" "text",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()),
    "company_id" bigint DEFAULT 1
);


ALTER TABLE "public"."student_authorizations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "department_id" "uuid" NOT NULL,
    "assigned_class" "text",
    "role_in_dept" "text" DEFAULT 'alumno'::"text" NOT NULL,
    "company_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."student_departments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "student_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid",
    "actor_name" "text",
    "department_id" "uuid",
    "detail" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "student_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['alta'::"text", 'baja'::"text", 'reactivacion'::"text", 'vinculacion'::"text", 'cambio_departamento'::"text", 'desvinculacion'::"text", 'promocion'::"text", 'fusion'::"text", 'edicion'::"text", 'bautismo'::"text"])))
);


ALTER TABLE "public"."student_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."student_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "student_id" "uuid" NOT NULL,
    "observation" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "profile_id" "uuid",
    "company_id" bigint DEFAULT 1,
    "department_id" "uuid"
);


ALTER TABLE "public"."student_observations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."topic_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" integer NOT NULL,
    "department_id" "uuid",
    "assigned_class" "text",
    "created_by" "uuid",
    "fecha" "date" NOT NULL,
    "tema" "text",
    "base_biblica" "text",
    "ensenanza_principal" "text",
    "versiculo_memorizar" "text",
    "actividad_practica" "text",
    "estadistica_total" integer,
    "estadistica_presentes_regulares" integer,
    "estadistica_presentes_nuevos" integer,
    "estadistica_ausentes" integer,
    "firma" "text",
    "observaciones" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."topic_records" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "company_id" bigint NOT NULL,
    "profile_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "body" "text" NOT NULL,
    "link" "text",
    "type" "text" DEFAULT 'general'::"text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."usuarios_tokens_fcm" (
    "id" integer NOT NULL,
    "usuario_id" "uuid" NOT NULL,
    "token" character varying(500) NOT NULL,
    "plataforma" character varying(20) DEFAULT 'web'::character varying,
    "user_agent" "text",
    "id_local" integer,
    "company_id" bigint,
    "activo" boolean DEFAULT true,
    "fecha_registro" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "role" character varying
);


ALTER TABLE "public"."usuarios_tokens_fcm" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."usuarios_tokens_fcm_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE "public"."usuarios_tokens_fcm_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."usuarios_tokens_fcm_id_seq" OWNED BY "public"."usuarios_tokens_fcm"."id";



CREATE TABLE IF NOT EXISTS "public"."whatsapp_sessions" (
    "file_id" "text" NOT NULL,
    "content" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."whatsapp_sessions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."companies" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."companies_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."db_version" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."db_version_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."usuarios_tokens_fcm" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."usuarios_tokens_fcm_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."accounting_opening_balances"
    ADD CONSTRAINT "accounting_opening_balances_pkey" PRIMARY KEY ("company_id", "department_id");



ALTER TABLE ONLY "public"."accounting_transactions"
    ADD CONSTRAINT "accounting_transactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_event_id_key" UNIQUE ("student_id", "event_id");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."badges"
    ADD CONSTRAINT "badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."class_events"
    ADD CONSTRAINT "class_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_badges"
    ADD CONSTRAINT "company_badges_company_id_badge_id_key" UNIQUE ("company_id", "badge_id");



ALTER TABLE ONLY "public"."company_badges"
    ADD CONSTRAINT "company_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."db_version"
    ADD CONSTRAINT "db_version_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."director_class_access"
    ADD CONSTRAINT "director_class_access_director_id_class_name_department_id_key" UNIQUE ("director_id", "class_name", "department_id");



ALTER TABLE ONLY "public"."director_class_access"
    ADD CONSTRAINT "director_class_access_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."material_didactico"
    ADD CONSTRAINT "material_didactico_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plans"
    ADD CONSTRAINT "plans_pkey" PRIMARY KEY ("value");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."small_group_attendance"
    ADD CONSTRAINT "small_group_attendance_meeting_id_member_id_key" UNIQUE ("meeting_id", "member_id");



ALTER TABLE ONLY "public"."small_group_attendance"
    ADD CONSTRAINT "small_group_attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."small_group_meetings"
    ADD CONSTRAINT "small_group_meetings_group_id_meeting_date_key" UNIQUE ("group_id", "meeting_date");



ALTER TABLE ONLY "public"."small_group_meetings"
    ADD CONSTRAINT "small_group_meetings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."small_groups"
    ADD CONSTRAINT "small_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_absence_notifications"
    ADD CONSTRAINT "student_absence_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_absence_notifications"
    ADD CONSTRAINT "student_absence_notifications_student_id_department_id_key" UNIQUE ("student_id", "department_id");



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_student_id_department_id_key" UNIQUE ("student_id", "department_id");



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_student_dept_role_key" UNIQUE ("student_id", "department_id", "role_in_dept");



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."topic_records"
    ADD CONSTRAINT "topic_records_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_tokens_fcm"
    ADD CONSTRAINT "usuarios_tokens_fcm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_tokens_fcm"
    ADD CONSTRAINT "usuarios_tokens_fcm_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("file_id");



CREATE INDEX "idx_accounting_tx_class" ON "public"."accounting_transactions" USING "btree" ("company_id", "department_id", "assigned_class");



CREATE INDEX "idx_accounting_tx_company_dept_date" ON "public"."accounting_transactions" USING "btree" ("company_id", "department_id", "movement_date");



CREATE INDEX "idx_attendance_company_date" ON "public"."attendance" USING "btree" ("company_id", "date");



CREATE INDEX "idx_attendance_company_dept" ON "public"."attendance" USING "btree" ("company_id", "department_id");



CREATE INDEX "idx_attendance_date" ON "public"."attendance" USING "btree" ("date");



CREATE INDEX "idx_attendance_student" ON "public"."attendance" USING "btree" ("student_id");



CREATE INDEX "idx_class_events_company_date" ON "public"."class_events" USING "btree" ("company_id", "date");



CREATE UNIQUE INDEX "idx_class_events_unico" ON "public"."class_events" USING "btree" ("company_id", "department_id", COALESCE("assigned_class", ''::"text"), "date");



CREATE INDEX "idx_company_badges_company" ON "public"."company_badges" USING "btree" ("company_id");



CREATE UNIQUE INDEX "idx_company_roles_unico" ON "public"."company_roles" USING "btree" ("company_id", "key");



CREATE INDEX "idx_empresa" ON "public"."usuarios_tokens_fcm" USING "btree" ("company_id");



CREATE INDEX "idx_local" ON "public"."usuarios_tokens_fcm" USING "btree" ("id_local");



CREATE INDEX "idx_notification_broadcasts_company" ON "public"."notification_broadcasts" USING "btree" ("company_id", "created_at" DESC);



CREATE INDEX "idx_payments_company" ON "public"."payments" USING "btree" ("company_id");



CREATE INDEX "idx_profiles_company_suspended" ON "public"."profiles" USING "btree" ("company_id") WHERE "suspended";



CREATE INDEX "idx_sg_members_company_group_status" ON "public"."small_group_members" USING "btree" ("company_id", "group_id", "status");



CREATE INDEX "idx_sg_members_profile_status" ON "public"."small_group_members" USING "btree" ("profile_id", "status");



CREATE INDEX "idx_small_group_attendance_company" ON "public"."small_group_attendance" USING "btree" ("company_id");



CREATE INDEX "idx_small_group_attendance_meeting" ON "public"."small_group_attendance" USING "btree" ("meeting_id");



CREATE INDEX "idx_small_group_meetings_company" ON "public"."small_group_meetings" USING "btree" ("company_id");



CREATE INDEX "idx_small_group_meetings_group" ON "public"."small_group_meetings" USING "btree" ("group_id");



CREATE INDEX "idx_small_group_members_company" ON "public"."small_group_members" USING "btree" ("company_id");



CREATE INDEX "idx_small_group_members_group" ON "public"."small_group_members" USING "btree" ("group_id");



CREATE INDEX "idx_small_group_members_profile" ON "public"."small_group_members" USING "btree" ("profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE INDEX "idx_small_group_members_student" ON "public"."small_group_members" USING "btree" ("student_id") WHERE ("student_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_small_group_members_unique_profile" ON "public"."small_group_members" USING "btree" ("group_id", "profile_id") WHERE ("profile_id" IS NOT NULL);



CREATE UNIQUE INDEX "idx_small_group_members_unique_student" ON "public"."small_group_members" USING "btree" ("group_id", "student_id") WHERE ("student_id" IS NOT NULL);



CREATE INDEX "idx_small_groups_company" ON "public"."small_groups" USING "btree" ("company_id");



CREATE INDEX "idx_small_groups_department" ON "public"."small_groups" USING "btree" ("department_id");



CREATE INDEX "idx_student_absence_notifications_company" ON "public"."student_absence_notifications" USING "btree" ("company_id");



CREATE INDEX "idx_student_authorizations_dept_class" ON "public"."student_authorizations" USING "btree" ("department_id", "class", "company_id");



CREATE INDEX "idx_student_authorizations_student" ON "public"."student_authorizations" USING "btree" ("student_id");



CREATE INDEX "idx_student_departments_company_dept" ON "public"."student_departments" USING "btree" ("company_id", "department_id");



CREATE INDEX "idx_student_departments_student" ON "public"."student_departments" USING "btree" ("student_id", "department_id");



CREATE INDEX "idx_student_events_student" ON "public"."student_events" USING "btree" ("company_id", "student_id", "occurred_at" DESC);



CREATE INDEX "idx_student_events_type" ON "public"."student_events" USING "btree" ("company_id", "event_type", "occurred_at" DESC);



CREATE INDEX "idx_student_observations_department_id" ON "public"."student_observations" USING "btree" ("department_id");



CREATE INDEX "idx_student_observations_student" ON "public"."student_observations" USING "btree" ("student_id");



CREATE INDEX "idx_students_company_deleted_at" ON "public"."students" USING "btree" ("company_id", "deleted_at" DESC) WHERE ("deleted_at" IS NOT NULL);



CREATE INDEX "idx_students_company_dept" ON "public"."students" USING "btree" ("company_id", "department_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_students_deleted_at" ON "public"."students" USING "btree" ("deleted_at");



CREATE INDEX "idx_students_profile_id" ON "public"."students" USING "btree" ("profile_id");



CREATE INDEX "idx_token" ON "public"."usuarios_tokens_fcm" USING "btree" ("token");



CREATE INDEX "idx_user_notifications_company" ON "public"."user_notifications" USING "btree" ("company_id");



CREATE INDEX "idx_user_notifications_profile" ON "public"."user_notifications" USING "btree" ("profile_id", "created_at" DESC);



CREATE INDEX "idx_usuario" ON "public"."usuarios_tokens_fcm" USING "btree" ("usuario_id");



CREATE INDEX "students_document_number_idx" ON "public"."students" USING "btree" ("document_number");



CREATE INDEX "topic_records_company_id_idx" ON "public"."topic_records" USING "btree" ("company_id");



CREATE INDEX "topic_records_created_by_idx" ON "public"."topic_records" USING "btree" ("created_by");



CREATE INDEX "topic_records_department_id_idx" ON "public"."topic_records" USING "btree" ("department_id");



CREATE INDEX "topic_records_fecha_idx" ON "public"."topic_records" USING "btree" ("fecha" DESC);



CREATE UNIQUE INDEX "uq_payments_mp" ON "public"."payments" USING "btree" ("mp_payment_id") WHERE ("mp_payment_id" IS NOT NULL);



CREATE OR REPLACE TRIGGER "notificar_eventos" AFTER INSERT OR UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://ccdt-back.onrender.com/api/webhooks/supabase/events', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "on_profile_updated" AFTER UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."sync_profile_to_student"();



CREATE OR REPLACE TRIGGER "saludo_bienvenida" AFTER INSERT OR UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "supabase_functions"."http_request"('https://ccdt-back.onrender.com/api/webhooks/supabase/profiles', 'POST', '{"Content-type":"application/json"}', '{}', '5000');



CREATE OR REPLACE TRIGGER "set_timestamp" BEFORE UPDATE ON "public"."student_authorizations" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_maintenance_updated_at" BEFORE UPDATE ON "public"."maintenance_requests" FOR EACH ROW EXECUTE FUNCTION "public"."update_maintenance_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_fecha_actualizacion" BEFORE UPDATE ON "public"."usuarios_tokens_fcm" FOR EACH ROW EXECUTE FUNCTION "public"."update_fecha_actualizacion"();



CREATE OR REPLACE TRIGGER "update_attendance_updated_at" BEFORE UPDATE ON "public"."attendance" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_companies_updated_at" BEFORE UPDATE ON "public"."companies" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_departments_updated_at" BEFORE UPDATE ON "public"."departments" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_events_updated_at" BEFORE UPDATE ON "public"."events" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



CREATE OR REPLACE TRIGGER "update_students_updated_at" BEFORE UPDATE ON "public"."students" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."accounting_opening_balances"
    ADD CONSTRAINT "accounting_opening_balances_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."accounting_opening_balances"
    ADD CONSTRAINT "accounting_opening_balances_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_transactions"
    ADD CONSTRAINT "accounting_transactions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."accounting_transactions"
    ADD CONSTRAINT "accounting_transactions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_events"
    ADD CONSTRAINT "class_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."class_events"
    ADD CONSTRAINT "class_events_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."class_events"
    ADD CONSTRAINT "class_events_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_badges"
    ADD CONSTRAINT "company_badges_badge_id_fkey" FOREIGN KEY ("badge_id") REFERENCES "public"."badges"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_badges"
    ADD CONSTRAINT "company_badges_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."company_roles"
    ADD CONSTRAINT "company_roles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."director_class_access"
    ADD CONSTRAINT "director_class_access_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."director_class_access"
    ADD CONSTRAINT "director_class_access_director_id_fkey" FOREIGN KEY ("director_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."maintenance_requests"
    ADD CONSTRAINT "maintenance_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."material_didactico"
    ADD CONSTRAINT "material_didactico_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."material_didactico"
    ADD CONSTRAINT "material_didactico_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."material_didactico"
    ADD CONSTRAINT "material_didactico_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."notification_broadcasts"
    ADD CONSTRAINT "notification_broadcasts_sent_by_fkey" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_attendance"
    ADD CONSTRAINT "small_group_attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_attendance"
    ADD CONSTRAINT "small_group_attendance_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "public"."small_group_meetings"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_attendance"
    ADD CONSTRAINT "small_group_attendance_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "public"."small_group_members"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_meetings"
    ADD CONSTRAINT "small_group_meetings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_meetings"
    ADD CONSTRAINT "small_group_meetings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."small_group_meetings"
    ADD CONSTRAINT "small_group_meetings_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."small_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."small_groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_group_members"
    ADD CONSTRAINT "small_group_members_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_groups"
    ADD CONSTRAINT "small_groups_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."small_groups"
    ADD CONSTRAINT "small_groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."small_groups"
    ADD CONSTRAINT "small_groups_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_absence_notifications"
    ADD CONSTRAINT "student_absence_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_absence_notifications"
    ADD CONSTRAINT "student_absence_notifications_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_absence_notifications"
    ADD CONSTRAINT "student_absence_notifications_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_events"
    ADD CONSTRAINT "student_events_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."topic_records"
    ADD CONSTRAINT "topic_records_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."topic_records"
    ADD CONSTRAINT "topic_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."topic_records"
    ADD CONSTRAINT "topic_records_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_notifications"
    ADD CONSTRAINT "user_notifications_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."usuarios_tokens_fcm"
    ADD CONSTRAINT "usuarios_tokens_fcm_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



CREATE POLICY "Admin can delete maintenance requests" ON "public"."maintenance_requests" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'secretaria'::"public"."app_role"]))))));



CREATE POLICY "Admins and directors can delete materials" ON "public"."material_didactico" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."company_id" = "material_didactico"."company_id") AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'director'::"public"."app_role", 'director_general'::"public"."app_role", 'vicedirector'::"public"."app_role", 'secretaria'::"public"."app_role"]))))));



CREATE POLICY "Admins can update any profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles" "profiles_1"
  WHERE (("profiles_1"."id" = "auth"."uid"()) AND ("profiles_1"."role" = 'admin'::"public"."app_role")))));



CREATE POLICY "Allow authenticated users to delete their own observations" ON "public"."student_observations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow authenticated users to insert observations" ON "public"."student_observations" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Allow authenticated users to read observations" ON "public"."student_observations" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Allow authenticated users to update their own observations" ON "public"."student_observations" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "created_by"));



CREATE POLICY "Allow service_role full access" ON "public"."whatsapp_sessions" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Allow user registration" ON "public"."profiles" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Authorized roles can upload materials" ON "public"."material_didactico" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."company_id" = "material_didactico"."company_id") AND ("profiles"."role" = ANY (ARRAY['admin'::"public"."app_role", 'director'::"public"."app_role", 'director_general'::"public"."app_role", 'vicedirector'::"public"."app_role", 'secretaria'::"public"."app_role"]))))));



CREATE POLICY "Conserje and admin can update maintenance requests" ON "public"."maintenance_requests" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = ANY (ARRAY['conserje'::"public"."app_role", 'admin'::"public"."app_role", 'secretaria'::"public"."app_role"]))))));



CREATE POLICY "Enable delete access for all users" ON "public"."events" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Enable delete access for all users" ON "public"."students" FOR DELETE TO "anon" USING (true);



CREATE POLICY "Enable insert access for all users" ON "public"."events" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable insert access for all users" ON "public"."students" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Enable insert for authenticated users only" ON "public"."attendance" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Enable read access for all users" ON "public"."attendance" FOR SELECT USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."events" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable read access for all users" ON "public"."students" FOR SELECT TO "anon" USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."events" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Enable update access for all users" ON "public"."students" FOR UPDATE TO "anon" USING (true);



CREATE POLICY "Enable update for authenticated users only" ON "public"."attendance" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Profiles are viewable by authenticated users" ON "public"."profiles" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Users can create maintenance requests" ON "public"."maintenance_requests" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can insert their own profile" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can soft delete students" ON "public"."students" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Users can update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"()));



CREATE POLICY "Users can view company maintenance requests" ON "public"."maintenance_requests" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



CREATE POLICY "Users can view materials of their company" ON "public"."material_didactico" FOR SELECT USING (("company_id" = ( SELECT "profiles"."company_id"
   FROM "public"."profiles"
  WHERE ("profiles"."id" = "auth"."uid"()))));



ALTER TABLE "public"."accounting_opening_balances" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."accounting_transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_access" ON "public"."student_departments" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."class_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."company_roles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."material_didactico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_broadcasts" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "read own notifications" ON "public"."user_notifications" FOR SELECT USING (("auth"."uid"() = "profile_id"));



ALTER TABLE "public"."student_absence_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."student_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."topic_records" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "topic_records_all" ON "public"."topic_records" USING (true) WITH CHECK (true);



CREATE POLICY "topic_records_service_only" ON "public"."topic_records" USING (true) WITH CHECK (true);



GRANT USAGE ON SCHEMA "api" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "api"."asistencia_cobertura"("p_company_id" integer, "p_fecha" "text", "p_department_id" "uuid", "p_department_names" "text"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."asistencia_cobertura"("p_company_id" integer, "p_fecha" "text", "p_department_id" "uuid", "p_department_names" "text"[]) TO "service_role";



REVOKE ALL ON FUNCTION "api"."asistencia_eventos_listar"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."asistencia_eventos_listar"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") TO "service_role";



REVOKE ALL ON FUNCTION "api"."asistencia_matriz"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."asistencia_matriz"("p_company_id" integer, "p_start" "text", "p_end" "text", "p_department_id" "uuid", "p_department_names" "text"[], "p_assigned_class" "text") TO "service_role";



REVOKE ALL ON FUNCTION "api"."contabilidad_balance"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."contabilidad_balance"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") TO "service_role";



REVOKE ALL ON FUNCTION "api"."contabilidad_por_motivo"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."contabilidad_por_motivo"("p_company_id" integer, "p_department_id" "uuid", "p_from" "date", "p_to" "date", "p_assigned_class" "text") TO "service_role";



REVOKE ALL ON FUNCTION "api"."departamento_eliminar"("p_company_id" integer, "p_department_id" "uuid", "p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."departamento_eliminar"("p_company_id" integer, "p_department_id" "uuid", "p_dry_run" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "api"."estadisticas_resumen"("p_company_id" integer, "p_department_id" "uuid", "p_department_ids" "uuid"[], "p_assigned_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."estadisticas_resumen"("p_company_id" integer, "p_department_id" "uuid", "p_department_ids" "uuid"[], "p_assigned_class" "text") TO "service_role";



REVOKE ALL ON FUNCTION "api"."grupos_listar"("p_company_id" integer, "p_status" "text", "p_profile_id" "uuid", "p_department_ids" "uuid"[], "p_global" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."grupos_listar"("p_company_id" integer, "p_status" "text", "p_profile_id" "uuid", "p_department_ids" "uuid"[], "p_global" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "api"."miembro_linea_tiempo"("p_company_id" integer, "p_student_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."miembro_linea_tiempo"("p_company_id" integer, "p_student_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "api"."miembros_archivados"("p_company_id" integer, "p_search" "text", "p_department_id" "uuid", "p_desde" "date", "p_hasta" "date", "p_limit" integer, "p_offset" integer) FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."miembros_archivados"("p_company_id" integer, "p_search" "text", "p_department_id" "uuid", "p_desde" "date", "p_hasta" "date", "p_limit" integer, "p_offset" integer) TO "service_role";



REVOKE ALL ON FUNCTION "api"."miembros_fusionar"("p_company_id" integer, "p_source_id" "uuid", "p_target_id" "uuid", "p_dry_run" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "api"."miembros_fusionar"("p_company_id" integer, "p_source_id" "uuid", "p_target_id" "uuid", "p_dry_run" boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."get_environment"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_environment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_environment"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text", "p_scope_department_ids" "uuid"[], "p_scope_class" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text", "p_scope_department_ids" "uuid"[], "p_scope_class" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_profile_to_student"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_profile_to_student"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_profile_to_student"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_department_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_department_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_department_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fecha_actualizacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_maintenance_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_maintenance_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_maintenance_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_pushalert_timestamp"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_pushalert_timestamp"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_pushalert_timestamp"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON TABLE "public"."accounting_opening_balances" TO "anon";
GRANT ALL ON TABLE "public"."accounting_opening_balances" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_opening_balances" TO "service_role";



GRANT ALL ON TABLE "public"."accounting_transactions" TO "anon";
GRANT ALL ON TABLE "public"."accounting_transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."accounting_transactions" TO "service_role";



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."active_students" TO "anon";
GRANT ALL ON TABLE "public"."active_students" TO "authenticated";
GRANT ALL ON TABLE "public"."active_students" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."badges" TO "anon";
GRANT ALL ON TABLE "public"."badges" TO "authenticated";
GRANT ALL ON TABLE "public"."badges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."badges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."class_events" TO "anon";
GRANT ALL ON TABLE "public"."class_events" TO "authenticated";
GRANT ALL ON TABLE "public"."class_events" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company_badges" TO "anon";
GRANT ALL ON TABLE "public"."company_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."company_badges" TO "service_role";



GRANT ALL ON SEQUENCE "public"."company_badges_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."company_badges_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."company_badges_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."company_roles" TO "anon";
GRANT ALL ON TABLE "public"."company_roles" TO "authenticated";
GRANT ALL ON TABLE "public"."company_roles" TO "service_role";



GRANT ALL ON TABLE "public"."db_version" TO "anon";
GRANT ALL ON TABLE "public"."db_version" TO "authenticated";
GRANT ALL ON TABLE "public"."db_version" TO "service_role";



GRANT ALL ON SEQUENCE "public"."db_version_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."db_version_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."db_version_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."departments" TO "anon";
GRANT ALL ON TABLE "public"."departments" TO "authenticated";
GRANT ALL ON TABLE "public"."departments" TO "service_role";



GRANT ALL ON TABLE "public"."director_class_access" TO "anon";
GRANT ALL ON TABLE "public"."director_class_access" TO "authenticated";
GRANT ALL ON TABLE "public"."director_class_access" TO "service_role";



GRANT ALL ON TABLE "public"."events" TO "anon";
GRANT ALL ON TABLE "public"."events" TO "authenticated";
GRANT ALL ON TABLE "public"."events" TO "service_role";



GRANT ALL ON TABLE "public"."maintenance_requests" TO "anon";
GRANT ALL ON TABLE "public"."maintenance_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."maintenance_requests" TO "service_role";



GRANT ALL ON TABLE "public"."material_didactico" TO "anon";
GRANT ALL ON TABLE "public"."material_didactico" TO "authenticated";
GRANT ALL ON TABLE "public"."material_didactico" TO "service_role";



GRANT ALL ON TABLE "public"."notification_broadcasts" TO "anon";
GRANT ALL ON TABLE "public"."notification_broadcasts" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_broadcasts" TO "service_role";



GRANT ALL ON TABLE "public"."payments" TO "anon";
GRANT ALL ON TABLE "public"."payments" TO "authenticated";
GRANT ALL ON TABLE "public"."payments" TO "service_role";



GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."payments_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."plans" TO "anon";
GRANT ALL ON TABLE "public"."plans" TO "authenticated";
GRANT ALL ON TABLE "public"."plans" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."small_group_attendance" TO "anon";
GRANT ALL ON TABLE "public"."small_group_attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."small_group_attendance" TO "service_role";



GRANT ALL ON TABLE "public"."small_group_meetings" TO "anon";
GRANT ALL ON TABLE "public"."small_group_meetings" TO "authenticated";
GRANT ALL ON TABLE "public"."small_group_meetings" TO "service_role";



GRANT ALL ON TABLE "public"."small_group_members" TO "anon";
GRANT ALL ON TABLE "public"."small_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."small_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."small_groups" TO "anon";
GRANT ALL ON TABLE "public"."small_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."small_groups" TO "service_role";



GRANT ALL ON TABLE "public"."staff_reports" TO "anon";
GRANT ALL ON TABLE "public"."staff_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_reports" TO "service_role";



GRANT ALL ON TABLE "public"."student_absence_notifications" TO "anon";
GRANT ALL ON TABLE "public"."student_absence_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."student_absence_notifications" TO "service_role";



GRANT ALL ON SEQUENCE "public"."student_absence_notifications_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."student_absence_notifications_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."student_absence_notifications_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."student_authorizations" TO "anon";
GRANT ALL ON TABLE "public"."student_authorizations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_authorizations" TO "service_role";



GRANT ALL ON TABLE "public"."student_departments" TO "anon";
GRANT ALL ON TABLE "public"."student_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."student_departments" TO "service_role";



GRANT ALL ON TABLE "public"."student_events" TO "service_role";



GRANT ALL ON TABLE "public"."student_observations" TO "anon";
GRANT ALL ON TABLE "public"."student_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_observations" TO "service_role";



GRANT ALL ON TABLE "public"."topic_records" TO "anon";
GRANT ALL ON TABLE "public"."topic_records" TO "authenticated";
GRANT ALL ON TABLE "public"."topic_records" TO "service_role";



GRANT ALL ON TABLE "public"."user_notifications" TO "anon";
GRANT ALL ON TABLE "public"."user_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."user_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "service_role";



GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "api" GRANT ALL ON FUNCTIONS  TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS  TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES  TO "service_role";






