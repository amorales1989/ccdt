-- SP: get_students
-- Reemplaza el controller getAll que hacía múltiples queries + N+1 calls a auth.admin.getUserById
-- Parámetros opcionales: pasar NULL para ignorar el filtro
CREATE OR REPLACE FUNCTION get_students(
  p_company_id     integer,
  p_department_id  uuid    DEFAULT NULL,
  p_assigned_class text    DEFAULT NULL,
  p_gender         text    DEFAULT NULL,
  p_search         text    DEFAULT NULL
)
RETURNS TABLE (
  id                       uuid,
  first_name               text,
  last_name                text,
  gender                   text,
  birthdate                date,
  phone                    text,
  address                  text,
  document_number          text,
  photo_url                text,
  assigned_class           text,
  department_id            uuid,
  department_name          text,
  profile_id               uuid,
  nuevo                    boolean,
  company_id               integer,
  created_at               timestamptz,
  is_authorized            boolean,
  active_enrollments_count bigint,
  dept_assignments         jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$

-- CTE 1: IDs válidos según filtro de departamento
WITH dept_ids AS (
  SELECT DISTINCT s.id AS student_id,
    COALESCE(sd.assigned_class, s.assigned_class) AS resolved_class
  FROM students s
  LEFT JOIN student_departments sd
    ON sd.student_id = s.id
    AND (p_department_id IS NULL OR sd.department_id = p_department_id)
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
),

-- CTE 2: Alumnos autorizados (solo cuando hay filtro dept+clase)
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

-- CTE 3: todos los IDs a devolver
all_ids AS (
  SELECT student_id FROM dept_ids
  UNION
  SELECT student_id FROM authorized_ids
),

-- CTE 4: dept_assignments agregados por alumno (sin llamadas a auth.users)
assignments AS (
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

-- CTE 5: conteo de inscripciones activas
enrollment_counts AS (
  SELECT student_id, COUNT(*) AS cnt
  FROM student_departments
  WHERE student_id IN (SELECT student_id FROM all_ids)
  GROUP BY student_id
)

SELECT
  s.id,
  s.first_name,
  s.last_name,
  s.gender,
  s.birthdate,
  s.phone,
  s.address,
  s.document_number,
  s.photo_url,
  COALESCE(di.resolved_class, s.assigned_class) AS assigned_class,
  s.department_id,
  dep.name AS department_name,
  s.profile_id,
  s.nuevo,
  s.company_id,
  s.created_at,
  (ai.student_id IS NOT NULL) AS is_authorized,
  COALESCE(ec.cnt, 0)          AS active_enrollments_count,
  COALESCE(asgn.dept_assignments, '[]'::jsonb) AS dept_assignments
FROM students s
JOIN all_ids ON all_ids.student_id = s.id
LEFT JOIN dept_ids di       ON di.student_id = s.id
LEFT JOIN authorized_ids ai ON ai.student_id = s.id
LEFT JOIN departments dep   ON dep.id = s.department_id
LEFT JOIN assignments asgn  ON asgn.student_id = s.id
LEFT JOIN enrollment_counts ec ON ec.student_id = s.id
WHERE s.deleted_at IS NULL
  AND s.company_id = p_company_id
  AND (p_gender IS NULL OR s.gender = p_gender)
  AND (
    p_search IS NULL
    OR s.first_name ILIKE '%' || p_search || '%'
    OR s.last_name  ILIKE '%' || p_search || '%'
  )
ORDER BY s.first_name;

$$;

-- Índices de soporte si no existen
CREATE INDEX IF NOT EXISTS idx_students_company_dept
  ON students(company_id, department_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_student_departments_student
  ON student_departments(student_id, department_id);

CREATE INDEX IF NOT EXISTS idx_student_authorizations_dept_class
  ON student_authorizations(department_id, class, company_id);
