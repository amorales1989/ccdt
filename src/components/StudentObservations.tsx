import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getObservations, addObservation, updateObservation, deleteObservation } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { format, differenceInMinutes } from "date-fns";
import { es } from "date-fns/locale";
import { MessageSquare, Plus, Loader2, User, Pencil, Trash2, X, Check } from "lucide-react";
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
        const isOwner = obs.created_by === profile.id;
        const minutesSinceCreation = differenceInMinutes(new Date(), new Date(obs.created_at));
        const isWithinTime = minutesSinceCreation < 60; // 1 hora
        return isOwner && isWithinTime;
    };

    return (
        <div className="space-y-6 mt-6">
            <div className="flex items-center gap-2 mb-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Historial de Observaciones</h3>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
                <Textarea
                    placeholder="Agregar una nueva observación sobre el alumno..."
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

            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                    </div>
                ) : observations.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground bg-accent/5 rounded-lg border border-dashed">
                        No hay observaciones registradas para este alumno.
                    </div>
                ) : (
                    <div className="relative border-l-2 border-primary/20 ml-3 pl-6 space-y-6">
                        {observations.map((obs) => (
                            <div key={obs.id} className="relative">
                                {/* Timeline dot */}
                                <div className="absolute -left-[31px] mt-1 h-3 w-3 rounded-full bg-primary border-2 border-background" />

                                <Card className="glass-card border-white/20 shadow-sm hover:shadow-md transition-shadow">
                                    <CardContent className="p-4">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                <User className="h-3 w-3" />
                                                <span className="font-medium text-primary/80">
                                                    {obs.profiles?.first_name} {obs.profiles?.last_name}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-xs text-muted-foreground">
                                                    {format(new Date(obs.created_at), "dd MMM yyyy, HH:mm", { locale: es })}
                                                </span>
                                                {canEdit(obs) && editingId !== obs.id && (
                                                    <div className="flex items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                            onClick={() => handleEdit(obs)}
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>

                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                >
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent className="bg-white">
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>¿Eliminar observación?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Esta acción no se puede deshacer. Se borrará permanentemente la observación.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                                                    <AlertDialogAction
                                                                        onClick={() => deleteMutation.mutate(obs.id)}
                                                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                                    >
                                                                        Eliminar
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {editingId === obs.id ? (
                                            <div className="space-y-3 mt-2">
                                                <Textarea
                                                    value={editText}
                                                    onChange={(e) => setEditText(e.target.value)}
                                                    className="min-h-[80px] bg-background/50"
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => setEditingId(null)}
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        <X className="h-4 w-4 mr-1" /> Cancelar
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        onClick={handleUpdate}
                                                        disabled={updateMutation.isPending || !editText.trim()}
                                                    >
                                                        {updateMutation.isPending ? (
                                                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                                                        ) : (
                                                            <Check className="h-4 w-4 mr-1" />
                                                        )}
                                                        Guardar
                                                    </Button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
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
