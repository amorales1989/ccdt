import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { Plus, Pencil, Trash2, Download, Wallet, TrendingUp, TrendingDown, FolderIcon, ListOrdered, PieChart as PieChartIcon } from "lucide-react";
import { PieChartWithLegend } from "@/components/BasePieChart";
import { buildPieData, getPieChartOptions } from "@/lib/pieChartOptions";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getDepartments,
  getAccountingTransactions,
  getAccountingBalance,
  getAccountingCategories,
  getAccountingByCategory,
  createAccountingTransaction,
  updateAccountingTransaction,
  deleteAccountingTransaction,
  getOpeningBalance,
  setOpeningBalance,
  getCompany,
  type AccountingTransaction,
  type AccountingCategoryTotal,
} from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { exportAccountingReport, exportAccountingByCategoryReport } from "@/lib/accountingPdfUtils";
import { DEFAULT_PERMISSIONS, hasPermission, type SavedPermissions } from "@/lib/rolePermissions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DatePickerField } from "@/components/DatePickerField";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomTabs } from "@/components/CustomTabs";
import { CHART_COLORS } from "@/lib/chartColors";

const WRITE_ROLES = ["admin", "lider", "director", "vicedirector", "director_general"];
// director_general se limita a los departamentos asignados en su perfil (no todos).
const ALL_DEPT_ROLES = ["admin", "secretaria"];

// Conceptos sugeridos por tipo. "Otro" habilita un texto libre para lo que no entre en la lista
// (y es el modo en el que caen los movimientos viejos con conceptos fuera de estas opciones).
const CONCEPTO_OTRO = "__otro__";
const CONCEPTOS: Record<"ingreso" | "egreso", string[]> = {
  ingreso: [
    "Ofrenda",
    "Donación",
    "Aporte de la iglesia",
    "Recaudación de actividad",
    "Inscripciones",
  ],
  egreso: [
    "Comida y bebida",
    "Materiales y librería",
    "Limpieza y mantenimiento",
    "Transporte y combustible",
    "Actividades y eventos",
  ],
};



const fmtMoney = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n || 0);

// Sin decimales: la etiqueta va adentro del gráfico y el espacio es poco.
const fmtMoneyShort = (n: number) =>
  new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n || 0);

// Tooltip multilínea y etiqueta externa de la torta de conceptos.
const pieOptions = getPieChartOptions<AccountingCategoryTotal>(
  (ctx) =>
    `Importe: ${fmtMoney(ctx.raw.value)}\n` +
    `Porcentaje: ${Math.round(ctx.percent * 100)}%\n` +
    `Movimientos: ${ctx.raw.fullRow.cantidad}`,
  (value, ctx) =>
    `${ctx.label.length > 14 ? `${ctx.label.slice(0, 13)}…` : ctx.label}: ${fmtMoneyShort(value)} · ${Math.round(ctx.percent * 100)}%`,
  { fontSize: 10 },
  { padding: { top: 40, bottom: 40, left: 55, right: 55 } },
);

const todayStr = () => format(new Date(), "yyyy-MM-dd");

type FormState = {
  type: "ingreso" | "egreso";
  amount: string;
  category: string;
  description: string;
  movement_date: string;
  assigned_class: string;
};

const emptyForm = (): FormState => ({
  type: "ingreso", amount: "", category: "", description: "", movement_date: todayStr(), assigned_class: "",
});

export default function Contabilidad() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const role = profile?.role || "";
  const canWrite = WRITE_ROLES.includes(role);

  const [selectedDept, setSelectedDept] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterClass, setFilterClass] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"detallado" | "conceptos">("detallado");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [fromOpen, setFromOpen] = useState(false);
  const [toOpen, setToOpen] = useState(false);
  const [movementDateOpen, setMovementDateOpen] = useState(false);
  const [editing, setEditing] = useState<AccountingTransaction | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [conceptoOtro, setConceptoOtro] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AccountingTransaction | null>(null);

  const [obDialogOpen, setObDialogOpen] = useState(false);
  const [obValue, setObValue] = useState("");

  const { data: allDepartments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const { data: company } = useQuery({
    queryKey: ["company", getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });

  // Departamentos permitidos segun rol
  const allowedDepartments = useMemo(() => {
    if (ALL_DEPT_ROLES.includes(role)) return allDepartments;
    const names = (profile?.departments || []) as string[];
    return allDepartments.filter((d) => names.includes(d.name as string));
  }, [allDepartments, role, profile?.departments]);

  // Seleccion inicial de departamento
  useEffect(() => {
    if (selectedDept || !allowedDepartments.length) return;
    const stored = localStorage.getItem("selectedDepartmentId");
    const match = allowedDepartments.find((d) => d.id === stored);
    setSelectedDept(match ? match.id : allowedDepartments[0].id);
  }, [allowedDepartments, selectedDept]);

  const deptName = allowedDepartments.find((d) => d.id === selectedDept)?.name || "";
  const deptClasses = (allowedDepartments.find((d) => d.id === selectedDept)?.classes || []) as string[];
  const classFilter = filterClass === "all" ? undefined : filterClass;
  const queryParams = {
    department_id: selectedDept,
    from: from || undefined,
    to: to || undefined,
    type: filterType === "all" ? undefined : (filterType as "ingreso" | "egreso"),
    assigned_class: classFilter,
  };

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["accounting-tx", queryParams],
    queryFn: () => getAccountingTransactions(queryParams),
    enabled: !!selectedDept,
  });

  const { data: balance } = useQuery({
    queryKey: ["accounting-balance", selectedDept, from, to, classFilter],
    queryFn: () => getAccountingBalance({ department_id: selectedDept, from: from || undefined, to: to || undefined, assigned_class: classFilter }),
    enabled: !!selectedDept,
  });

  // Totales por concepto (tab "Por conceptos"): los agrupa el SP, no el browser.
  const { data: byCategory = [], isLoading: byCategoryLoading } = useQuery({
    queryKey: ["accounting-by-category", selectedDept, from, to, classFilter],
    queryFn: () => getAccountingByCategory({ department_id: selectedDept, from: from || undefined, to: to || undefined, assigned_class: classFilter }),
    enabled: !!selectedDept && activeTab === "conceptos",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["accounting-categories", selectedDept, form.type],
    queryFn: () => getAccountingCategories(selectedDept, form.type),
    enabled: !!selectedDept && dialogOpen,
  });

  const { data: openingBalance = 0 } = useQuery({
    queryKey: ["accounting-opening", selectedDept],
    queryFn: () => getOpeningBalance(selectedDept),
    enabled: !!selectedDept,
  });

  // Libro de caja: orden cronológico ascendente con saldo corriente desde el saldo inicial.
  const ledger = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => {
      const d = a.movement_date.localeCompare(b.movement_date);
      return d !== 0 ? d : (a.created_at || "").localeCompare(b.created_at || "");
    });
    let running = balance?.opening_balance || 0;
    return sorted.map((t) => {
      running += t.type === "ingreso" ? Number(t.amount) : -Number(t.amount);
      return { ...t, saldo: running };
    });
  }, [transactions, balance?.opening_balance]);

  // El filtro de tipo no viaja al SP: la lista ya viene agrupada, se recorta acá.
  const categoryRows = useMemo(
    () => byCategory.filter((r) => filterType === "all" || r.type === filterType),
    [byCategory, filterType]
  );

  const pieData = (tipo: "ingreso" | "egreso") =>
    buildPieData(categoryRows.filter((r) => r.type === tipo), {
      getValue: (r) => Number(r.total),
      getLabel: (r) => r.category,
      colors: CHART_COLORS,
      mergeOthers: (rest) => ({
        category: "Otros",
        type: tipo,
        total: rest.reduce((acc, r) => acc + Number(r.total), 0),
        cantidad: rest.reduce((acc, r) => acc + r.cantidad, 0),
      }),
    });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["accounting-tx"] });
    qc.invalidateQueries({ queryKey: ["accounting-balance"] });
    qc.invalidateQueries({ queryKey: ["accounting-opening"] });
    qc.invalidateQueries({ queryKey: ["accounting-by-category"] });
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        type: form.type,
        amount: Number(form.amount),
        category: form.category.trim() || null,
        description: form.description.trim() || null,
        movement_date: form.movement_date,
        assigned_class: form.assigned_class || null,
      };
      if (editing) return updateAccountingTransaction(editing.id, payload);
      return createAccountingTransaction({ department_id: selectedDept, ...payload });
    },
    onSuccess: () => {
      invalidate();
      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm());
      toast({ title: editing ? "Movimiento actualizado" : "Movimiento creado" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAccountingTransaction(id),
    onSuccess: () => { invalidate(); setDeleteTarget(null); toast({ title: "Movimiento eliminado" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const obMutation = useMutation({
    mutationFn: () => setOpeningBalance(selectedDept, Number(obValue)),
    onSuccess: () => { invalidate(); setObDialogOpen(false); toast({ title: "Saldo inicial actualizado" }); },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setConceptoOtro(false); setDialogOpen(true); };
  const openEdit = (t: AccountingTransaction) => {
    setEditing(t);
    setForm({
      type: t.type, amount: String(t.amount), category: t.category || "",
      description: t.description || "", movement_date: t.movement_date,
      assigned_class: t.assigned_class || "",
    });
    // Concepto cargado antes del select (o escrito a mano): se edita como "Otro".
    setConceptoOtro(!!t.category && !CONCEPTOS[t.type].includes(t.category));
    setDialogOpen(true);
  };

  const handleSave = () => {
    const amt = Number(form.amount);
    if (!Number.isFinite(amt) || amt <= 0) {
      toast({ title: "Monto inválido", description: "Debe ser mayor a 0", variant: "destructive" });
      return;
    }
    if (!form.movement_date) {
      toast({ title: "Falta la fecha", variant: "destructive" });
      return;
    }
    // Con concepto "Otro" el detalle es lo único que explica el movimiento.
    if (conceptoOtro && !form.description.trim()) {
      toast({ title: "Falta la descripción", description: "Con el concepto \"Otro\" la descripción es obligatoria", variant: "destructive" });
      return;
    }
    saveMutation.mutate();
  };

  const handleExport = () => {
    if (activeTab === "conceptos") {
      exportAccountingByCategoryReport(categoryRows, String(deptName), { from, to }, company?.name || "Nexus", classFilter);
      return;
    }
    if (!balance) return;
    exportAccountingReport(ledger, balance, String(deptName), { from, to }, company?.name || "Nexus");
  };

  // Acceso configurable por rol desde Configuración (respeta company.role_permissions
  // con fallback a los valores por defecto; por ahora solo admin).
  const savedPerms = (company as any)?.role_permissions?.[role];
  const hasAccess =
    (savedPerms && "menu_contabilidad" in savedPerms
      ? savedPerms.menu_contabilidad !== false
      : DEFAULT_PERMISSIONS[role]?.menu_contabilidad !== false)
    // Roles propios de la empresa: viven en profiles.roles, no en profile.role.
    || hasPermission(profile, 'menu_contabilidad', (company as { role_permissions?: SavedPermissions } | undefined)?.role_permissions);

  if (!hasAccess) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No tienes acceso a la sección de contabilidad.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <Wallet className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Contabilidad</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Libro de caja por departamento</p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {allowedDepartments.length > 1 ? (
              <Select value={selectedDept} onValueChange={(v) => { setSelectedDept(v); setFilterClass("all"); }}>
                <SelectTrigger className="w-[200px] rounded-xl border-slate-200 bg-white shadow-sm h-10">
                  <SelectValue placeholder="Departamento" />
                </SelectTrigger>
                <SelectContent>
                  {allowedDepartments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="inline-flex items-center gap-1.5 h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 shadow-sm">
                <FolderIcon className="h-4 w-4 text-slate-400" />
                {String(deptName) || "—"}
              </span>
            )}
            <Button
              variant="outline"
              className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm h-10 transition-all active:scale-95"
              onClick={handleExport}
              disabled={activeTab === "conceptos" ? !categoryRows.length : !balance}
            >
              <Download className="h-4 w-4 mr-1" /> Reporte
            </Button>
          </div>
        </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-1 text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Saldo inicial</CardTitle></CardHeader>
          <CardContent className="text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-2xl md:text-3xl font-bold">{fmtMoney(balance?.opening_balance || 0)}</span>
              {canWrite && (
                <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => { setObValue(String(openingBalance)); setObDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-1 text-center"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1"><TrendingUp className="h-4 w-4 text-green-600" /> Ingresos</CardTitle></CardHeader>
          <CardContent className="text-center"><span className="text-2xl md:text-3xl font-bold text-green-600">{fmtMoney(balance?.total_ingresos || 0)}</span></CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-1 text-center"><CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-center gap-1"><TrendingDown className="h-4 w-4 text-red-600" /> Egresos</CardTitle></CardHeader>
          <CardContent className="text-center"><span className="text-2xl md:text-3xl font-bold text-red-600">{fmtMoney(balance?.total_egresos || 0)}</span></CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm">
          <CardHeader className="pb-1 text-center"><CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle></CardHeader>
          <CardContent className="text-center"><span className={`text-2xl md:text-3xl font-bold ${(balance?.balance || 0) >= 0 ? "text-green-700" : "text-red-700"}`}>{fmtMoney(balance?.balance || 0)}</span></CardContent>
        </Card>
      </div>

      {/* Filtros + acciones */}
      <div className="flex flex-col md:flex-row md:items-end gap-3">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Tipo</Label>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-full md:w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ingreso">Ingresos</SelectItem>
              <SelectItem value="egreso">Egresos</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {deptClasses.length > 0 && (
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Clase</Label>
            <Select value={filterClass} onValueChange={setFilterClass}>
              <SelectTrigger className="w-full md:w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {deptClasses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 md:flex md:gap-3">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Desde</Label>
            <div className="h-10 px-3 rounded-md border border-input bg-background flex items-center overflow-hidden w-full md:w-[150px]">
              <DatePickerField
                value={from ? parseISO(from) : undefined}
                onChange={(d) => setFrom(d ? format(d, "yyyy-MM-dd") : "")}
                open={fromOpen}
                onOpenChange={setFromOpen}
                placeholder="DD/MM/AAAA"
                className="h-auto text-sm"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Hasta</Label>
            <div className="h-10 px-3 rounded-md border border-input bg-background flex items-center overflow-hidden w-full md:w-[150px]">
              <DatePickerField
                value={to ? parseISO(to) : undefined}
                onChange={(d) => setTo(d ? format(d, "yyyy-MM-dd") : "")}
                open={toOpen}
                onOpenChange={setToOpen}
                placeholder="DD/MM/AAAA"
                className="h-auto text-sm"
              />
            </div>
          </div>
        </div>
        {canWrite && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full md:w-auto md:ml-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nuevo movimiento</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Editar movimiento" : "Nuevo movimiento"}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <Label>Tipo</Label>
                    <Select
                      value={form.type}
                      onValueChange={(v) => {
                        setForm({ ...form, type: v as "ingreso" | "egreso", category: "" });
                        setConceptoOtro(false);
                      }}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ingreso">Ingreso</SelectItem>
                        <SelectItem value="egreso">Egreso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label>Monto</Label>
                    <Input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Concepto</Label>
                  <Select
                    value={conceptoOtro ? CONCEPTO_OTRO : form.category}
                    onValueChange={(v) => {
                      if (v === CONCEPTO_OTRO) {
                        setConceptoOtro(true);
                        setForm({ ...form, category: "" });
                      } else {
                        setConceptoOtro(false);
                        setForm({ ...form, category: v });
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="Elegí un concepto" /></SelectTrigger>
                    <SelectContent>
                      {CONCEPTOS[form.type].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                      <SelectItem value={CONCEPTO_OTRO}>Otro</SelectItem>
                    </SelectContent>
                  </Select>
                  {conceptoOtro && (
                    <>
                      <Input
                        list="accounting-categories"
                        value={form.category}
                        onChange={(e) => setForm({ ...form, category: e.target.value })}
                        placeholder="Escribí el concepto"
                      />
                      <datalist id="accounting-categories">
                        {categories.map((c) => <option key={c} value={c} />)}
                      </datalist>
                    </>
                  )}
                </div>
                <div className="flex flex-col gap-1">
                  <Label>Fecha</Label>
                  <div className="h-10 px-3 rounded-md border border-input bg-background flex items-center overflow-hidden">
                    <DatePickerField
                      value={form.movement_date ? parseISO(form.movement_date) : undefined}
                      onChange={(d) => setForm({ ...form, movement_date: d ? format(d, "yyyy-MM-dd") : "" })}
                      open={movementDateOpen}
                      onOpenChange={setMovementDateOpen}
                      placeholder="DD/MM/AAAA"
                      className="h-auto text-sm"
                    />
                  </div>
                </div>
                {deptClasses.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <Label>Clase (opcional)</Label>
                    <Select
                      value={form.assigned_class || "__sin__"}
                      onValueChange={(v) => setForm({ ...form, assigned_class: v === "__sin__" ? "" : v })}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__sin__">Todo el departamento</SelectItem>
                        {deptClasses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <Label>Descripción {conceptoOtro ? <span className="text-red-500">*</span> : "(opcional)"}</Label>
                  <Textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={2}
                    placeholder={conceptoOtro ? "Detallá el concepto del movimiento" : undefined}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saveMutation.isPending}>Guardar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <CustomTabs
        value={activeTab}
        onChange={setActiveTab}
        options={[
          { value: "detallado", label: "Detallado", icon: ListOrdered },
          { value: "conceptos", label: "Por conceptos", icon: PieChartIcon },
        ]}
      />

      {activeTab === "conceptos" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {(["ingreso", "egreso"] as const).map((tipo) => {
            const data = pieData(tipo);
            const points = data.datasets[0].data;
            const total = points.reduce((acc, p) => acc + p.value, 0);
            if (filterType !== "all" && filterType !== tipo) return null;
            return (
              <Card key={tipo} className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-slate-100">
                    {tipo === "ingreso"
                      ? <><TrendingUp className="h-4 w-4 text-green-600" /> Ingresos por concepto</>
                      : <><TrendingDown className="h-4 w-4 text-red-600" /> Egresos por concepto</>}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {byCategoryLoading ? (
                    <p className="text-center text-muted-foreground py-10">Cargando...</p>
                  ) : !points.length ? (
                    <p className="text-center text-muted-foreground py-10">Sin movimientos</p>
                  ) : (
                    <>
                      <PieChartWithLegend
                        data={data}
                        options={pieOptions}
                        formatValue={fmtMoney}
                        title={tipo === "ingreso" ? "Total ingresos" : "Total egresos"}
                        itemsLabel={(n) => `${n} ${n === 1 ? "concepto" : "conceptos"}`}
                        className="mb-4"
                      />
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead>Concepto</TableHead>
                            <TableHead className="text-right">Mov.</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                            <TableHead className="text-right">%</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {points.map((p, i) => (
                            <TableRow key={p.label}>
                              <TableCell className="flex items-center gap-2">
                                <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: data.datasets[0].backgroundColor[i] }} />
                                {p.label}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">{p.fullRow.cantidad}</TableCell>
                              <TableCell className={`text-right font-semibold ${tipo === "ingreso" ? "text-green-600" : "text-red-600"}`}>{fmtMoney(p.value)}</TableCell>
                              <TableCell className="text-right text-muted-foreground">{total ? Math.round((p.value / total) * 100) : 0}%</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <TableFooter>
                          <TableRow className="bg-muted/60 font-semibold">
                            <TableCell colSpan={2}>Total</TableCell>
                            <TableCell className="text-right">{fmtMoney(total)}</TableCell>
                            <TableCell />
                          </TableRow>
                        </TableFooter>
                      </Table>
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
      <Card className="rounded-2xl border-slate-100 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardContent className="p-0 overflow-x-auto pt-4">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="whitespace-nowrap">Fecha</TableHead>
                <TableHead>Concepto</TableHead>
                <TableHead>Detalle</TableHead>
                <TableHead>Responsable</TableHead>
                <TableHead className="text-right whitespace-nowrap">Debe (ingresos)</TableHead>
                <TableHead className="text-right whitespace-nowrap">Haber (egresos)</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                {canWrite && <TableHead className="text-right">Acciones</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canWrite ? 8 : 7} className="text-center text-muted-foreground py-6">Cargando...</TableCell></TableRow>
              ) : (
                <>
                  <TableRow className="bg-muted/30">
                    <TableCell className="text-muted-foreground">—</TableCell>
                    <TableCell colSpan={3} className="font-medium text-muted-foreground">Saldo inicial</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right text-muted-foreground">—</TableCell>
                    <TableCell className="text-right font-semibold">{fmtMoney(balance?.opening_balance || 0)}</TableCell>
                    {canWrite && <TableCell />}
                  </TableRow>
                  {ledger.length === 0 ? (
                    <TableRow><TableCell colSpan={canWrite ? 8 : 7} className="text-center text-muted-foreground py-6">Sin movimientos</TableCell></TableRow>
                  ) : ledger.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{format(new Date(t.movement_date + "T00:00:00"), "dd/MM/yyyy", { locale: es })}</TableCell>
                      <TableCell>{t.category || "-"}</TableCell>
                      <TableCell className="max-w-[220px] truncate">{t.description || "-"}</TableCell>
                      <TableCell className="whitespace-nowrap">{t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : "-"}</TableCell>
                      <TableCell className="text-right font-medium text-green-600">{t.type === "ingreso" ? fmtMoney(Number(t.amount)) : ""}</TableCell>
                      <TableCell className="text-right font-medium text-red-600">{t.type === "egreso" ? fmtMoney(Number(t.amount)) : ""}</TableCell>
                      <TableCell className={`text-right font-semibold ${t.saldo >= 0 ? "" : "text-red-700"}`}>{fmtMoney(t.saldo)}</TableCell>
                      {canWrite && (
                        <TableCell className="text-right whitespace-nowrap">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(t)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </>
              )}
            </TableBody>
            {!isLoading && (
              <TableFooter>
                <TableRow className="bg-muted/60 font-semibold">
                  <TableCell colSpan={4} className="text-right">Totales</TableCell>
                  <TableCell className="text-right text-green-700">{fmtMoney(balance?.total_ingresos || 0)}</TableCell>
                  <TableCell className="text-right text-red-700">{fmtMoney(balance?.total_egresos || 0)}</TableCell>
                  <TableCell className={`text-right ${(balance?.balance || 0) >= 0 ? "text-green-800" : "text-red-800"}`}>{fmtMoney(balance?.balance || 0)}</TableCell>
                  {canWrite && <TableCell />}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </CardContent>
      </Card>
      )}

      {/* Saldo inicial dialog */}
      <Dialog open={obDialogOpen} onOpenChange={setObDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Saldo inicial — {String(deptName)}</DialogTitle></DialogHeader>
          <div className="flex flex-col gap-1">
            <Label>Monto de apertura</Label>
            <Input type="number" step="0.01" value={obValue} onChange={(e) => setObValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setObDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => obMutation.mutate()} disabled={obMutation.isPending}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar borrado */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar movimiento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el movimiento de {deleteTarget?.category || "sin concepto"} por {fmtMoney(Number(deleteTarget?.amount || 0))}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
