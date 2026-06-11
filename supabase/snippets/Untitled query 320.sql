CREATE TABLE IF NOT EXISTS public.topic_records (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id integer NOT NULL,
  department_id uuid,
  assigned_class text,
  created_by uuid,
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

CREATE INDEX IF NOT EXISTS topic_records_company_id_idx ON public.topic_records(company_id);
CREATE INDEX IF NOT EXISTS topic_records_created_by_idx ON public.topic_records(created_by);
CREATE INDEX IF NOT EXISTS topic_records_department_id_idx ON public.topic_records(department_id);
CREATE INDEX IF NOT EXISTS topic_records_fecha_idx ON public.topic_records(fecha DESC);

ALTER TABLE public.topic_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_records_all" ON public.topic_records
  FOR ALL USING (true) WITH CHECK (true);