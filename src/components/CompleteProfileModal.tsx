import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, UserCircle, Save } from "lucide-react";
import { MuiDatePickerField } from "./MuiDatePickerField";
import { parseISO, format } from "date-fns";

export function CompleteProfileModal() {
    const { profile, user, getProfile } = useAuth();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [birthdateOpen, setBirthdateOpen] = useState(false);

    const [formData, setFormData] = useState({
        first_name: "",
        last_name: "",
        document_number: "",
        phone: "",
        birthdate: "",
        gender: "",
    });

    useEffect(() => {
        if (profile && !loading) {
            const wasPostponed = sessionStorage.getItem("profile_modal_postponed") === "true";

            const isMissingData =
                !profile.first_name?.trim() ||
                !profile.last_name?.trim() ||
                !profile.document_number?.trim() ||
                !profile.phone?.trim() ||
                !profile.birthdate ||
                !profile.gender;

            if (isMissingData && !wasPostponed) {
                setFormData({
                    first_name: profile.first_name || "",
                    last_name: profile.last_name || "",
                    document_number: profile.document_number || "",
                    phone: profile.phone || "",
                    birthdate: profile.birthdate || "",
                    gender: profile.gender || "",
                });
                setOpen(true);
            } else {
                setOpen(false);
            }
        }
    }, [profile, loading]);

    const handleSave = async () => {
        const missingFields = [];
        if (!formData.first_name?.trim()) missingFields.push("Nombre");
        if (!formData.last_name?.trim()) missingFields.push("Apellido");
        if (!formData.document_number?.trim()) missingFields.push("DNI");
        if (!formData.phone?.trim()) missingFields.push("Teléfono");
        if (!formData.birthdate) missingFields.push("Fecha de Nacimiento");
        if (!formData.gender) missingFields.push("Género");

        if (missingFields.length > 0) {
            toast({
                title: "Campos incompletos",
                description: `Por favor completa: ${missingFields.join(", ")}`,
                variant: "destructive",
            });
            return;
        }

        if (!user) return;

        try {
            setLoading(true);

            const { error } = await supabase
                .from("profiles")
                .update({
                    first_name: formData.first_name.trim(),
                    last_name: formData.last_name.trim(),
                    document_number: formData.document_number.trim(),
                    phone: formData.phone.trim(),
                    birthdate: formData.birthdate,
                    gender: formData.gender,
                })
                .eq("id", user.id);

            if (error) throw error;

            toast({
                title: "Perfil actualizado",
                description: "Tus datos han sido guardados correctamente.",
            });

            await getProfile(user.id);
            setOpen(false);
        } catch (error: any) {
            console.error("Error updating profile:", error);
            toast({
                title: "Error",
                description: "No se pudo actualizar el perfil. Intenta nuevamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleOpenChange = (isOpen: boolean) => {
        setOpen(isOpen);
        if (!isOpen) {
            sessionStorage.setItem("profile_modal_postponed", "true");
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[450px] overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <UserCircle className="h-6 w-6 text-purple-500" />
                        Completa tu Perfil
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        Para continuar, necesitamos que completes algunos datos básicos de tu cuenta.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="first_name">Nombre</Label>
                            <Input
                                id="first_name"
                                value={formData.first_name}
                                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                                disabled={loading}
                                placeholder="Tu nombre"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="last_name">Apellido</Label>
                            <Input
                                id="last_name"
                                value={formData.last_name}
                                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                                disabled={loading}
                                placeholder="Tu apellido"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="document_number">DNI</Label>
                        <Input
                            id="document_number"
                            value={formData.document_number}
                            onChange={(e) => setFormData({ ...formData, document_number: e.target.value.replace(/\D/g, '') })}
                            placeholder="DNI sin puntos"
                            disabled={loading}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="phone">Teléfono</Label>
                        <Input
                            id="phone"
                            value={formData.phone}
                            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                            placeholder="Ej: 54911..."
                            disabled={loading}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Fecha de Nacimiento</Label>
                            <MuiDatePickerField
                                value={formData.birthdate ? parseISO(formData.birthdate) : undefined}
                                onChange={(date) => setFormData({ ...formData, birthdate: date ? format(date, 'yyyy-MM-dd') : "" })}
                                open={birthdateOpen}
                                onOpenChange={setBirthdateOpen}
                                className="border rounded-md px-3 py-2 w-full h-10 border-input bg-background font-normal"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="gender">Género</Label>
                            <Select
                                value={formData.gender}
                                onValueChange={(value) => setFormData({ ...formData, gender: value })}
                                disabled={loading}
                            >
                                <SelectTrigger className="h-10">
                                    <SelectValue placeholder="Seleccionar" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="masculino">Masculino</SelectItem>
                                    <SelectItem value="femenino">Femenino</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => handleOpenChange(false)}
                        disabled={loading}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        Completar luego
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full sm:flex-1 bg-purple-600 hover:bg-purple-700 text-white h-12 text-lg font-bold order-1 sm:order-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            <>
                                <Save className="mr-2 h-5 w-5" />
                                Guardar y Continuar
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
