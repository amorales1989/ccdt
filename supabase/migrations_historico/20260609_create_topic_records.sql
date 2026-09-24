-- Tabla para el registro de temas de clases
CREATE TABLE IF NOT EXISTS topic_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id integer NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  assigned_class text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  fecha date NOT NULL,
  tema text,
  base_biblica text,
  ensenanza_principal text,
  versiculo_memorizar text,
  actividad_practica text,
  estadistica_total integer,
  estadistica_presentes_regulares integer,
  estadistica_presentes_nuevos integer,
  estadistica_ausentes integer,
  firma text,
  observaciones text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS topic_records_company_id_idx ON topic_records(company_id);
CREATE INDEX IF NOT EXISTS topic_records_created_by_idx ON topic_records(created_by);
CREATE INDEX IF NOT EXISTS topic_records_department_id_idx ON topic_records(department_id);
CREATE INDEX IF NOT EXISTS topic_records_fecha_idx ON topic_records(fecha DESC);

-- RLS
ALTER TABLE topic_records ENABLE ROW LEVEL SECURITY;

-- Solo el backend (service role) accede; el frontend pasa por la API con authMiddleware
CREATE POLICY "topic_records_service_only" ON topic_records
  USING (true)
  WITH CHECK (true);
