import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Phone } from "lucide-react";

export function PhoneCollectionModal() {
    const { profile, user, getProfile } = useAuth();
    const { toast } = useToast();
    const [open, setOpen] = useState(false);
    const [phone, setPhone] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Mostrar el modal si el usuario está logueado, el perfil cargado,
        // pero falta el número de teléfono.
        if (profile && !profile.phone) {
            setOpen(true);
        } else {
            setOpen(false);
        }
    }, [profile]);

    const handleSave = async () => {
        if (!phone || phone.trim().length < 8) {
            toast({
                title: "Número inválido",
                description: "Por favor ingresa un número de teléfono válido (ej: 54911...) ",
                variant: "destructive",
            });
            return;
        }

        if (!user) return;

        try {
            setLoading(true);

            // Limpiar y asegurar prefijo 549 (Argentina)
            let cleanPhone = phone.replace(/\D/g, ''); // Solo números

            // Si el usuario ingresó 549 al principio, lo quitamos para volverlo a poner estandarizado
            if (cleanPhone.startsWith('549')) {
                cleanPhone = cleanPhone.substring(3);
            } else if (cleanPhone.startsWith('54')) {
                cleanPhone = cleanPhone.substring(2);
            }

            // Quitar 0 inicial si lo tiene (prefijo)
            if (cleanPhone.startsWith('0')) {
                cleanPhone = cleanPhone.substring(1);
            }

            const finalPhone = `549${cleanPhone}`;

            const { error } = await supabase
                .from("profiles")
                .update({ phone: finalPhone })
                .eq("id", user.id);

            if (error) throw error;

            toast({
                title: "¡Gracias!",
                description: "Tu número de teléfono ha sido guardado exitosamente.",
            });

            // Refrescar el perfil en el contexto global
            await getProfile(user.id);

            setOpen(false);
        } catch (error: any) {
            console.error("Error saving phone:", error);
            toast({
                title: "Error",
                description: "No se pudo guardar el número. Intenta nuevamente.",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-2xl">
                        <Phone className="h-6 w-6 text-primary" />
                        Actualización Requerida
                    </DialogTitle>
                    <DialogDescription className="text-base pt-2">
                        Necesitamos tu número de teléfono para que puedas recibir **notificaciones de eventos vía WhatsApp**.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="phone">Número de Celular (con prefijo, sin 0 ni 15)</Label>
                        <div className="flex gap-2 items-center">
                            <span className="text-muted-foreground font-mono bg-muted px-3 py-2 rounded-md border">+54 9</span>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="Ej: 11 12345678"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                className="flex-1"
                                disabled={loading}
                                autoFocus
                            />
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Ingresa el código de área (sin 0) y el número (sin 15). Ejemplo: 1112345678
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        disabled={loading}
                        className="w-full sm:w-auto order-2 sm:order-1"
                    >
                        Luego
                    </Button>
                    <Button
                        onClick={handleSave}
                        disabled={loading || !phone}
                        className="w-full sm:w-auto order-1 sm:order-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Guardando...
                            </>
                        ) : (
                            "Guardar Número"
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
