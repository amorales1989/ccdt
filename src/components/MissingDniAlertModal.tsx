import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, FileText, Check, Loader2, X } from "lucide-react";
import { updateStudent } from "@/lib/api";
import { toast } from "sonner";
import type { Student } from "@/types/database";
import { isDemoMode } from "@/lib/demo";

interface Props {
    profileId: string;
    students: Student[];
}

export function MissingDniAlertModal({ profileId, students }: Props) {
    const queryClient = useQueryClient();
    const [open, setOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [dniInput, setDniInput] = useState("");
    const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

    const missing = useMemo(
        () => students.filter((s) => !s.document_number || !String(s.document_number).trim()),
        [students]
    );

    useEffect(() => {
        if (missing.length === 0) return;
        setOpen(true);
    }, [missing.length, profileId]);

    const { mutate: saveDni, isPending } = useMutation({
        mutationFn: ({ id, dni }: { id: string; dni: string }) =>
            updateStudent(id, { document_number: dni } as any),
        onSuccess: (_data, vars) => {
            toast.success("DNI cargado");
            setSavedIds((prev) => new Set(prev).add(vars.id));
            setEditingId(null);
            setDniInput("");
            queryClient.invalidateQueries({ queryKey: ["students"] });
        },
        onError: (err: any) => {
            toast.error(err?.message || "No se pudo guardar el DNI");
        },
    });

    const handleSave = (id: string) => {
        const dni = dniInput.trim();
        if (!dni) {
            toast.error("Ingresá el DNI");
            return;
        }
        saveDni({ id, dni });
    };

    const visible = missing.filter((s) => !savedIds.has(s.id));
    if (missing.length === 0 || isDemoMode()) return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-100 p-2 rounded-xl">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                        </div>
                        <div>
                            <DialogTitle>Miembros sin DNI</DialogTitle>
                            <DialogDescription>
                                {visible.length} pendiente{visible.length !== 1 ? "s" : ""}. Tocá un miembro para cargar el DNI.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                {visible.length === 0 ? (
                    <div className="py-8 text-center text-sm text-emerald-600 font-semibold">
                        ¡Listo! Todos los DNI fueron cargados.
                    </div>
                ) : (
                    <ul className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                        {visible.map((s) => {
                            const isFemale = (s.gender || "").toLowerCase() === "femenino";
                            const isEditing = editingId === s.id;
                            return (
                                <li key={s.id} className="px-3 py-2.5">
                                    <div
                                        className={`flex items-center gap-3 ${!isEditing ? "cursor-pointer" : ""}`}
                                        onClick={() => {
                                            if (isEditing) return;
                                            setEditingId(s.id);
                                            setDniInput("");
                                        }}
                                    >
                                        <Avatar className="h-9 w-9 border border-slate-200">
                                            <AvatarImage
                                                src={s.photo_url || (isFemale ? "/avatarM.png" : "/avatarH.png")}
                                                alt={s.first_name}
                                                className="object-cover"
                                            />
                                            <AvatarFallback className="text-xs font-bold bg-slate-100">
                                                {(s.first_name || "").charAt(0)}{(s.last_name || "").charAt(0)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-slate-800 truncate">
                                                {s.first_name} {s.last_name}
                                            </p>
                                            {!isEditing && (
                                                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <FileText className="h-3 w-3" /> Sin DNI
                                                </p>
                                            )}
                                        </div>
                                        {isEditing && (
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingId(null);
                                                    setDniInput("");
                                                }}
                                                className="text-slate-400 hover:text-slate-600"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        )}
                                    </div>

                                    {isEditing && (
                                        <div className="flex gap-2 mt-2 pl-12">
                                            <Input
                                                autoFocus
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                                placeholder="DNI"
                                                value={dniInput}
                                                onChange={(e) => setDniInput(e.target.value.replace(/\D/g, ""))}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter") handleSave(s.id);
                                                }}
                                                className="h-9"
                                                disabled={isPending}
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => handleSave(s.id)}
                                                disabled={isPending || !dniInput.trim()}
                                                className="h-9"
                                            >
                                                {isPending ? (
                                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                ) : (
                                                    <>
                                                        <Check className="h-3.5 w-3.5 mr-1" /> Cargar
                                                    </>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>
                        Cerrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
