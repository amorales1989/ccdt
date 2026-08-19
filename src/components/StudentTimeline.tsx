import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getStudentTimeline, TimelineItem } from "@/lib/api";
import { labelMotivo } from "@/components/BajaMiembroDialog";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import {
  UserPlus,
  UserMinus,
  RotateCcw,
  ArrowRightLeft,
  ArrowUpCircle,
  Link2,
  Unlink,
  Merge,
  Pencil,
  Droplets,
  MessageSquare,
  FileCheck2,
  Users,
  CalendarCheck2,
  History,
  Clock,
} from "lucide-react";

interface StudentTimelineProps {
  studentId: string;
  className?: string;
}

const CAMPO_LABEL: Record<string, string> = {
  first_name: "Nombre",
  last_name: "Apellido",
  birthdate: "Fecha de nacimiento",
  gender: "Género",
  phone: "Teléfono",
  address: "Dirección",
  document_number: "DNI",
  assigned_class: "Clase",
  baptized: "Bautizado",
};

const campoLabel = (campo: string) => CAMPO_LABEL[campo] || campo;

const valorCorto = (v: unknown) => {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
};

type TipoStyle = {
  icon: React.ComponentType<{ className?: string }>;
  dot: string;
  chip: string;
};

const TIPO_STYLE: Record<TimelineItem["tipo"], TipoStyle> = {
  alta: { icon: UserPlus, dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" },
  reactivacion: { icon: RotateCcw, dot: "bg-emerald-500", chip: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400" },
  baja: { icon: UserMinus, dot: "bg-red-500", chip: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400" },
  cambio_departamento: { icon: ArrowRightLeft, dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400" },
  promocion: { icon: ArrowUpCircle, dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400" },
  vinculacion: { icon: Link2, dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400" },
  desvinculacion: { icon: Unlink, dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  fusion: { icon: Merge, dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  edicion: { icon: Pencil, dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  bautismo: { icon: Droplets, dot: "bg-sky-500", chip: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-400" },
  observacion: { icon: MessageSquare, dot: "bg-amber-500", chip: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400" },
  autorizacion: { icon: FileCheck2, dot: "bg-violet-500", chip: "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-400" },
  grupo_pequeno: { icon: Users, dot: "bg-indigo-500", chip: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-400" },
  asistencia_mes: { icon: CalendarCheck2, dot: "bg-slate-400", chip: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" },
};

const titulo = (item: TimelineItem): string => {
  const d = item.detalle || {};
  switch (item.tipo) {
    case "alta":
      return "Ingresó a la congregación";
    case "baja":
      return "Dado de baja";
    case "reactivacion":
      return "Volvió a la congregación";
    case "cambio_departamento":
      return "Cambio de departamento";
    case "promocion":
      return "Promoción de clase";
    case "vinculacion":
      return "Se sumó a un departamento";
    case "desvinculacion":
      return "Salió de un departamento";
    case "edicion":
      return "Se actualizaron sus datos";
    case "bautismo":
      return "Se bautizó";
    case "fusion":
      return "Ficha unificada con otra";
    case "observacion":
      return "Observación";
    case "autorizacion":
      return "Autorización firmada";
    case "grupo_pequeno":
      return `Grupo pequeño: ${d.grupo || ""}`;
    case "asistencia_mes":
      return format(parseISO(item.fecha), "MMMM yyyy", { locale: es });
    default:
      return item.tipo;
  }
};

const Descripcion = ({ item }: { item: TimelineItem }) => {
  const d = item.detalle || {};

  switch (item.tipo) {
    case "alta": {
      const depto = d.departamentos?.[0];
      return (
        <p>
          Se registró en <strong>{depto?.nombre || item.departamento || "la congregación"}</strong>
          {depto?.clase ? ` (clase ${depto.clase})` : ""}
        </p>
      );
    }
    case "baja": {
      const motivo = labelMotivo(d.motivo) || d.motivo;
      return (
        <div>
          <p>
            Dado de baja{motivo ? ` — ${motivo}` : ""}
          </p>
          {d.nota && <p className="text-muted-foreground italic mt-0.5">"{d.nota}"</p>}
        </div>
      );
    }
    case "reactivacion":
      return <p>Volvió a la congregación{d.departamento?.nombre ? ` en ${d.departamento.nombre}` : ""}</p>;
    case "cambio_departamento":
    case "promocion":
      return (
        <p>
          Pasó de <strong>{d.de?.nombre || "—"}</strong> a <strong>{d.a?.nombre || "—"}</strong>
        </p>
      );
    case "vinculacion": {
      const depto = d.departamentos?.[0];
      return <p>Se sumó a <strong>{depto?.nombre || item.departamento || "un departamento"}</strong></p>;
    }
    case "desvinculacion":
      return <p>Salió de <strong>{d.departamento || item.departamento || "un departamento"}</strong></p>;
    case "edicion": {
      const cambios = d.cambios || {};
      const entries = Object.entries(cambios);
      return (
        <div>
          <p>Se actualizaron sus datos</p>
          {entries.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {entries.map(([campo, val]) => {
                const cambio = val as { de?: unknown; a?: unknown };
                return (
                  <li key={campo} className="text-xs">
                    {campoLabel(campo)}: {valorCorto(cambio?.de)} → {valorCorto(cambio?.a)}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      );
    }
    case "bautismo":
      return <p>Se bautizó</p>;
    case "fusion":
      // `resumen` es el conteo que devuelve el SP de fusión (objeto), no texto para mostrar.
      return (
        <p>
          {d.rol === "absorbida"
            ? "Esta ficha se unificó con otra y quedó archivada"
            : "Absorbió otra ficha duplicada de la misma persona"}
        </p>
      );
    case "observacion":
      return <p>{d.texto}</p>;
    case "autorizacion":
      return <p>Autorización firmada para <strong>{item.departamento || d.clase || "un departamento"}</strong></p>;
    case "grupo_pequeno":
      return <p>Grupo pequeño: <strong>{d.grupo}</strong>{d.rol ? ` (${d.rol})` : ""}</p>;
    case "asistencia_mes":
      return <p>Asistió a <strong>{d.presentes}</strong> de <strong>{d.total}</strong> clases</p>;
    default:
      return null;
  }
};

const TimelineSkeleton = () => (
  <div className="space-y-6">
    {[0, 1, 2].map((i) => (
      <div key={i} className="flex gap-3">
        <Skeleton className="h-8 w-8 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    ))}
  </div>
);

export const StudentTimeline = ({ studentId, className }: StudentTimelineProps) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["student-timeline", studentId],
    queryFn: () => getStudentTimeline(studentId),
  });

  if (isLoading) {
    return (
      <div className={className}>
        <TimelineSkeleton />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={className}>
        <p className="text-sm text-destructive">No se pudo cargar el historial.</p>
      </div>
    );
  }

  const items = data?.items || [];

  if (items.length === 0) {
    return (
      <div className={className}>
        <p className="text-sm text-muted-foreground italic flex items-center gap-2">
          <History className="h-4 w-4" />
          Todavía no hay movimientos registrados.
        </p>
      </div>
    );
  }

  // Agrupar por año, preservando el orden (ya vienen de más nuevo a más viejo)
  const grupos: { anio: string; items: TimelineItem[] }[] = [];
  for (const item of items) {
    const anio = format(parseISO(item.fecha), "yyyy");
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.anio === anio) {
      ultimo.items.push(item);
    } else {
      grupos.push({ anio, items: [item] });
    }
  }

  return (
    <div className={className}>
      <div className="space-y-6">
        {grupos.map((grupo) => (
          <div key={grupo.anio}>
            <div className="sticky top-0 z-10 mb-3 inline-block rounded-md bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-xs font-bold text-slate-600 dark:text-slate-300">
              {grupo.anio}
            </div>
            <ul className="relative space-y-5 border-l-2 border-slate-200 dark:border-slate-700 pl-5 ml-3">
              {grupo.items.map((item, idx) => {
                const style = TIPO_STYLE[item.tipo] || TIPO_STYLE.observacion;
                const Icon = style.icon;
                return (
                  <li key={`${grupo.anio}-${idx}`} className="relative">
                    <span
                      className={`absolute -left-[1.65rem] top-0.5 flex h-6 w-6 items-center justify-center rounded-full text-white ring-4 ring-white dark:ring-slate-900 ${style.dot}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 rounded-xl border border-slate-100 dark:border-slate-700/50 bg-white/60 dark:bg-slate-800/60 p-3">
                      <p className="font-semibold text-foreground capitalize">{titulo(item)}</p>
                      <div className="text-sm text-muted-foreground mt-0.5 break-words">
                        <Descripcion item={item} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground/80">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(parseISO(item.fecha), "dd/MM/yyyy")}
                        </span>
                        {item.actor && <span>por {item.actor}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
};
