import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, ArrowRight, Loader2, CheckCircle2, ShieldCheck } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";

export default function ResetPassword() {
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isValidSession, setIsValidSession] = useState(false);
    const [isChecking, setIsChecking] = useState(true);
    const [logoPath, setLogoPath] = useState("/fire.png");
    const [companyName, setCompanyName] = useState("");
    const [showCompanyName, setShowCompanyName] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    const { data: company } = useQuery({
        queryKey: ['company', getPersistentCompanyId()],
        queryFn: () => getCompany(getPersistentCompanyId())
    });

    useEffect(() => {
        if (company) {
            if (company.name && company.show_name) {
                setCompanyName(company.congregation_name || company.name);
                setShowCompanyName(true);
            }
            if (company.logo_url) {
                setLogoPath(company.logo_url);
            }
        }
    }, [company]);

    useEffect(() => {
        // Check if we have a valid recovery session
        const checkSession = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session) {
                    setIsValidSession(true);
                }
            } catch (error) {
                console.error("Error checking session:", error);
            } finally {
                setIsChecking(false);
            }
        };

        // Listen for the PASSWORD_RECOVERY event
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === "PASSWORD_RECOVERY") {
                setIsValidSession(true);
                setIsChecking(false);
            }
        });

        checkSession();

        return () => subscription.unsubscribe();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword.length < 6) {
            toast({
                title: "Contraseña muy corta",
                description: "La contraseña debe tener al menos 6 caracteres.",
                variant: "destructive",
            });
            return;
        }

        if (newPassword !== confirmPassword) {
            toast({
                title: "Las contraseñas no coinciden",
                description: "Por favor verifica que ambas contraseñas sean iguales.",
                variant: "destructive",
            });
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: newPassword,
            });

            if (error) throw error;

            setIsSuccess(true);
            toast({
                title: "¡Contraseña actualizada!",
                description: "Tu contraseña se ha cambiado correctamente.",
            });

            // Redirect to login after 3 seconds
            setTimeout(() => {
                supabase.auth.signOut();
                navigate("/");
            }, 3000);
        } catch (error: any) {
            console.error("Error updating password:", error);

            let errorMessage = "No se pudo actualizar la contraseña. Intentá nuevamente.";

            // Catch specific Supabase error codes
            if (error.code === "same_password" || error.message?.includes("same_password")) {
                errorMessage = "La nueva contraseña no puede ser igual a la anterior.";
            } else if (error.code === "insecure_password" || error.message?.toLowerCase().includes("insecure")) {
                errorMessage = "La contraseña es muy débil o común. Intentá con una más compleja.";
            }

            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Loading state
    if (isChecking) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
        );
    }

    // Invalid or expired link
    if (!isValidSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

                <div className="w-full max-w-md relative z-10 animate-fade-in">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-10 text-center">
                        <div className="bg-gradient-to-br from-red-100 to-orange-100 dark:from-red-900/40 dark:to-orange-900/40 p-4 rounded-2xl mb-5 shadow-inner inline-block">
                            <ShieldCheck className="h-10 w-10 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">Enlace inválido o expirado</h2>
                        <p className="text-sm text-muted-foreground mb-6">
                            Este enlace de recuperación ya no es válido. Por favor solicitá uno nuevo desde la pantalla de inicio de sesión.
                        </p>
                        <Button
                            onClick={() => navigate("/")}
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold shadow-lg"
                        >
                            Volver al inicio
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Success state
    if (isSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

                <div className="w-full max-w-md relative z-10 animate-fade-in">
                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-10 text-center">
                        <div className="bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/40 dark:to-emerald-900/40 p-4 rounded-2xl mb-5 shadow-inner inline-block">
                            <CheckCircle2 className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold mb-2">¡Contraseña actualizada!</h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            Tu contraseña se ha cambiado correctamente. Serás redirigido al inicio de sesión en unos segundos...
                        </p>
                        <Loader2 className="h-5 w-5 animate-spin text-purple-500 mx-auto" />
                    </div>
                </div>
            </div>
        );
    }

    // Password reset form
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in">
                <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-12">

                    <div className="flex flex-col items-center mb-8 text-center">
                        <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 p-4 rounded-2xl mb-5 shadow-inner">
                            <Avatar className="h-20 w-20 bg-transparent">
                                <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                                <AvatarFallback className="bg-transparent">
                                    <img src="/fire.png" alt="Logo" className="h-full w-full object-contain drop-shadow-md" />
                                </AvatarFallback>
                            </Avatar>
                        </div>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Recuperación de Cuenta</p>
                        <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-1 leading-tight">
                            Nueva Contraseña
                        </h1>
                        <p className="text-sm text-muted-foreground mt-2">Ingresá tu nueva contraseña para acceder al sistema.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nueva Contraseña</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                                    </div>
                                    <Input
                                        id="newPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="pl-11 h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Confirmar Contraseña</Label>
                                <div className="relative group">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                                    </div>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="••••••••"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        required
                                        minLength={6}
                                        className="pl-11 h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                    />
                                </div>
                            </div>
                        </div>

                        <Button
                            type="submit"
                            className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 group"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    Guardar Nueva Contraseña
                                    <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                                </>
                            )}
                        </Button>

                        <div className="pt-4 text-center border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => navigate("/")}
                                className="text-xs text-purple-600 hover:text-purple-800 hover:underline transition-all"
                            >
                                Volver al inicio de sesión
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
