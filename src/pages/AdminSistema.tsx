import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getAllCompanies,
  createCompany,
  setCompanyStatus,
  setCompanyPlan,
  setCompanyPacks,
  updateCompanyInfo,
  deleteCompany,
  getCompanyAdmins,
  createCompanyAdmin,
  updateAdminPassword,
  recordPayment,
  getCompanyPayments,
  getPlans,
  updatePlanPricing,
  type AdminCompany,
  type Payment,
  type PlanRow,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, KeyRound, Loader2, Users, UserRound, CheckCircle2, Eye, EyeOff, Pencil, Trash2, Layers, Wallet, DollarSign } from "lucide-react";
import { PLANS, planLabel, effectiveLimit } from "@/lib/plans";

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric" });
};

export default function AdminSistema() {
  const { profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [newOpen, setNewOpen] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: "", congregation_name: "", email: "", password: "" });
  const [showNewPw, setShowNewPw] = useState(false);

  const [adminCompany, setAdminCompany] = useState<AdminCompany | null>(null);
  const [editTarget, setEditTarget] = useState<AdminCompany | null>(null);
  const [editForm, setEditForm] = useState({ name: "", congregation_name: "" });
  const [deleteTarget, setDeleteTarget] = useState<AdminCompany | null>(null);
  const [planTarget, setPlanTarget] = useState<AdminCompany | null>(null);
  const [planValue, setPlanValue] = useState<string>("");
  const [packsValue, setPacksValue] = useState<number>(0);
  const [payTarget, setPayTarget] = useState<AdminCompany | null>(null);
  const [payForm, setPayForm] = useState<{ amount: string; billing_cycle: "mensual" | "anual"; notes: string; payment_date: string }>({ amount: "", billing_cycle: "mensual", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
  const [pricesOpen, setPricesOpen] = useState(false);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["admin-companies"],
    queryFn: getAllCompanies,
    enabled: profile?.role === "system_admin",
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: number; is_active: boolean }) => setCompanyStatus(id, is_active),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-companies"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => updateCompanyInfo(editTarget!.id, {
      name: editForm.name,
      congregation_name: editForm.congregation_name || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast({ title: "Empresa actualizada" });
      setEditTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteCompany(deleteTarget!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast({ title: "Empresa eliminada" });
      setDeleteTarget(null);
    },
    onError: (e: any) => toast({ title: "No se pudo eliminar", description: e.message, variant: "destructive" }),
  });

  const planMutation = useMutation({
    mutationFn: async () => {
      await setCompanyPlan(planTarget!.id, planValue || null);
      await setCompanyPacks(planTarget!.id, packsValue);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast({ title: "Plan actualizado" });
      setPlanTarget(null);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const payMutation = useMutation({
    mutationFn: () => recordPayment(payTarget!.id, {
      amount: Number(payForm.amount),
      billing_cycle: payForm.billing_cycle,
      source: "manual",
      notes: payForm.notes || undefined,
      payment_date: payForm.payment_date || undefined,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      queryClient.invalidateQueries({ queryKey: ["company-payments", payTarget?.id] });
      toast({ title: "Pago registrado" });
      setPayTarget(null);
      setPayForm({ amount: "", billing_cycle: "mensual", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const openPay = (c: AdminCompany) => {
    setPayForm({ amount: "", billing_cycle: (c.billing_cycle as "mensual" | "anual") || "mensual", notes: "", payment_date: new Date().toISOString().slice(0, 10) });
    setPayTarget(c);
  };

  const openEdit = (c: AdminCompany) => {
    setEditForm({ name: c.name, congregation_name: c.congregation_name || "" });
    setEditTarget(c);
  };

  const openPlan = (c: AdminCompany) => {
    setPlanValue(c.plan || "");
    setPacksValue(c.extra_member_packs || 0);
    setPlanTarget(c);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const company = await createCompany({
        name: newCompany.name,
        congregation_name: newCompany.congregation_name || undefined,
      });
      await createCompanyAdmin(company.id, { email: newCompany.email, password: newCompany.password });
      return company;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-companies"] });
      toast({ title: "Empresa creada", description: "Empresa y admin creados correctamente." });
      setNewOpen(false);
      setNewCompany({ name: "", congregation_name: "", email: "", password: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (profile && profile.role !== "system_admin") {
    return <Navigate to="/" replace />;
  }

  const totalUsers = companies.reduce((acc, c) => acc + c.user_count, 0);
  const totalMembers = companies.reduce((acc, c) => acc + c.member_count, 0);
  const activeCount = companies.filter((c) => c.is_active).length;

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 w-full animate-fade-in space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 p-3 rounded-2xl shadow-inner">
              <Building2 className="h-7 w-7 text-purple-600" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Empresas</h1>
              <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Administración del sistema</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setPricesOpen(true)}
              className="rounded-xl font-black h-11 px-5 border-slate-200"
            >
              <DollarSign className="h-4 w-4 mr-2" /> Precios de planes
            </Button>
            <Button
              onClick={() => setNewOpen(true)}
              className="button-gradient rounded-xl font-black h-11 px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
            >
              <Plus className="h-4 w-4 mr-2" /> Nueva empresa
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={<Building2 className="h-5 w-5 text-purple-600" />} label="Empresas" value={companies.length} />
          <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} label="Activas" value={activeCount} />
          <StatCard icon={<UserRound className="h-5 w-5 text-blue-600" />} label="Usuarios" value={totalUsers} />
          <StatCard icon={<Users className="h-5 w-5 text-indigo-600" />} label="Miembros" value={totalMembers} />
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <Table>
            <TableBody>
              <TableRow className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50">
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 w-[80px]">ID</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4">Empresa</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Usuarios</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Miembros</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Plan</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Último pago</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Próx. vto</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Estado</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-right">Acciones</TableCell>
              </TableRow>

              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-slate-400 py-12 font-medium">
                    No hay empresas todavía.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => {
                const expired = !!(c.due_date && c.due_date < new Date().toISOString().slice(0, 10));
                return (
                  <TableRow key={c.id} className="group border-b border-slate-100/60 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-slate-800/30 transition-colors">
                    <TableCell className="p-4">
                      <span className="font-mono text-xs font-bold text-slate-400 bg-slate-100/70 dark:bg-slate-800 px-2.5 py-1 rounded-lg">{c.id}</span>
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 flex items-center justify-center flex-shrink-0">
                          <Building2 className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">{c.name}</span>
                          {c.congregation_name && (
                            <span className="text-xs text-slate-400 dark:text-slate-500">{c.congregation_name}</span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-center">
                      <span className="inline-flex items-center gap-1.5 bg-slate-100/60 dark:bg-slate-800 px-3 py-1 rounded-full border border-slate-200/40 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300">
                        <UserRound className="h-3.5 w-3.5 text-slate-400" /> {c.user_count}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-center">
                      <span className="inline-flex items-center gap-1.5 bg-indigo-50/60 dark:bg-indigo-900/20 px-3 py-1 rounded-full border border-indigo-100/50 dark:border-indigo-800 text-sm font-bold text-indigo-600 dark:text-indigo-300">
                        <Users className="h-3.5 w-3.5" /> {c.member_count}{(() => { const l = effectiveLimit(c.plan, c.extra_member_packs); return l == null ? '' : ` / ${l}`; })()}
                      </span>
                    </TableCell>
                    <TableCell className="p-4 text-center">
                      {planLabel(c.plan) ? (
                        <Badge variant="secondary" className="bg-purple-50 text-purple-700 border-purple-100/50 text-[10px] font-bold">
                          {planLabel(c.plan)}
                        </Badge>
                      ) : (
                        <span className="text-sm font-medium text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                      {formatDate(c.last_payment_date)}
                    </TableCell>
                    <TableCell className="p-4 text-center text-sm font-medium text-slate-500 dark:text-slate-400">
                      {formatDate(c.due_date)}
                    </TableCell>
                    <TableCell className="p-4">
                      <div className="flex items-center justify-center gap-2">
                        <Switch
                          checked={c.is_active}
                          disabled={statusMutation.isPending}
                          onCheckedChange={(v) => statusMutation.mutate({ id: c.id, is_active: v })}
                        />
                        <Badge
                          variant="secondary"
                          className={!c.is_active
                            ? "bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold"
                            : expired
                              ? "bg-red-50 text-red-700 border-red-100/50 text-[10px] font-bold"
                              : "bg-emerald-50 text-emerald-700 border-emerald-100/50 text-[10px] font-bold"}
                        >
                          {!c.is_active ? "Inactiva" : expired ? "Vencida" : "Activa"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/10"
                          title="Gestionar admin"
                          onClick={() => setAdminCompany(c)}
                        >
                          <KeyRound className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/10"
                          title="Cambiar plan"
                          onClick={() => openPlan(c)}
                        >
                          <Layers className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/10"
                          title="Registrar pago"
                          onClick={() => openPay(c)}
                        >
                          <Wallet className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-primary/10"
                          title="Editar empresa"
                          onClick={() => openEdit(c)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 rounded-xl text-red-500 hover:text-red-600 hover:bg-red-50"
                          title="Eliminar empresa"
                          onClick={() => setDeleteTarget(c)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );})
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Crear empresa + admin */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>Nueva empresa</DialogTitle>
            <DialogDescription>Se crea la empresa y su usuario administrador.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa *</Label>
              <Input className="rounded-xl bg-slate-50 border-slate-200 h-11" value={newCompany.name} onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nombre congregación</Label>
              <Input className="rounded-xl bg-slate-50 border-slate-200 h-11" value={newCompany.congregation_name} onChange={(e) => setNewCompany({ ...newCompany, congregation_name: e.target.value })} />
            </div>
            <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-4">
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Administrador</p>
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input type="email" className="rounded-xl bg-white border-slate-200 h-11" value={newCompany.email} onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Contraseña *</Label>
                <div className="relative">
                  <Input type={showNewPw ? "text" : "password"} className="rounded-xl bg-white border-slate-200 h-11 pr-11" placeholder="Mínimo 6 caracteres" value={newCompany.password} onChange={(e) => setNewCompany({ ...newCompany, password: e.target.value })} />
                  <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={() => setNewOpen(false)}>Cancelar</Button>
            <Button
              className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !newCompany.name || !newCompany.email || newCompany.password.length < 6}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar empresa */}
      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>Editar empresa</DialogTitle>
            <DialogDescription>Actualizá los datos de la empresa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre de la empresa *</Label>
              <Input className="rounded-xl bg-slate-50 border-slate-200 h-11" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Nombre congregación</Label>
              <Input className="rounded-xl bg-slate-50 border-slate-200 h-11" value={editForm.congregation_name} onChange={(e) => setEditForm({ ...editForm, congregation_name: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={() => setEditTarget(null)}>Cancelar</Button>
            <Button
              className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20"
              onClick={() => editMutation.mutate()}
              disabled={editMutation.isPending || !editForm.name}
            >
              {editMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Eliminar empresa */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Solo se puede eliminar una empresa sin usuarios ni miembros asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl font-bold">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl font-black bg-red-600 hover:bg-red-700"
              onClick={(e) => { e.preventDefault(); deleteMutation.mutate(); }}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cambiar plan */}
      <Dialog open={!!planTarget} onOpenChange={(o) => !o && setPlanTarget(null)}>
        <DialogContent className="rounded-2xl border-slate-200">
          <DialogHeader>
            <DialogTitle>Plan de {planTarget?.name}</DialogTitle>
            <DialogDescription>Elegí el plan de la congregación.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Plan</Label>
            <Select value={planValue} onValueChange={setPlanValue}>
              <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11">
                <SelectValue placeholder="Sin plan" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {PLANS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label} — {p.limit == null ? "ilimitado" : `hasta ${p.limit} miembros`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Packs de miembros extra (+25 c/u)</Label>
            <Input type="number" min={0} className="rounded-xl bg-slate-50 border-slate-200 h-11"
              value={packsValue}
              onChange={(e) => setPacksValue(Math.max(0, parseInt(e.target.value, 10) || 0))} />
            <p className="text-xs text-slate-400">Cada pack agrega 25 miembros a la capacidad del plan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={() => setPlanTarget(null)}>Cancelar</Button>
            <Button
              className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20"
              onClick={() => planMutation.mutate()}
              disabled={planMutation.isPending}
            >
              {planMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Registrar pago */}
      <PayDialog
        company={payTarget}
        form={payForm}
        setForm={setPayForm}
        onSubmit={() => payMutation.mutate()}
        isPending={payMutation.isPending}
        onClose={() => setPayTarget(null)}
      />

      {/* Gestionar admin de empresa */}
      <AdminDialog company={adminCompany} onClose={() => setAdminCompany(null)} />

      {/* Precios de planes */}
      <PricesDialog open={pricesOpen} onClose={() => setPricesOpen(false)} />
    </div>
  );
}

function PricesDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [edits, setEdits] = useState<Record<string, { price_monthly: string; pack_price_monthly: string }>>({});

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["plans"],
    queryFn: getPlans,
    enabled: open,
  });

  const getValue = (p: PlanRow, field: "price_monthly" | "pack_price_monthly") =>
    edits[p.value]?.[field] ?? String(p[field]);

  const setValue = (value: string, field: "price_monthly" | "pack_price_monthly", raw: string) => {
    setEdits((prev) => ({
      ...prev,
      [value]: {
        price_monthly: prev[value]?.price_monthly ?? String(plans.find((p) => p.value === value)?.price_monthly ?? 0),
        pack_price_monthly: prev[value]?.pack_price_monthly ?? String(plans.find((p) => p.value === value)?.pack_price_monthly ?? 0),
        [field]: raw,
      },
    }));
  };

  const saveMutation = useMutation({
    mutationFn: (value: string) => updatePlanPricing(value, {
      price_monthly: Number(getValue(plans.find((p) => p.value === value)!, "price_monthly")),
      pack_price_monthly: Number(getValue(plans.find((p) => p.value === value)!, "pack_price_monthly")),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans"] });
      toast({ title: "Precio actualizado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl border-slate-200 max-w-2xl">
        <DialogHeader>
          <DialogTitle>Precios de planes</DialogTitle>
          <DialogDescription>Precio mensual por plan y por pack extra. Anual = ×10.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {plans.map((p) => (
              <div key={p.value} className="rounded-2xl border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  {p.label} <span className="text-xs text-slate-400 font-medium">({p.member_limit == null ? "ilimitado" : `hasta ${p.member_limit}`})</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Precio mensual</Label>
                    <Input
                      type="number" min={0} className="rounded-xl bg-slate-50 border-slate-200 h-10"
                      value={getValue(p, "price_monthly")}
                      onChange={(e) => setValue(p.value, "price_monthly", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Precio pack (+25)</Label>
                    <Input
                      type="number" min={0} className="rounded-xl bg-slate-50 border-slate-200 h-10"
                      value={getValue(p, "pack_price_monthly")}
                      onChange={(e) => setValue(p.value, "pack_price_monthly", e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  className="button-gradient rounded-xl font-black"
                  onClick={() => saveMutation.mutate(p.value)}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Guardar
                </Button>
              </div>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={onClose}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 rounded-2xl shadow-sm p-4 flex items-center gap-3">
      <div className="bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl">{icon}</div>
      <div>
        <div className="text-2xl font-black text-slate-800 dark:text-slate-100 leading-none">{value}</div>
        <div className="text-xs font-medium text-slate-400 mt-1">{label}</div>
      </div>
    </div>
  );
}

function AdminDialog({ company, onClose }: { company: AdminCompany | null; onClose: () => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ["company-admins", company?.id],
    queryFn: () => getCompanyAdmins(company!.id),
    enabled: !!company,
  });

  const pwMutation = useMutation({
    mutationFn: () => updateAdminPassword(selectedAdminId!, password),
    onSuccess: () => {
      toast({ title: "Contraseña actualizada" });
      setPassword("");
      setSelectedAdminId(null);
      onClose();
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle>Admin de {company?.name}</DialogTitle>
          <DialogDescription>Editar la contraseña del administrador.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : admins.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 font-medium">Esta empresa no tiene admins.</p>
        ) : (
          <div className="space-y-3">
            {admins.map((a) => (
              <button
                key={a.id}
                onClick={() => setSelectedAdminId(a.id)}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${
                  selectedAdminId === a.id
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-950/30"
                    : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <div className="font-bold text-sm text-slate-800 dark:text-slate-100">{a.first_name} {a.last_name}</div>
                <div className="text-xs text-slate-400">{a.email}</div>
              </button>
            ))}
            {selectedAdminId && (
              <div className="space-y-2 border-t pt-4">
                <Label>Nueva contraseña</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} className="rounded-xl bg-slate-50 border-slate-200 h-11 pr-11" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={onClose}>Cerrar</Button>
          <Button
            className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20"
            onClick={() => pwMutation.mutate()}
            disabled={!selectedAdminId || password.length < 6 || pwMutation.isPending}
          >
            {pwMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Cambiar contraseña
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PayDialog({
  company, form, setForm, onSubmit, isPending, onClose,
}: {
  company: AdminCompany | null;
  form: { amount: string; billing_cycle: "mensual" | "anual"; notes: string; payment_date: string };
  setForm: (f: { amount: string; billing_cycle: "mensual" | "anual"; notes: string; payment_date: string }) => void;
  onSubmit: () => void;
  isPending: boolean;
  onClose: () => void;
}) {
  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["company-payments", company?.id],
    queryFn: () => getCompanyPayments(company!.id),
    enabled: !!company,
  });

  return (
    <Dialog open={!!company} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-2xl border-slate-200">
        <DialogHeader>
          <DialogTitle>Registrar pago — {company?.name}</DialogTitle>
          <DialogDescription>El monto lo definís manualmente. Extiende la suscripción desde hoy o desde el vencimiento actual.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Monto (ARS) *</Label>
            <Input
              type="number" min={0} step="0.01"
              className="rounded-xl bg-slate-50 border-slate-200 h-11"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Fecha de pago</Label>
            <Input
              type="date"
              max={new Date().toISOString().slice(0, 10)}
              className="rounded-xl bg-slate-50 border-slate-200 h-11"
              value={form.payment_date}
              onChange={(e) => setForm({ ...form, payment_date: e.target.value })}
            />
            <p className="text-[11px] text-slate-400">Si pagó otro día, seleccionalo. El vencimiento se calcula desde esta fecha.</p>
          </div>
          <div className="space-y-2">
            <Label>Ciclo</Label>
            <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v as "mensual" | "anual" })}>
              <SelectTrigger className="rounded-xl bg-slate-50 border-slate-200 h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="anual">Anual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Nota</Label>
            <Input
              className="rounded-xl bg-slate-50 border-slate-200 h-11"
              placeholder="Ej: transferencia, efectivo..."
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>

        <div className="border-t pt-4 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Historial de pagos</p>
          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-4 w-4 animate-spin" /></div>
          ) : payments.length === 0 ? (
            <p className="text-sm text-slate-400 font-medium py-2">Sin pagos registrados.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="text-xs bg-slate-50 dark:bg-slate-800/50 rounded-xl p-3 flex flex-col gap-0.5">
                  <div className="flex justify-between font-bold text-slate-700 dark:text-slate-200">
                    <span>{formatDate(p.created_at)}</span>
                    <span>{p.currency} {p.amount}</span>
                  </div>
                  <div className="text-slate-400">
                    {p.billing_cycle || "—"} · {formatDate(p.period_start)} → {formatDate(p.period_end)} · {p.source}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" className="rounded-xl border-slate-200 font-bold" onClick={onClose}>Cancelar</Button>
          <Button
            className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20"
            onClick={onSubmit}
            disabled={isPending || !form.amount || Number(form.amount) < 0}
          >
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Registrar pago
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
