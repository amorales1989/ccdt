import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import {
  getAllCompanies,
  createCompany,
  setCompanyStatus,
  updateCompanyInfo,
  deleteCompany,
  getCompanyAdmins,
  createCompanyAdmin,
  updateAdminPassword,
  type AdminCompany,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Building2, Plus, KeyRound, Loader2, Users, UserRound, CheckCircle2, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

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

  const openEdit = (c: AdminCompany) => {
    setEditForm({ name: c.name, congregation_name: c.congregation_name || "" });
    setEditTarget(c);
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
      <div className="p-4 md:p-6 pb-28 max-w-[1400px] mx-auto animate-fade-in space-y-6">
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
          <Button
            onClick={() => setNewOpen(true)}
            className="button-gradient rounded-xl font-black h-11 px-5 shadow-lg shadow-primary/20 hover:shadow-primary/30 active:scale-95 transition-all"
          >
            <Plus className="h-4 w-4 mr-2" /> Nueva empresa
          </Button>
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
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Estado</TableCell>
                <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-right">Acciones</TableCell>
              </TableRow>

              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : companies.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-slate-400 py-12 font-medium">
                    No hay empresas todavía.
                  </TableCell>
                </TableRow>
              ) : (
                companies.map((c) => (
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
                        <Users className="h-3.5 w-3.5" /> {c.member_count}
                      </span>
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
                          className={c.is_active
                            ? "bg-emerald-50 text-emerald-700 border-emerald-100/50 text-[10px] font-bold"
                            : "bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold"}
                        >
                          {c.is_active ? "Activa" : "Inactiva"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-bold shadow-sm"
                          onClick={() => setAdminCompany(c)}
                        >
                          <KeyRound className="h-4 w-4 mr-1.5" /> Admin
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
                ))
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

      {/* Gestionar admin de empresa */}
      <AdminDialog company={adminCompany} onClose={() => setAdminCompany(null)} />
    </div>
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
