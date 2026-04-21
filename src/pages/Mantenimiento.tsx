import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    notifyMaintenanceRequest,
} from "@/lib/api";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Wrench, Plus, Clock, Loader2, CheckCircle2, AlertCircle, Trash2, Ban,
} from "lucide-react";

type Status = "pendiente" | "en_proceso" | "terminado" | "anulado";
type Priority = "baja" | "normal" | "alta";

interface MaintenanceRequest {
    id: string;
    title: string;
    description?: string;
    location?: string;
    status: Status;
    priority: Priority;
    requester_name?: string;
    created_at: string;
    updated_at: string;
}

const STATUS_LABELS: Record<Status, string> = {
    pendiente: "Pendiente",
    en_proceso: "En proceso",
    terminado: "Terminado",
    anulado: "Anulado",
};

const STATUS_COLORS: Record<Status, string> = {
    pendiente: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300",
    en_proceso: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300",
    terminado: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300",
    anulado: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 line-through",
};

const PRIORITY_COLORS: Record<Priority, string> = {
    baja: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300",
    normal: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300",
    alta: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-300",
};

const PRIORITY_LABELS: Record<Priority, string> = {
    baja: "Baja",
    normal: "Normal",
    alta: "Alta",
};

const StatusIcon = ({ status }: { status: Status }) => {
    if (status === "terminado") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (status === "en_proceso") return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    if (status === "anulado") return <Ban className="h-3.5 w-3.5" />;
    return <Clock className="h-3.5 w-3.5" />;
};

export default function Mantenimiento() {
    const { profile } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const isConserje = profile?.role === "conserje" || (profile?.roles && Array.isArray(profile.roles) && profile.roles.includes("conserje"));
    const isAdmin = profile?.role === "admin" || profile?.role === "director_general";
    const canSeeAll = isConserje || isAdmin;

    const [filterStatus, setFilterStatus] = useState<"all" | Status>("all");
    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [newForm, setNewForm] = useState({
        title: "",
        description: "",
        location: "",
        priority: "normal" as Priority,
    });

    // Redirect if not allowed
    if (!profile) return null;

    const companyId = profile.company_id;

    const { data: requests = [], isLoading } = useQuery<MaintenanceRequest[]>({
        queryKey: ["maintenance_requests", companyId, profile?.id, canSeeAll],
        queryFn: async () => {
            let query = (supabase as any)
                .from("maintenance_requests")
                .select("*")
                .eq("company_id", companyId);

            // Si no tiene permisos de administrador o conserje, filtrar solo sus propias solicitudes
            if (!canSeeAll) {
                query = query.eq("requested_by", profile.id);
            }

            const { data, error } = await query.order("created_at", { ascending: false });

            if (error) throw error;
            return data as unknown as MaintenanceRequest[];
        },
        enabled: !!companyId && !!profile?.id,
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }: { id: string; status: Status }) => {
            const { error } = await (supabase as any)
                .from("maintenance_requests")
                .update({ status })
                .eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["maintenance_requests", companyId] });
            toast({ title: "Estado actualizado" });
        },
        onError: () => {
            toast({ title: "Error al actualizar", variant: "destructive" });
        },
    });

    const createMutation = useMutation({
        mutationFn: async () => {
            const { error } = await (supabase as any).from("maintenance_requests").insert({
                title: newForm.title,
                description: newForm.description || null,
                location: newForm.location || null,
                priority: newForm.priority,
                status: "pendiente",
                requested_by: profile.id,
                requester_name: `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim() || "Sin nombre",
                company_id: companyId,
            });
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["maintenance_requests", companyId] });

            // Notificar al conserje si el solicitante no es el mismo conserje
            if (!isConserje) {
                notifyMaintenanceRequest({
                    title: newForm.title,
                    location: newForm.location,
                    requesterName: `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() || "Usuario",
                    description: newForm.description,
                    priority: newForm.priority
                }).catch(err => console.error("Error al enviar notificaciones:", err));
            }

            toast({ title: "Reparación registrada correctamente" });
            setNewDialogOpen(false);
            setNewForm({ title: "", description: "", location: "", priority: "normal" });
        },
        onError: () => {
            toast({ title: "Error al registrar", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const { error } = await (supabase as any).from("maintenance_requests").delete().eq("id", id);
            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["maintenance_requests", companyId] });
            toast({ title: "Eliminado correctamente" });
        },
    });

    const filtered = filterStatus === "all"
        ? requests
        : requests.filter((r) => r.status === filterStatus);

    const counts = {
        all: requests.length,
        pendiente: requests.filter((r) => r.status === "pendiente").length,
        en_proceso: requests.filter((r) => r.status === "en_proceso").length,
        terminado: requests.filter((r) => r.status === "terminado").length,
        anulado: requests.filter((r) => r.status === "anulado").length,
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric" });

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-orange-100 dark:bg-orange-900/30">
                        <Wrench className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                            Mantenimiento
                        </h1>
                        <p className="text-xs text-muted-foreground">Gestión de reparaciones del edificio</p>
                    </div>
                </div>
                <Button
                    onClick={() => setNewDialogOpen(true)}
                    className="bg-orange-500 hover:bg-orange-600 text-white shadow-sm shadow-orange-200 dark:shadow-none gap-1.5"
                    size="sm"
                >
                    <Plus className="h-4 w-4" />
                    {isConserje ? "Nueva reparación" : "Solicitar reparación"}
                </Button>
            </div>

            {/* Status filter tabs */}
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 h-auto flex-wrap gap-1 p-1">
                    {(["all", "pendiente", "en_proceso", "terminado", "anulado"] as const).map((s) => (
                        <TabsTrigger key={s} value={s} className="text-xs px-3 py-1.5 gap-1.5">
                            {s === "all" ? "Todas" : STATUS_LABELS[s]}
                            <span className="ml-1 text-[10px] font-bold bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full px-1.5 py-0.5">
                                {counts[s]}
                            </span>
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            {/* Table */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-50">
                            <TableHead className="text-xs font-semibold text-slate-500">Reparación</TableHead>
                            <TableHead className="hidden md:table-cell text-xs font-semibold text-slate-500">Ubicación</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Prioridad</TableHead>
                            <TableHead className="text-xs font-semibold text-slate-500">Estado</TableHead>
                            <TableHead className="hidden sm:table-cell text-xs font-semibold text-slate-500">Solicitado por</TableHead>
                            <TableHead className="hidden lg:table-cell text-xs font-semibold text-slate-500">Fecha</TableHead>
                            {(isConserje || isAdmin) && (
                                <TableHead className="text-xs font-semibold text-slate-500 text-right">Acciones</TableHead>
                            )}
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-orange-400" />
                                </TableCell>
                            </TableRow>
                        ) : filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground italic text-sm">
                                    No hay reparaciones
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((req) => (
                                <TableRow key={req.id} className="hover:bg-orange-50/20 dark:hover:bg-orange-900/5 transition-colors">
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{req.title}</span>
                                            {req.description && (
                                                <span className="text-xs text-muted-foreground line-clamp-1">{req.description}</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                                        {req.location || <span className="italic">Sin especificar</span>}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className={`${PRIORITY_COLORS[req.priority]} text-[10px] font-semibold capitalize`}>
                                            {req.priority === "alta" && <AlertCircle className="h-3 w-3 mr-1" />}
                                            {PRIORITY_LABELS[req.priority]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        {req.status === "anulado" ? (
                                            // Anulado: always show as static badge, never a dropdown
                                            <Badge variant="outline" className={`${STATUS_COLORS[req.status]} text-[10px] font-semibold flex items-center gap-1 w-fit`}>
                                                <StatusIcon status={req.status} />
                                                {STATUS_LABELS[req.status]}
                                            </Badge>
                                        ) : (isConserje || isAdmin) ? (
                                            <Select
                                                value={req.status}
                                                onValueChange={(val) => updateStatusMutation.mutate({ id: req.id, status: val as Status })}
                                            >
                                                <SelectTrigger className={`h-7 text-[10px] font-semibold w-[120px] border rounded-full px-2 ${STATUS_COLORS[req.status]}`}>
                                                    <div className="flex items-center gap-1">
                                                        <StatusIcon status={req.status} />
                                                        <SelectValue />
                                                    </div>
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="pendiente">Pendiente</SelectItem>
                                                    <SelectItem value="en_proceso">En proceso</SelectItem>
                                                    <SelectItem value="terminado">Terminado</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        ) : (
                                            <Badge variant="outline" className={`${STATUS_COLORS[req.status]} text-[10px] font-semibold flex items-center gap-1 w-fit`}>
                                                <StatusIcon status={req.status} />
                                                {STATUS_LABELS[req.status]}
                                            </Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="hidden sm:table-cell text-xs text-muted-foreground">
                                        {req.requester_name || "—"}
                                    </TableCell>
                                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                                        {formatDate(req.created_at)}
                                    </TableCell>
                                    {(isConserje || isAdmin) && (
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-1">
                                                {/* Anular: conserje can annul if not already anulado/terminado */}
                                                {isConserje && req.status !== "anulado" && req.status !== "terminado" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Anular reparación"
                                                        className="h-7 w-7 text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                                                        onClick={() => updateStatusMutation.mutate({ id: req.id, status: "anulado" })}
                                                    >
                                                        <Ban className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                                {/* Delete: only admin/secretaria */}
                                                {isAdmin && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        title="Eliminar"
                                                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                                        onClick={() => deleteMutation.mutate(req.id)}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    )}
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* New request / repair dialog */}
            <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Wrench className="h-4 w-4 text-orange-500" />
                            {isConserje ? "Nueva reparación" : "Solicitar reparación"}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label htmlFor="maint-title">Título *</Label>
                            <Input
                                id="maint-title"
                                placeholder="Ej: Puerta del baño rota"
                                value={newForm.title}
                                onChange={(e) => setNewForm((f) => ({ ...f, title: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="maint-location">Ubicación</Label>
                            <Input
                                id="maint-location"
                                placeholder="Ej: Salón principal, Baño 2do piso"
                                value={newForm.location}
                                onChange={(e) => setNewForm((f) => ({ ...f, location: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label htmlFor="maint-desc">Descripción</Label>
                            <Textarea
                                id="maint-desc"
                                placeholder="Detalles adicionales de la reparación..."
                                rows={3}
                                value={newForm.description}
                                onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
                            />
                        </div>
                        <div>
                            <Label>Prioridad</Label>
                            <Select value={newForm.priority} onValueChange={(v) => setNewForm((f) => ({ ...f, priority: v as Priority }))}>
                                <SelectTrigger className="mt-1">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="baja">🟢 Baja</SelectItem>
                                    <SelectItem value="normal">🔵 Normal</SelectItem>
                                    <SelectItem value="alta">🔴 Alta</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={!newForm.title.trim() || createMutation.isPending}
                            className="bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {createMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            ) : (
                                <Plus className="h-4 w-4 mr-1" />
                            )}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
