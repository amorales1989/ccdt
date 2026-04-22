import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { getStaffReports, getEligibleStaff, createStaffReport, markStaffReportsAsRead, updateStaffReport, deleteStaffReport } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Plus, Users, FileText, Send, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CustomTabs } from "@/components/CustomTabs";
import { CheckCircle2 } from "lucide-react";

export default function InformesPersonal() {
    const { profile } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [newDialogOpen, setNewDialogOpen] = useState(false);
    const [editingReportId, setEditingReportId] = useState<string | null>(null);
    const [form, setForm] = useState({ targetUserId: "", report: "" });
    const [activeTab, setActiveTab] = useState("nuevos");

    const role = profile?.role || "";
    const department = localStorage.getItem('selectedDepartment') || profile?.departments?.[0] || "";
    const assignedClass = profile?.assigned_class || "";

    // Determinar permisos
    const isMaestro = role === "maestro";
    const isDirector = role === "director" || role === "vicedirector";
    const canWrite = isMaestro;
    const canViewOthers = isDirector || role === "admin" || role === "director_general";

    const { data: reports = [], isLoading: loadingReports } = useQuery({
        queryKey: ["staff_reports", role, profile?.id, department],
        queryFn: () => getStaffReports(role, profile?.id || "", department),
        enabled: !!profile?.id && (canWrite || canViewOthers),
        refetchInterval: canViewOthers ? 5000 : false, // Bulletproof "live" polling for directors
    });

    const { data: eligibleStaff = [], isLoading: loadingStaff } = useQuery({
        queryKey: ["eligible_staff", department, assignedClass],
        queryFn: () => getEligibleStaff(department, assignedClass),
        enabled: !!department && !!assignedClass && canWrite && newDialogOpen,
    });

    const handleMarkAsRead = async (id: string) => {
        try {
            await markStaffReportsAsRead([id]);
            queryClient.invalidateQueries({ queryKey: ["staff_reports"] });
            queryClient.invalidateQueries({ queryKey: ["unread_staff_reports"] });
            toast({ title: "Informe marcado como leído" });
        } catch (error) {
            console.error(error);
            toast({ title: "Error al marcar como leído", variant: "destructive" });
        }
    };

    // Suscripción en vivo (Realtime)
    useEffect(() => {
        if (!department) return; // Solo si sabemos qué departamento

        const channel = supabase
            .channel('public:staff_reports')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_reports' }, payload => {
                queryClient.invalidateQueries({ queryKey: ["staff_reports"] });
                queryClient.invalidateQueries({ queryKey: ["unread_staff_reports"] });
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [department, queryClient]);

    const createMutation = useMutation({
        mutationFn: async () => {
            if (editingReportId) {
                await updateStaffReport(editingReportId, {
                    report: form.report,
                    user_id: profile?.id || ""
                });
            } else {
                await createStaffReport({
                    target_user_id: form.targetUserId,
                    report: form.report,
                    department,
                    assigned_class: assignedClass,
                    created_by: profile?.id || "",
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff_reports"] });
            toast({ title: editingReportId ? "Informe actualizado" : "Informe creado correctamente" });
            setNewDialogOpen(false);
            setEditingReportId(null);
            setForm({ targetUserId: "", report: "" });
        },
        onError: (err) => {
            console.error(err);
            toast({ title: "Error al guardar el informe", variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await deleteStaffReport(id, profile?.id || "", role, department);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["staff_reports"] });
            toast({ title: "Informe eliminado" });
        },
        onError: (err) => {
            console.error(err);
            toast({ title: "Error al eliminar", variant: "destructive" });
        }
    });

    const handleEdit = (report: any) => {
        setEditingReportId(report.id);
        setForm({ targetUserId: report.target_user_id, report: report.report });
        setNewDialogOpen(true);
    };

    const formatDate = (iso: string) =>
        new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

    const renderReportCard = (report: any, showMarkAsRead: boolean = false) => (
        <div key={report.id} className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3 relative group">
            <div className="flex justify-between items-start gap-2">
                <div>
                    <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-1">
                        Sobre: {report.target?.first_name} {report.target?.last_name} ({report.target?.role || 'Personal'})
                    </p>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                        Escrito por: {report.author?.first_name} {report.author?.last_name}
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 px-2 py-1 rounded-md shrink-0">
                        {formatDate(report.created_at)}
                    </span>
                    <div className="flex gap-1">
                        {isMaestro && report.created_by === profile.id && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(report)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-7 px-2 text-[10px] font-semibold transition-all"
                            >
                                <Pencil className="w-3.5 h-3.5" />
                            </Button>
                        )}
                        {((isMaestro && report.created_by === profile.id) || isDirector) && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        disabled={deleteMutation.isPending}
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2 text-[10px] font-semibold transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>¿Eliminar este informe?</AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-600 dark:text-slate-400">
                                            Esta acción no se puede deshacer. El informe se eliminará permanentemente de los registros del sistema.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel className="border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
                                            Cancelar
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={() => deleteMutation.mutate(report.id)}
                                            className="bg-red-500 hover:bg-red-600 text-white shadow-sm"
                                        >
                                            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                                            Sí, eliminar
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                        {showMarkAsRead && (
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleMarkAsRead(report.id)}
                                className="text-green-600 hover:text-green-700 hover:bg-green-50 h-7 px-2 text-[10px] font-semibold transition-all"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg text-sm text-slate-700 dark:text-slate-300">
                {report.report}
            </div>
            {(report.department || report.assigned_class) && (
                <div className="flex gap-2">
                    {report.department && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                            {report.department}
                        </span>
                    )}
                    {report.assigned_class && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400">
                            Clase: {report.assigned_class}
                        </span>
                    )}
                </div>
            )}
        </div>
    );

    if (!profile) return null;

    return (
        <div className="p-4 md:p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/30">
                        <Users className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                            Informes de Personal
                        </h1>
                        <p className="text-xs text-muted-foreground">
                            {canViewOthers
                                ? "Revisión de informes del equipo"
                                : "Informes de colaboradores y maestros de tu clase"}
                        </p>
                    </div>
                </div>
                {canWrite && (
                    <Button
                        onClick={() => {
                            setEditingReportId(null);
                            setForm({ targetUserId: "", report: "" });
                            setNewDialogOpen(true);
                        }}
                        className="bg-purple-600 hover:bg-purple-700 text-white shadow-sm gap-1.5"
                        size="sm"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo Informe
                    </Button>
                )}
            </div>

            {/* List */}
            {loadingReports ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No hay informes disponibles</p>
                </div>
            ) : canViewOthers ? (
                <div className="space-y-4">
                    <CustomTabs
                        value={activeTab}
                        onChange={setActiveTab}
                        options={[
                            {
                                value: "nuevos",
                                label: (
                                    <span className="flex items-center">
                                        Nuevos
                                        {reports.filter((r: any) => !r.is_read).length > 0 && (
                                            <span className="ml-2 bg-red-500 text-white min-w-[18px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold">
                                                {reports.filter((r: any) => !r.is_read).length}
                                            </span>
                                        )}
                                    </span>
                                )
                            },
                            { value: "leidos", label: "Ya Leídos" }
                        ]}
                        className="mb-4 mx-0"
                    />
                    {activeTab === "nuevos" && (
                        <div className="outline-none">
                            {reports.filter((r: any) => !r.is_read).length === 0 ? (
                                <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <CheckCircle2 className="h-10 w-10 text-green-400/50 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Estás al día. No hay reportes nuevos.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {reports.filter((r: any) => !r.is_read).map((r: any) => renderReportCard(r, true))}
                                </div>
                            )}
                        </div>
                    )}
                    {activeTab === "leidos" && (
                        <div className="outline-none">
                            {reports.filter((r: any) => r.is_read).length === 0 ? (
                                <div className="text-center p-12 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-800">
                                    <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Aún no has leído ningún reporte.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4 md:grid-cols-2 opacity-80">
                                    {reports.filter((r: any) => r.is_read).map((r: any) => renderReportCard(r, false))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2">
                    {reports.map((report: any) => renderReportCard(report, false))}
                </div>
            )}

            {/* Create / Edit Dialog */}
            <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>{editingReportId ? "Editar Informe de Personal" : "Redactar Informe de Personal"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <Label>Colaborador / Maestro</Label>
                            <Select
                                value={form.targetUserId}
                                onValueChange={(val) => setForm({ ...form, targetUserId: val })}
                                disabled={loadingStaff || !!editingReportId}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder={loadingStaff ? "Cargando..." : "Selecciona un integrante..."} />
                                </SelectTrigger>
                                <SelectContent>
                                    {eligibleStaff
                                        .filter((staff: any) => staff.id !== profile.id) // Excluirse a uno mismo
                                        .map((staff: any) => (
                                            <SelectItem key={staff.id} value={staff.id}>
                                                {staff.first_name} {staff.last_name} - {staff.role}
                                            </SelectItem>
                                        ))}
                                    {eligibleStaff.filter((s: any) => s.id !== profile.id).length === 0 && !loadingStaff && (
                                        <SelectItem value="empty" disabled>No se encontraron integrantes en tu clase</SelectItem>
                                    )}
                                    {editingReportId && !eligibleStaff.find(s => s.id === form.targetUserId) && (
                                        /* Option fallback if the user is no longer in the class but report exists */
                                        <SelectItem value={form.targetUserId}>Usuario del informe</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>Informe de desempeño</Label>
                            <Textarea
                                rows={5}
                                placeholder="Escribe el informe detallado sobre el desempeño..."
                                value={form.report}
                                onChange={(e) => setForm({ ...form, report: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
                        <Button
                            onClick={() => createMutation.mutate()}
                            disabled={!form.targetUserId || form.targetUserId === 'empty' || !form.report.trim() || createMutation.isPending}
                            className="bg-purple-600 hover:bg-purple-700"
                        >
                            {createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                            {editingReportId ? "Guardar Cambios" : "Enviar Informe"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
