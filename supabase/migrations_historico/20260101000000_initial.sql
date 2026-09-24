

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
    'auxiliar_maestro'
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


CREATE OR REPLACE FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid" DEFAULT NULL::"uuid", "p_assigned_class" "text" DEFAULT NULL::"text", "p_gender" "text" DEFAULT NULL::"text", "p_search" "text" DEFAULT NULL::"text") RETURNS TABLE("id" "uuid", "first_name" "text", "last_name" "text", "gender" "text", "birthdate" "date", "phone" "text", "address" "text", "document_number" "text", "photo_url" "text", "assigned_class" "text", "department_id" "uuid", "department_name" "text", "profile_id" "uuid", "nuevo" boolean, "company_id" integer, "created_at" timestamp with time zone, "is_authorized" boolean, "active_enrollments_count" bigint, "dept_assignments" "jsonb")
    LANGUAGE "sql" STABLE SECURITY DEFINER
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
all_ids AS (
  SELECT student_id FROM dept_ids
  UNION
  SELECT student_id FROM authorized_ids
),
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
enrollment_counts AS (
  SELECT student_id, COUNT(*) AS cnt
  FROM student_departments
  WHERE student_id IN (SELECT student_id FROM all_ids)
  GROUP BY student_id
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
  s.company_id,
  s.created_at,
  (ai.student_id IS NOT NULL) AS is_authorized,
  COALESCE(ec.cnt, 0)          AS active_enrollments_count,
  COALESCE(asgn.dept_assignments, '[]'::jsonb) AS dept_assignments
FROM students s
JOIN all_ids ON all_ids.student_id = s.id
LEFT JOIN profiles p        ON p.id = s.profile_id
LEFT JOIN dept_ids di       ON di.student_id = s.id
LEFT JOIN authorized_ids ai ON ai.student_id = s.id
LEFT JOIN departments dep   ON dep.id = s.department_id
LEFT JOIN assignments asgn  ON asgn.student_id = s.id
LEFT JOIN enrollment_counts ec ON ec.student_id = s.id
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


ALTER FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text") OWNER TO "postgres";


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
    "master_password_hash" "text"
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
    "company_id" bigint DEFAULT 1
);


ALTER TABLE "public"."departments" OWNER TO "postgres";


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
    "file_size" bigint
);


ALTER TABLE "public"."material_didactico" OWNER TO "postgres";


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
    CONSTRAINT "profiles_gender_check" CHECK (("gender" = ANY (ARRAY['masculino'::"text", 'femenino'::"text"])))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


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



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_event_id_key" UNIQUE ("student_id", "event_id");



ALTER TABLE ONLY "public"."companies"
    ADD CONSTRAINT "companies_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_authorizations"
    ADD CONSTRAINT "student_authorizations_student_id_department_id_key" UNIQUE ("student_id", "department_id");



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."student_departments"
    ADD CONSTRAINT "student_departments_student_dept_role_key" UNIQUE ("student_id", "department_id", "role_in_dept");



ALTER TABLE ONLY "public"."student_observations"
    ADD CONSTRAINT "student_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."students"
    ADD CONSTRAINT "students_profile_id_key" UNIQUE ("profile_id");



ALTER TABLE ONLY "public"."usuarios_tokens_fcm"
    ADD CONSTRAINT "usuarios_tokens_fcm_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."usuarios_tokens_fcm"
    ADD CONSTRAINT "usuarios_tokens_fcm_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."whatsapp_sessions"
    ADD CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("file_id");



CREATE INDEX "idx_attendance_date" ON "public"."attendance" USING "btree" ("date");



CREATE INDEX "idx_empresa" ON "public"."usuarios_tokens_fcm" USING "btree" ("company_id");



CREATE INDEX "idx_local" ON "public"."usuarios_tokens_fcm" USING "btree" ("id_local");



CREATE INDEX "idx_student_authorizations_dept_class" ON "public"."student_authorizations" USING "btree" ("department_id", "class", "company_id");



CREATE INDEX "idx_student_departments_student" ON "public"."student_departments" USING "btree" ("student_id", "department_id");



CREATE INDEX "idx_student_observations_department_id" ON "public"."student_observations" USING "btree" ("department_id");



CREATE INDEX "idx_students_company_dept" ON "public"."students" USING "btree" ("company_id", "department_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_students_deleted_at" ON "public"."students" USING "btree" ("deleted_at");



CREATE INDEX "idx_students_profile_id" ON "public"."students" USING "btree" ("profile_id");



CREATE INDEX "idx_token" ON "public"."usuarios_tokens_fcm" USING "btree" ("token");



CREATE INDEX "idx_usuario" ON "public"."usuarios_tokens_fcm" USING "btree" ("usuario_id");



CREATE INDEX "students_document_number_idx" ON "public"."students" USING "btree" ("document_number");



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



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."attendance"
    ADD CONSTRAINT "attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."staff_reports"
    ADD CONSTRAINT "staff_reports_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;



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
    ADD CONSTRAINT "students_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



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



CREATE POLICY "auth_access" ON "public"."student_departments" TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."material_didactico" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."whatsapp_sessions" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."get_environment"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_environment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_environment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_students"("p_company_id" integer, "p_department_id" "uuid", "p_assigned_class" "text", "p_gender" "text", "p_search" "text") TO "service_role";



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



GRANT ALL ON TABLE "public"."students" TO "anon";
GRANT ALL ON TABLE "public"."students" TO "authenticated";
GRANT ALL ON TABLE "public"."students" TO "service_role";



GRANT ALL ON TABLE "public"."active_students" TO "anon";
GRANT ALL ON TABLE "public"."active_students" TO "authenticated";
GRANT ALL ON TABLE "public"."active_students" TO "service_role";



GRANT ALL ON TABLE "public"."attendance" TO "anon";
GRANT ALL ON TABLE "public"."attendance" TO "authenticated";
GRANT ALL ON TABLE "public"."attendance" TO "service_role";



GRANT ALL ON TABLE "public"."companies" TO "anon";
GRANT ALL ON TABLE "public"."companies" TO "authenticated";
GRANT ALL ON TABLE "public"."companies" TO "service_role";



GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."companies_id_seq" TO "service_role";



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



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."staff_reports" TO "anon";
GRANT ALL ON TABLE "public"."staff_reports" TO "authenticated";
GRANT ALL ON TABLE "public"."staff_reports" TO "service_role";



GRANT ALL ON TABLE "public"."student_authorizations" TO "anon";
GRANT ALL ON TABLE "public"."student_authorizations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_authorizations" TO "service_role";



GRANT ALL ON TABLE "public"."student_departments" TO "anon";
GRANT ALL ON TABLE "public"."student_departments" TO "authenticated";
GRANT ALL ON TABLE "public"."student_departments" TO "service_role";



GRANT ALL ON TABLE "public"."student_observations" TO "anon";
GRANT ALL ON TABLE "public"."student_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."student_observations" TO "service_role";



GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "anon";
GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "authenticated";
GRANT ALL ON TABLE "public"."usuarios_tokens_fcm" TO "service_role";



GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."usuarios_tokens_fcm_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "anon";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."whatsapp_sessions" TO "service_role";



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






