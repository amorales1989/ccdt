-- Días de la semana con actividad por departamento (0=Domingo .. 6=Sábado).
-- Se usa para sugerir por defecto la última fecha con actividad en la cobertura de asistencia.
alter table public.departments
  add column if not exists activity_days smallint[] not null default '{}'::smallint[];

comment on column public.departments.activity_days is
  'Días de la semana con actividad (0=Domingo .. 6=Sábado).';
