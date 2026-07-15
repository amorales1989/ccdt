import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getTopicRecords, createTopicRecord, updateTopicRecord, deleteTopicRecord,
  getDepartments, TopicRecord
} from "@/lib/api";
import type { Department } from "@/types/database";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, BookOpenCheck, PenLine, FileDown, HelpCircle } from "lucide-react";
import { TourGuide } from "@/components/TourGuide";
import type { Step } from "react-joyride";
import { CustomTooltip } from "@/components/CustomTooltip";
import { exportTopicRecordsPdf } from "@/lib/topicRecordsPdfUtils";
import { useQuery as useCompanyQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { SignaturePad } from "@/components/SignaturePad";
import { BibleReferencePicker } from "@/components/BibleReferencePicker";
import { BibleReferenceMultiPicker } from "@/components/BibleReferenceMultiPicker";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const emptyForm = {
  fecha: new Date().toISOString().split("T")[0],
  tema: "",
  base_biblica: "",
  ensenanza_principal: "",
  versiculo_memorizar: "",
  actividad_practica: "",
  estadistica_total: "",
  estadistica_presentes_regulares: "",
  estadistica_presentes_nuevos: "",
  estadistica_ausentes: "",
  firma: undefined as string | undefined,
  observaciones: "",
};

type FormState = typeof emptyForm;

const fmt = (fecha: string) => {
  try { return format(parseISO(fecha), "dd/MM/yy", { locale: es }); }
  catch { return fecha; }
};

export default function RegistroTemas() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fechaOpen, setFechaOpen] = useState(false);
  const [runTour, setRunTour] = useState<boolean | undefined>(undefined);
  const [editing, setEditing] = useState<TopicRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [basePending, setBasePending] = useState(false);
  const [previewFirma, setPreviewFirma] = useState<string | null>(null);

  const role = profile?.role || "";
  const userId = profile?.id || "";
  const departmentId = profile?.department_id || "";
  const assignedClass = profile?.assigned_class || "";

  const isMaestro = role === 'maestro' || role === 'auxiliar_maestro';
  const isAdminOrSecretary = role === 'admin' || role === 'secretaria';
  const isDirectorLevel = ['director', 'vicedirector', 'director_general'].includes(role);

  const [filterDeptId, setFilterDeptId] = useState<string>('');
  const [filterClass, setFilterClass] = useState<string>('');
  const [filterClassFE, setFilterClassFE] = useState<string>('');
  const [filterDateFrom, setFilterDateFrom] = useState<string>('');
  const [filterDateTo, setFilterDateTo] = useState<string>('');

  const { data: company } = useCompanyQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });

  const { data: allDepartments = [] } = useQuery<Department[]>({
    queryKey: ['departments'],
    queryFn: getDepartments,
    enabled: isAdminOrSecretary,
    staleTime: 5 * 60 * 1000,
  });

  const selectedDept = allDepartments.find(d => d.id === filterDeptId);
  const availableClasses: string[] = selectedDept?.classes || [];

  // Para directors: pasan su dept_id sin filtrar por clase (ven todas las clases del dept)
  // Para admin/secretaria: filtros opcionales desde la UI
  // Para maestros: el backend filtra por created_by
  const queryDeptId = isAdminOrSecretary ? (filterDeptId || undefined)
    : isDirectorLevel ? (departmentId || undefined)
    : (departmentId || undefined);
  const queryClass = isAdminOrSecretary ? (filterClass || undefined)
    : isDirectorLevel ? undefined
    : (assignedClass || undefined);

  const { data: records = [], isLoading } = useQuery({
    queryKey: ["topic_records", userId, role, queryDeptId, queryClass],
    queryFn: () => getTopicRecords(userId, role, queryDeptId, queryClass),
    enabled: !!userId,
  });

  const createMutation = useMutation({
    mutationFn: createTopicRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic_records"] });
      setDialogOpen(false);
      toast({ title: "Registro guardado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TopicRecord> }) => updateTopicRecord(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic_records"] });
      setDialogOpen(false);
      toast({ title: "Registro actualizado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTopicRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topic_records"] });
      toast({ title: "Registro eliminado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (record: TopicRecord) => {
    setEditing(record);
    setForm({
      fecha: record.fecha,
      tema: record.tema || "",
      base_biblica: record.base_biblica || "",
      ensenanza_principal: record.ensenanza_principal || "",
      versiculo_memorizar: record.versiculo_memorizar || "",
      actividad_practica: record.actividad_practica || "",
      estadistica_total: record.estadistica_total?.toString() || "",
      estadistica_presentes_regulares: record.estadistica_presentes_regulares?.toString() || "",
      estadistica_presentes_nuevos: record.estadistica_presentes_nuevos?.toString() || "",
      estadistica_ausentes: record.estadistica_ausentes?.toString() || "",
      firma: record.firma || undefined,
      observaciones: record.observaciones || "",
    });
    setDialogOpen(true);
  };

  const set = (field: keyof FormState, value: string | undefined) =>
    setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (basePending) {
      toast({
        title: "Falta agregar la cita",
        description: "Tocá el botón + para agregar la referencia a la base bíblica antes de guardar.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      fecha: form.fecha,
      tema: form.tema || undefined,
      base_biblica: form.base_biblica || undefined,
      ensenanza_principal: form.ensenanza_principal || undefined,
      versiculo_memorizar: form.versiculo_memorizar || undefined,
      actividad_practica: form.actividad_practica || undefined,
      estadistica_total: form.estadistica_total ? parseInt(form.estadistica_total) : undefined,
      estadistica_presentes_regulares: form.estadistica_presentes_regulares ? parseInt(form.estadistica_presentes_regulares) : undefined,
      estadistica_presentes_nuevos: form.estadistica_presentes_nuevos ? parseInt(form.estadistica_presentes_nuevos) : undefined,
      estadistica_ausentes: form.estadistica_ausentes ? parseInt(form.estadistica_ausentes) : undefined,
      firma: form.firma,
      observaciones: form.observaciones || undefined,
      department_id: departmentId || undefined,
      assigned_class: assignedClass || undefined,
      created_by: userId,
    };

    if (editing) {
      updateMutation.mutate({ id: editing.id, data: payload });
    } else {
      createMutation.mutate(payload as any);
    }
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const presRegulares = parseInt(form.estadistica_presentes_regulares || "0") || 0;
  const presNuevos = parseInt(form.estadistica_presentes_nuevos || "0") || 0;
  const totalPresentes = presRegulares + presNuevos;

  const showClassCol = isAdminOrSecretary || isDirectorLevel;

  // Clases únicas para filtro frontend (director-level)
  const directorClassOptions = isDirectorLevel
    ? ([...new Set(records.map(r => r.assigned_class).filter(Boolean))] as string[])
    : [];

  const sorted = [...records].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const displayed = sorted
    .filter(r => !filterClassFE || r.assigned_class === filterClassFE)
    .filter(r => !filterDateFrom || r.fecha >= filterDateFrom)
    .filter(r => !filterDateTo || r.fecha <= filterDateTo);

  const tourSteps: Step[] = [
    { target: '[data-tour="rt-header"]', content: "Acá registrás los temas dados en cada clase: fecha, base bíblica, estadística de asistencia y firma." },
    ...(isMaestro ? [{ target: '[data-tour="rt-nuevo"]', content: "Tocá acá para cargar un nuevo registro de tema.", placement: "left" as const }] : []),
    ...((isAdminOrSecretary || isDirectorLevel) ? [{ target: '[data-tour="rt-filtros"]', content: "Filtrá los registros por departamento, clase y rango de fechas." }] : []),
    ...(displayed.length > 0 ? [{ target: '[data-tour="rt-pdf"]', content: "Descargá todos los registros visibles en un PDF con sus firmas." }] : []),
  ];

  return (
    <div className="p-4 w-full">
      <TourGuide tourKey="registro_temas" steps={tourSteps} run={runTour} onClose={() => setRunTour(false)} />
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div data-tour="rt-header">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Registro de Temas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Clases y estadísticas por fecha</p>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
            <BookOpenCheck className="h-3 w-3 text-slate-400" />
            {displayed.length} {displayed.length === 1 ? 'registro' : 'registros'}
          </span>

          {displayed.length > 0 && (
            <Button
              data-tour="rt-pdf"
              variant="outline"
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm h-10 transition-all active:scale-95"
              onClick={() => exportTopicRecordsPdf(
                displayed,
                company?.congregation_name || company?.name || 'CCDT',
                profile?.departments?.[0],
                assignedClass || undefined,
                showClassCol,
              )}
            >
              <FileDown className="h-4 w-4 mr-2" />
              PDF
            </Button>
          )}

          {isMaestro && (
            <Button
              data-tour="rt-nuevo"
              onClick={openNew}
              className="button-gradient rounded-xl font-black h-10 px-5 shadow-lg shadow-primary/20"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nuevo registro
            </Button>
          )}
        </div>
      </div>

      {(isAdminOrSecretary || isDirectorLevel) && (
        <div data-tour="rt-filtros" className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 mb-4">
          {isAdminOrSecretary && (
            <>
              <Select
                value={filterDeptId || '__all__'}
                onValueChange={v => {
                  setFilterDeptId(v === '__all__' ? '' : v);
                  setFilterClass('');
                }}
              >
                <SelectTrigger className="h-9 w-full sm:w-[200px] text-sm rounded-xl border-slate-200">
                  <SelectValue placeholder="Todos los departamentos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos los departamentos</SelectItem>
                  {allDepartments.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={filterClass || '__all__'}
                onValueChange={v => setFilterClass(v === '__all__' ? '' : v)}
                disabled={!filterDeptId || availableClasses.length === 0}
              >
                <SelectTrigger className="h-9 w-full sm:w-[160px] text-sm rounded-xl border-slate-200">
                  <SelectValue placeholder="Todas las clases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todas las clases</SelectItem>
                  {availableClasses.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}

          {isDirectorLevel && directorClassOptions.length > 0 && (
            <Select
              value={filterClassFE || '__all__'}
              onValueChange={v => setFilterClassFE(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="h-9 w-full sm:w-[160px] text-sm rounded-xl border-slate-200">
                <SelectValue placeholder="Todas las clases" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas las clases</SelectItem>
                {directorClassOptions.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Fechas: apiladas en mobile, inline en desktop */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-10 sm:w-auto">Desde</span>
              <Input
                type={filterDateFrom ? "date" : "text"}
                className="h-9 w-full sm:w-[150px] text-sm rounded-xl border-slate-200"
                value={filterDateFrom}
                placeholder="dd/mm/aaaa"
                onFocus={e => { e.target.type = "date"; }}
                onBlur={e => { if (!e.target.value) e.target.type = "text"; }}
                onChange={e => setFilterDateFrom(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground w-10 sm:w-auto">Hasta</span>
              <Input
                type={filterDateTo ? "date" : "text"}
                className="h-9 w-full sm:w-[150px] text-sm rounded-xl border-slate-200"
                value={filterDateTo}
                placeholder="dd/mm/aaaa"
                onFocus={e => { e.target.type = "date"; }}
                onBlur={e => { if (!e.target.value) e.target.type = "text"; }}
                onChange={e => setFilterDateTo(e.target.value)}
              />
            </div>
            {(filterDateFrom || filterDateTo || filterClassFE) && (
              <button
                onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); setFilterClassFE(''); }}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors whitespace-nowrap"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpenCheck className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>No hay registros que coincidan con los filtros.</p>
          <p className="text-sm">Probá con otros valores o limpiá los filtros.</p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted/50">
                {showClassCol && <TableHead className="w-[110px]">Clase</TableHead>}
                <TableHead className="w-[90px]">Fecha</TableHead>
                <TableHead>Tema</TableHead>
                <TableHead className="table-cell">Base Bíblica</TableHead>
                <TableHead className="table-cell">Enseñanza Principal</TableHead>
                <TableHead className="table-cell">Versículo</TableHead>
                <TableHead className="table-cell">Actividad</TableHead>
                <TableHead className="text-center w-[60px]">T</TableHead>
                <TableHead className="text-center w-[60px]">P</TableHead>
                <TableHead className="text-center w-[60px]">N</TableHead>
                <TableHead className="text-center w-[60px]">A</TableHead>
                <TableHead className="text-center w-[60px]">Firma</TableHead>
                <TableHead className="table-cell">Observaciones</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayed.map((record, i) => {
                return (
                  <TableRow key={record.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                    {showClassCol && (
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {record.assigned_class || "—"}
                      </TableCell>
                    )}
                    <TableCell className="font-medium text-primary text-sm whitespace-nowrap">
                      {fmt(record.fecha)}
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <CustomTooltip title={record.tema || ""} placement="top" arrow>
                        <p className="truncate text-sm font-medium">{record.tema || <span className="text-muted-foreground italic">—</span>}</p>
                      </CustomTooltip>
                    </TableCell>
                    <TableCell className="table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {record.base_biblica || "—"}
                    </TableCell>
                    <TableCell className="table-cell max-w-[200px]">
                      <CustomTooltip title={record.ensenanza_principal || ""} placement="top" arrow>
                        <p className="truncate text-sm text-muted-foreground">{record.ensenanza_principal || "—"}</p>
                      </CustomTooltip>
                    </TableCell>
                    <TableCell className="table-cell text-sm text-muted-foreground whitespace-nowrap">
                      {record.versiculo_memorizar || "—"}
                    </TableCell>
                    <TableCell className="table-cell max-w-[120px]">
                      <CustomTooltip title={record.actividad_practica || ""} placement="top" arrow>
                        <p className="truncate text-sm text-muted-foreground">{record.actividad_practica || "—"}</p>
                      </CustomTooltip>
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold">
                      {record.estadistica_total ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-green-700 dark:text-green-400">
                      {record.estadistica_presentes_regulares ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-blue-600 dark:text-blue-400">
                      {record.estadistica_presentes_nuevos ?? "—"}
                    </TableCell>
                    <TableCell className="text-center text-sm font-semibold text-red-500">
                      {record.estadistica_ausentes ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {record.firma ? (
                        <button
                          onClick={() => setPreviewFirma(record.firma!)}
                          className="text-green-600 hover:opacity-70 transition-opacity"
                          title="Ver firma"
                        >
                          <PenLine className="h-4 w-4 mx-auto" />
                        </button>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell className="table-cell max-w-[180px]">
                      <CustomTooltip title={record.observaciones || ""} placement="top" arrow>
                        <p className="truncate text-sm text-muted-foreground">{record.observaciones || "—"}</p>
                      </CustomTooltip>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 justify-end">
                        {role !== 'auxiliar_maestro' && (
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(record)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {role !== 'auxiliar_maestro' && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar registro?</AlertDialogTitle>
                              <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(record.id)}
                                className="bg-destructive hover:bg-destructive/90"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Modal preview firma */}
      <Dialog open={!!previewFirma} onOpenChange={() => setPreviewFirma(null)}>
        <DialogContent className="max-w-xs">
          <DialogHeader><DialogTitle>Firma</DialogTitle></DialogHeader>
          {previewFirma && <img src={previewFirma} alt="firma" className="w-full border rounded" />}
        </DialogContent>
      </Dialog>

      {/* Modal formulario */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar registro" : "Nuevo registro de tema"}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <div>
              <Label>Fecha</Label>
              <MuiDatePickerField
                value={form.fecha ? parseISO(form.fecha) : undefined}
                onChange={(date) => set("fecha", date ? format(date, "yyyy-MM-dd") : "")}
                open={fechaOpen}
                onOpenChange={setFechaOpen}
                placeholder="Seleccionar fecha"
              />
            </div>

            <div>
              <Label>Tema</Label>
              <Input value={form.tema} onChange={e => set("tema", e.target.value)} placeholder="Ej: El hijo pródigo regresa" />
            </div>

            <div>
              <Label>Base Bíblica</Label>
              <BibleReferenceMultiPicker value={form.base_biblica} onChange={v => set("base_biblica", v)} onPendingChange={setBasePending} />
            </div>
            <div>
              <Label>Versículo p/ Memorizar</Label>
              <BibleReferencePicker value={form.versiculo_memorizar} onChange={v => set("versiculo_memorizar", v)} />
              {form.versiculo_memorizar && <p className="text-xs text-muted-foreground mt-1">{form.versiculo_memorizar}</p>}
            </div>

            <div>
              <Label>Enseñanza Principal</Label>
              <Textarea value={form.ensenanza_principal} onChange={e => set("ensenanza_principal", e.target.value)} placeholder="¿Cuál es el mensaje central de la clase?" rows={2} maxLength={150} className="resize-none" />
              <p className="text-right text-xs text-muted-foreground mt-1">{form.ensenanza_principal.length}/150</p>
            </div>

            <div>
              <Label>Actividad Práctica</Label>
              <Input value={form.actividad_practica} onChange={e => set("actividad_practica", e.target.value)} placeholder="Ej: Pintar, Coros, Colorear..." />
            </div>

            {/* Estadísticas */}
            <div>
              <Label className="text-base font-semibold">Estadística</Label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">T — Total de alumnos</Label>
                  <Input type="number" min={0} value={form.estadistica_total} onChange={e => set("estadistica_total", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">A — Ausentes</Label>
                  <Input type="number" min={0} value={form.estadistica_ausentes} onChange={e => set("estadistica_ausentes", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">P — Presentes regulares</Label>
                  <Input type="number" min={0} value={form.estadistica_presentes_regulares} onChange={e => set("estadistica_presentes_regulares", e.target.value)} placeholder="0" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">P — Presentes nuevos</Label>
                  <Input type="number" min={0} value={form.estadistica_presentes_nuevos} onChange={e => set("estadistica_presentes_nuevos", e.target.value)} placeholder="0" />
                </div>
              </div>
              {totalPresentes > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Total presentes: <b>{totalPresentes}</b> — se guarda como <b>{presRegulares}/{presNuevos}</b>
                </p>
              )}
            </div>

            {/* Firma */}
            <div>
              <Label>Firma (opcional)</Label>
              <div className="mt-1">
                <SignaturePad value={form.firma} onChange={val => set("firma", val)} />
              </div>
            </div>

            <div>
              <Label>Observaciones</Label>
              <Textarea value={form.observaciones} onChange={e => set("observaciones", e.target.value)} placeholder="Para uso del director o supervisor..." rows={2} maxLength={150} className="resize-none" />
              <p className="text-right text-xs text-muted-foreground mt-1">{form.observaciones.length}/150</p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!form.fecha || isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editing ? "Guardar cambios" : "Guardar registro"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
