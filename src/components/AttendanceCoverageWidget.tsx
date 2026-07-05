import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Clock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DatePickerField } from "@/components/DatePickerField";
import { getAttendanceCoverage, type CoverageDept } from "@/lib/api";

// Anillo de progreso circular (SVG)
function ProgressRing({ value, total, size = 56 }: { value: number; total: number; size?: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  const r = 16;
  const c = 2 * Math.PI * r;
  const done = pct === 100 && total > 0;
  const stroke = done ? "#16a34a" : pct === 0 ? "#cbd5e1" : "#7c3aed";
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90">
        <circle cx="20" cy="20" r={r} fill="none" stroke="currentColor" strokeWidth="4" className="text-slate-100 dark:text-slate-700" />
        <circle
          cx="20" cy="20" r={r} fill="none" stroke={stroke} strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className="transition-all duration-500"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-[11px] font-black text-foreground">{pct}%</span>
      </div>
    </div>
  );
}

// showHeader: solo cuando hay varios departamentos (con uno solo, el resumen de arriba ya lo cubre).
function DeptBlock({ dept, showHeader }: { dept: CoverageDept; showHeader: boolean }) {
  const pct = dept.total_clases > 0 ? Math.round((dept.tomadas / dept.total_clases) * 100) : 0;
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {showHeader && (
        <>
          {/* Encabezado del departamento */}
          <div className="flex items-center gap-3 mb-3">
            <ProgressRing value={dept.tomadas} total={dept.total_clases} size={44} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm capitalize text-foreground truncate">{dept.name}</p>
              <p className="text-xs text-muted-foreground">
                {dept.tomadas} de {dept.total_clases} clases tomadas
              </p>
            </div>
          </div>

          {/* Barra de progreso */}
          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden mb-3">
            <div
              className={`h-full rounded-full transition-all duration-500 ${pct === 100 ? "bg-green-500" : "bg-primary"}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </>
      )}

      {/* Chips de clases */}
      {dept.classes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sin clases con alumnos.</p>
      ) : (
        <div className="grid grid-cols-1 gap-2">
          {dept.classes.map((c) => (
            <div
              key={c.clase}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
                c.tomada
                  ? "border-green-200 bg-green-50/70 dark:bg-green-900/10"
                  : "border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40"
              }`}
            >
              <div
                className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 ${
                  c.tomada ? "bg-green-500 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-700"
                }`}
              >
                {c.tomada ? <Check className="h-3.5 w-3.5" /> : <Clock className="h-3.5 w-3.5" />}
              </div>
              <span className="flex-1 text-sm font-medium text-foreground truncate">{c.clase}</span>
              <span className={`text-[11px] font-bold shrink-0 ${c.tomada ? "text-green-700" : "text-muted-foreground"}`}>
                {c.tomada ? `${c.presentes}/${c.total}` : "Pendiente"}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Para directores/vicedirectores: qué clases ya tomaron asistencia un día y cuáles faltan.
export function AttendanceCoverageWidget() {
  // null = usar la fecha por defecto que resuelve el back (último día de actividad del depto).
  const [date, setDate] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);

  // Refresco automático (solo React Query, sin tocar Supabase): reconsulta cada 15s
  // y al volver a enfocar la ventana, así se actualiza sin recargar la pantalla.
  const { data, isLoading } = useQuery({
    queryKey: ["attendance-coverage", date],
    queryFn: () => getAttendanceCoverage(date ?? undefined),
    refetchOnWindowFocus: true,
    refetchInterval: 15000,
  });

  const departments = data?.departments ?? [];
  const shownDate = date ?? data?.date ?? format(new Date(), "yyyy-MM-dd");

  const totalClases = departments.reduce((a, d) => a + d.total_clases, 0);
  const totalTomadas = departments.reduce((a, d) => a + d.tomadas, 0);
  const allDone = totalClases > 0 && totalTomadas === totalClases;

  return (
    <Card className="overflow-hidden border-purple-100 dark:border-slate-700 shadow-sm">
      {/* Cabecera con resumen general */}
      <CardHeader className="bg-gradient-to-br from-purple-50 to-white dark:from-slate-800 dark:to-slate-900 border-b border-border">
        {/* En celular: título+resumen arriba (centrado) y abajo el anillo + fecha.
            En desktop: anillo | título+resumen | fecha (en una fila). */}
        <div className="flex flex-col items-center text-center gap-3 sm:flex-row sm:items-center sm:text-left sm:gap-4">
          <div className="order-1 sm:order-2 flex-1 min-w-[180px]">
            <h2 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
              Cobertura de asistencia
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalClases === 0
                ? "Sin clases para mostrar"
                : allDone
                ? "¡Todas las clases tomaron asistencia! 🎉"
                : `${totalTomadas} de ${totalClases} clases tomadas · faltan ${totalClases - totalTomadas}`}
            </p>
          </div>

          {/* En celular: anillo + fecha en una misma fila centrada. En desktop se reparten (contents). */}
          <div className="order-2 flex items-center justify-center gap-3 sm:contents">
            <ProgressRing value={totalTomadas} total={totalClases} size={56} />
            <div className="rounded-xl border border-border bg-background px-3 py-2 shrink-0 sm:order-3">
              <DatePickerField
                value={new Date(shownDate + "T00:00:00")}
                onChange={(d) => setDate(d ? format(d, "yyyy-MM-dd") : shownDate)}
                open={dateOpen}
                onOpenChange={setDateOpen}
                className="bg-transparent border-none outline-none text-sm font-semibold text-gray-700 w-32"
              />
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Cargando…</p>
        ) : departments.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No hay departamentos para mostrar.</p>
        ) : (
          departments.map((d) => <DeptBlock key={d.department_id} dept={d} showHeader={departments.length > 1} />)
        )}
      </CardContent>
    </Card>
  );
}
