import React, { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getArchivedStudents, restoreStudent, ArchivedStudent } from "@/lib/api";
import { useDepartments } from "@/hooks/useDepartments";
import { labelMotivo } from "@/components/BajaMiembroDialog";
import { StudentTimeline } from "@/components/StudentTimeline";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { formatDni } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { STORAGE_URL } from "@/integrations/supabase/client";
import {
  Archive, Search, Filter, X, ChevronDown, ChevronLeft, ChevronRight,
  FileText, RotateCcw, UserX, Calendar, GraduationCap,
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const PAGE_SIZE = 30;

export default function ArchivoMiembros() {
  const queryClient = useQueryClient();
  const { departments } = useDepartments();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterDept, setFilterDept] = useState("all");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

  const [selectedPersona, setSelectedPersona] = useState<ArchivedStudent | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchivedStudent | null>(null);
  const [restoreDept, setRestoreDept] = useState<string>("");
  const [restoreClass, setRestoreClass] = useState<string>("");

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filterDept, desde, hasta]);

  useEffect(() => {
    if (restoreTarget) {
      setRestoreDept("");
      setRestoreClass("");
    }
  }, [restoreTarget]);

  const offset = (page - 1) * PAGE_SIZE;
  const { data, isLoading, isError } = useQuery({
    queryKey: ["archived-students", debouncedSearch, filterDept, desde, hasta, offset],
    queryFn: () => getArchivedStudents({
      search: debouncedSearch || undefined,
      department_id: filterDept !== "all" ? filterDept : undefined,
      desde: desde || undefined,
      hasta: hasta || undefined,
      limit: PAGE_SIZE,
      offset,
    }),
    placeholderData: keepPreviousData,
    // El archivo cambia desde otras pantallas (cada baja suma una ficha). Con el staleTime
    // global de 5 minutos se entraba acá y la lista venía vieja.
    staleTime: 0,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const restoreDeptClasses = useMemo(
    () => departments.find(d => d.id === restoreDept)?.classes ?? [],
    [departments, restoreDept]
  );

  const { mutate: doRestore, isPending: restoring } = useMutation({
    mutationFn: (persona: ArchivedStudent) => restoreStudent(persona.id, {
      department_id: restoreDept || undefined,
      assigned_class: restoreClass || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["archived-students"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["all-students"] });
      queryClient.invalidateQueries({ queryKey: ["member-count"] });
      toast.success("Miembro reactivado");
      setRestoreTarget(null);
    },
    onError: () => toast.error("No se pudo reactivar el miembro"),
  });

  const activeFiltersCount = (filterDept !== "all" ? 1 : 0) + (desde ? 1 : 0) + (hasta ? 1 : 0);

  const photoFor = (persona: ArchivedStudent) => persona.photo_url
    ? (persona.photo_url.startsWith("http") ? persona.photo_url : `${STORAGE_URL}/photos/${persona.photo_url}`)
    : null;

  return (
    <>
      <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">

        {/* Header card — mismo estilo que otras pantallas */}
        <div className="relative group">
          <div className="absolute inset-0 bg-slate-500/5 blur-3xl rounded-[3rem] -z-10 group-hover:bg-slate-500/10 transition-all duration-700" />
          <div className="bg-white/40 dark:bg-slate-900/40 backdrop-blur-3xl border border-white/20 dark:border-slate-800/50 rounded-3xl shadow-2xl shadow-slate-500/5 overflow-hidden">
            <div className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-slate-600 blur-2xl opacity-20" />
                  <div className="relative h-14 w-14 bg-slate-700 rounded-2xl flex items-center justify-center p-3.5 shadow-xl shadow-slate-500/40">
                    <Archive className="h-full w-full text-white" />
                  </div>
                </div>
                <div>
                  <h1 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none">
                    Archivo de Miembros
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400 font-bold text-sm tracking-tight flex items-center gap-1.5 mt-0.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 inline-block" />
                    Personas que estuvieron en la congregación. Su historial se conserva.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm p-4">
          <div className="flex gap-3 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nombre o DNI..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10 rounded-xl border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                  <X className="h-3.5 w-3.5 text-slate-400" />
                </button>
              )}
            </div>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 h-10 px-4 rounded-xl border text-sm font-bold transition-all ${showFilters ? "bg-slate-100 border-slate-300 text-slate-700 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-200" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400"}`}
            >
              <Filter className="h-4 w-4" />
              Filtros
              {activeFiltersCount > 0 && (
                <span className="bg-slate-700 text-white rounded-full min-w-[16px] h-4 px-1 flex items-center justify-center text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>

            <span className="text-sm font-black text-slate-400 ml-auto">
              {total} resultado{total !== 1 ? "s" : ""}
            </span>
          </div>

          {showFilters && (
            <div className="flex gap-3 mt-3 flex-wrap items-end">
              <select
                value={filterDept}
                onChange={e => setFilterDept(e.target.value)}
                className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                <option value="all">Todos los departamentos</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Baja desde</label>
                <input
                  type="date"
                  value={desde}
                  onChange={e => setDesde(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Baja hasta</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={e => setHasta(e.target.value)}
                  className="h-9 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium text-slate-700 dark:text-slate-300"
                />
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setFilterDept("all"); setDesde(""); setHasta(""); }}
                  className="h-9 px-3 rounded-xl text-xs font-bold text-slate-500 hover:text-red-500 flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Limpiar
                </button>
              )}
            </div>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <LoadingOverlay message="Cargando archivo..." />
        ) : isError ? (
          <div className="text-center py-20">
            <UserX className="h-14 w-14 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-lg">No se pudo cargar el archivo</p>
          </div>
        ) : items.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 shadow-sm divide-y divide-slate-100 dark:divide-slate-800 overflow-hidden">
            {items.map(persona => {
              const initials = `${persona.first_name?.[0] ?? ""}${persona.last_name?.[0] ?? ""}`.toUpperCase();
              return (
                <div
                  key={persona.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedPersona(persona)}
                  onKeyDown={e => { if (e.key === "Enter") setSelectedPersona(persona); }}
                  className="w-full text-left p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
                >
                  <Avatar className="h-11 w-11 ring-2 ring-slate-100 dark:ring-slate-800 shrink-0">
                    <AvatarImage src={photoFor(persona) ?? undefined} />
                    <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-black text-sm">
                      {initials || "?"}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <p className="font-black text-slate-800 dark:text-white text-sm leading-tight truncate flex items-center gap-2">
                      <span className="truncate">{persona.first_name} {persona.last_name}</span>
                      {(persona.fichas ?? 1) > 1 && (
                        <span
                          title="Esta persona tenía fichas duplicadas. Se muestra la más reciente."
                          className="shrink-0 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 text-[10px] font-bold"
                        >
                          {persona.fichas} fichas
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      {persona.document_number && <span>DNI {formatDni(persona.document_number)}</span>}
                      {persona.department && <span>· {persona.department}{persona.assigned_class ? ` (${persona.assigned_class})` : ""}</span>}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1 flex-wrap">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{format(new Date(persona.deleted_at), "d MMM yyyy", { locale: es })}</span>
                      <span>· {labelMotivo(persona.deleted_reason) || "Sin motivo"}</span>
                      {persona.deleted_by_name && <span>· por {persona.deleted_by_name}</span>}
                    </p>
                  </div>

                  <div className="hidden sm:flex flex-col items-end gap-0.5 shrink-0 text-right">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 dark:text-slate-400">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {persona.asistencias ?? 0} clase{(persona.asistencias ?? 0) !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0 h-8 text-xs font-bold gap-1.5 rounded-lg"
                    onClick={e => { e.stopPropagation(); setRestoreTarget(persona); }}
                  >
                    <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <Archive className="h-14 w-14 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold text-lg">No hay miembros archivados con esos filtros</p>
          </div>
        )}

        {/* Pagination */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm text-slate-400 font-medium">
              Mostrando {offset + 1}–{Math.min(offset + PAGE_SIZE, total)} de {total}
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 w-9 p-0 rounded-xl"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-bold text-slate-500 px-2">{page} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 w-9 p-0 rounded-xl"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Detail dialog */}
      <Dialog open={!!selectedPersona} onOpenChange={o => { if (!o) setSelectedPersona(null); }}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-500" />
              {selectedPersona ? `${selectedPersona.first_name} ${selectedPersona.last_name || ""}`.trim() : ""}
            </DialogTitle>
            <DialogDescription>
              Ficha archivada · {selectedPersona ? labelMotivo(selectedPersona.deleted_reason) || "Sin motivo" : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedPersona && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selectedPersona.document_number && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">DNI</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{formatDni(selectedPersona.document_number)}</p>
                  </div>
                )}
                {selectedPersona.phone && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Teléfono</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{selectedPersona.phone}</p>
                  </div>
                )}
                {selectedPersona.department && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Último departamento</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">
                      {selectedPersona.department}{selectedPersona.assigned_class ? ` · ${selectedPersona.assigned_class}` : ""}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">Fecha de baja</p>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {format(new Date(selectedPersona.deleted_at), "d MMM yyyy", { locale: es })}
                  </p>
                </div>
                {selectedPersona.deleted_by_name && (
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Dada de baja por</p>
                    <p className="font-semibold text-slate-700 dark:text-slate-200">{selectedPersona.deleted_by_name}</p>
                  </div>
                )}
              </div>

              {(selectedPersona.fichas ?? 1) > 1 && (
                <p className="text-xs bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 text-amber-800 dark:text-amber-300 rounded-lg p-2.5">
                  Esta persona quedó con <strong>{selectedPersona.fichas} fichas archivadas</strong> (duplicados
                  cargados antes de que la app validara el DNI). Se muestra la más reciente; el historial de abajo
                  es el de esa ficha.
                </p>
              )}

              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Línea de tiempo</p>
                <StudentTimeline studentId={selectedPersona.id} />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  size="sm"
                  className="gap-1.5 rounded-lg"
                  onClick={() => { setRestoreTarget(selectedPersona); setSelectedPersona(null); }}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reactivar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Restore confirmation */}
      <AlertDialog open={!!restoreTarget} onOpenChange={o => { if (!o) setRestoreTarget(null); }}>
        <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-[440px] max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {restoreTarget ? `Reactivar a ${restoreTarget.first_name} ${restoreTarget.last_name || ""}`.trim() : "Reactivar miembro"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Vuelve a aparecer en las listas con todo su historial. Podés elegir a qué departamento entra;
              si no elegís nada, vuelve al que tenía cuando se dio de baja
              {restoreTarget?.department ? ` (${restoreTarget.department})` : ""}.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="restore-dept">Departamento (opcional)</Label>
              <Select value={restoreDept} onValueChange={v => { setRestoreDept(v); setRestoreClass(""); }}>
                <SelectTrigger id="restore-dept">
                  <SelectValue placeholder="Mantener el que tenía" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {restoreDeptClasses.length > 0 && (
              <div className="space-y-1.5">
                <Label htmlFor="restore-class">Clase (opcional)</Label>
                <Select value={restoreClass} onValueChange={setRestoreClass}>
                  <SelectTrigger id="restore-class">
                    <SelectValue placeholder="Sin clase específica" />
                  </SelectTrigger>
                  <SelectContent>
                    {restoreDeptClasses.map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel disabled={restoring}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); if (restoreTarget) doRestore(restoreTarget); }}
              disabled={restoring}
              className="gap-1.5"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              {restoring ? "Reactivando..." : "Reactivar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
