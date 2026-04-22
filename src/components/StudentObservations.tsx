import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getObservations, addObservation, updateObservation, deleteObservation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Plus, Loader2, User, Pencil, Trash2, X, Check, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface StudentObservationsProps {
    studentId: string;
}

export const StudentObservations = ({ studentId }: StudentObservationsProps) => {
    const [newObservation, setNewObservation] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState("");
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    const { data: observations = [], isLoading } = useQuery({
        queryKey: ["observations", studentId],
        queryFn: () => getObservations(studentId),
    });

    const addMutation = useMutation({
        mutationFn: (text: string) =>
            addObservation({
                student_id: studentId,
                observation: text,
                created_by: profile?.id || "",
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["observations", studentId] });
            setNewObservation("");
            toast({
                title: "Observación agregada",
                description: "La observación se ha guardado correctamente.",
            });
        },
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, text }: { id: string; text: string }) =>
            updateObservation(id, text),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["observations", studentId] });
            setEditingId(null);
            toast({
                title: "Observación actualizada",
                description: "Los cambios se han guardado correctamente.",
            });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => deleteObservation(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["observations", studentId] });
            toast({
                title: "Observación eliminada",
                description: "La observación ha sido borrada.",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newObservation.trim()) return;
        addMutation.mutate(newObservation);
    };

    const handleEdit = (obs: any) => {
        setEditingId(obs.id);
        setEditText(obs.observation);
    };

    const handleUpdate = () => {
        if (!editingId || !editText.trim()) return;
        updateMutation.mutate({ id: editingId, text: editText });
    };

    const canEdit = (obs: any) => {
        if (!profile || !obs.created_by) return false;
        // El dueño puede editar siempre (especialmente maestros según requerimiento)
        return obs.created_by === profile.id;
    };

    const canDelete = (obs: any) => {
        if (!profile || !obs.created_by) return false;
        const isOwner = obs.created_by === profile.id;
        const isAdminOrDirector = ["admin", "director", "director_general", "vicedirector"].includes(profile.role);
        return isOwner || isAdminOrDirector;
    };

    return (
        <div className="space-y-6 mt-6">
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Historial de Observaciones</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-amber-50 border border-amber-200/60 rounded-xl text-amber-900">
                    <Info className="h-4 w-4 shrink-0 text-amber-500" />
                    <p className="text-[11px] sm:text-xs font-medium italic leading-snug">
                        En caso de tratarse de información sensible tratarlo directamente con el director responsable.
                    </p>
                </div>
                <Textarea
                    placeholder="Agregar una nueva observación sobre el miembro..."
                    value={newObservation}
                    onChange={(e) => setNewObservation(e.target.value)}
                    className="min-h-[100px] glass-card border-primary/20 focus:border-primary/50"
                />
                <div className="flex justify-end">
                    <Button
                        type="submit"
                        disabled={addMutation.isPending || !newObservation.trim()}
                        className="group"
                    >
                        {addMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                            <Plus className="h-4 w-4 mr-2 group-hover:rotate-90 transition-transform" />
                        )}
                        Guardar Observación
                    </Button>
                </div>
            </form>

            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                ) : observations.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground bg-accent/5 rounded-lg border border-dashed">
                        No hay observaciones registradas para este miembro.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-primary/10 ml-2 sm:ml-4 pl-4 sm:pl-8 space-y-6">
                        {observations.map((obs) => (
                            <div key={obs.id} className="relative">
                                {/* Timeline dot */}
                                <div className="absolute -left-[23px] sm:-left-[37px] mt-1.5 h-3.5 w-3.5 rounded-full bg-primary border-2 border-background shadow-sm" />

                                <Card className="bg-none bg-white border-slate-200 shadow-sm hover:shadow-md transition-all duration-300 rounded-xl overflow-hidden border-l-4 border-l-primary/30">
                                    <CardContent className="p-3.5 sm:p-5">
                                        <div className="flex justify-between items-start gap-2 mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
                                                    <User className="h-4 w-4 text-slate-500" />
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-sm text-slate-800 leading-tight truncate">
                                                        {obs.profiles?.first_name} {obs.profiles?.last_name}
                                                    </span>
                                                    <span className="text-[10px] text-muted-foreground font-medium">
                                                        {format(new Date(obs.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                                    </span>
                                                </div>
                                            </div>

                                            {(canEdit(obs) || canDelete(obs)) && editingId !== obs.id && (
                                                <div className="flex items-center gap-0.5 bg-slate-50/80 p-0.5 rounded-lg border border-slate-100/50 shrink-0">
                                                    {canEdit(obs) && (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-slate-400 hover:text-primary hover:bg-white shadow-none"
                                                            onClick={() => handleEdit(obs)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                    )}
                                                    {canDelete(obs) && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-slate-400 hover:text-destructive hover:bg-white shadow-none"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="bg-white rounded-3xl border-none shadow-2xl">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle className="text-xl font-bold">¿Eliminar observación?</AlertDialogTitle>
                                                                    <AlertDialogDescription className="text-slate-500">
                                                                        Esta acción no se puede deshacer. Se borrará permanentemente la observación del historial.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter className="mt-4">
                                                                    <AlertDialogCancel className="rounded-xl border-slate-200">Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => deleteMutation.mutate(obs.id)}
                                                                        className="bg-destructive text-white hover:bg-destructive/90 rounded-xl px-6"
                                                                    >
                                                                        Eliminar
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {editingId === obs.id ? (
                                            <div className="space-y-3 mt-2">
                                                <Textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    className="min-h-[100px] bg-slate-50/50 rounded-xl border-slate-200 focus:ring-primary/20 focus:border-primary/30"
                                                    placeholder="Edita tu observación..."
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditingId(null)}
                                                        disabled={updateMutation.isPending}
                                                        className="rounded-lg h-9 hover:bg-slate-100"
                                                    >
                                                        <X className="h-4 w-4 mr-1.5" /> Cancelar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleUpdate}
                                                        disabled={updateMutation.isPending || !editText.trim()}
                                                        className="rounded-lg h-9 shadow-sm"
                                                    >
                                                        {updateMutation.isPending ? (
                                                            <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
                                                        ) : (
                                                            <Check className="h-4 w-4 mr-1.5" />
                                                        )}
                                                        Guardar Cambios
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm sm:text-[15px] whitespace-pre-wrap leading-relaxed text-slate-600 bg-slate-50/50 p-3 sm:p-4 rounded-xl border border-slate-100/50">
                                                {obs.observation}
                                            </p>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};
