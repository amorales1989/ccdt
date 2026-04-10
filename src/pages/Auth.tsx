import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { DepartmentType } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Lock, ArrowRight, ActivitySquare, Church, Loader2 } from "lucide-react";


export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDepartmentSelect, setShowDepartmentSelect] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [userDepartments, setUserDepartments] = useState<DepartmentType[]>([]);
  const [logoPath, setLogoPath] = useState("/fire.png"); // Default logo
  const [companyName, setCompanyName] = useState("");
  const [showCompanyName, setShowCompanyName] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const { signIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();


  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId())
  });

  useEffect(() => {
    // Set company name if available and show_name is true
    if (company) {
      if (company.name && company.show_name) {
        setCompanyName(company.congregation_name || company.name);
        setShowCompanyName(true);
      } else {
        setShowCompanyName(false);
      }

      // Set logo path if available
      if (company.logo_url) {
        // Since we're now storing the complete URL, we can use it directly
        setLogoPath(company.logo_url);
      } else {
        setLogoPath("/fire.png"); // Default logo
      }
    }

    if (profile) {
      console.log("Perfil cargado correctamente:", profile);
      if (profile.departments && profile.departments.length > 1) {
        setUserDepartments(profile.departments);
        setShowDepartmentSelect(true); // Mostrar selector si tiene más de un departamento
      } else if (profile.departments && profile.departments.length === 1) {
        const dept = profile.departments[0];
        localStorage.setItem('selectedDepartment', dept);

        // Set department_id in localStorage if available
        if (profile.department_id) {
          localStorage.setItem('selectedDepartmentId', profile.department_id);
        }

        navigate("/"); // Si solo tiene un departamento, proceder al login automáticamente
      } else {
        navigate("/"); // Si no tiene departamentos, también procede al login
      }
    }
  }, [profile, navigate, company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      await signIn(email, password); // Intentar iniciar sesión

      /* El manejo de FCM ahora se hace centralizadamente en NotificationHandler.jsx */

      // Si el perfil tiene más de un departamento, no continuamos
      if (profile?.departments && profile.departments.length > 1) {
        setIsLoggingIn(false);
        return;
      }

      console.log("Login exitoso, verificando departamentos:", profile?.departments);
    } catch (error: any) {
      setIsLoggingIn(false);
      console.error("Error de autenticación:", error);
      let errorMessage = "Ha ocurrido un error";

      if (error.message.includes("email_provider_disabled")) {
        errorMessage = "El inicio de sesión por correo electrónico está deshabilitado. Por favor contacte al administrador.";
      } else if (error.message.includes("email_not_confirmed")) {
        errorMessage = "Por favor confirma tu correo electrónico antes de iniciar sesión";
      } else if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Credenciales inválidas";
      } else if (error.message.includes("company_mismatch")) {
        errorMessage = "Error de acceso: Tu usuario no pertenece a esta congregación.";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  const handleDepartmentSelect = async (value: string) => {
    console.log("Departamento seleccionado:", value);
    setSelectedDepartment(value as DepartmentType);

    // Get department_id for the selected department
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id")
        .eq("name", value)
        .single();

      if (error) {
        console.error("Error fetching department ID:", error);
      } else if (data) {
        // Store department_id in localStorage
        localStorage.setItem('selectedDepartmentId', data.id);
      }
    } catch (err) {
      console.error("Error in department select:", err);
    }

    // Guardamos el departamento seleccionado en el almacenamiento local
    localStorage.setItem('selectedDepartment', value);
    navigate("/"); // Procedemos al login después de seleccionar el departamento
  };

  const getDepartmentLabel = (dept: string) => {
    const labels: Record<string, string> = {
      'niños': 'Niños',
      'adolescentes': 'Adolescentes',
      'jovenes': 'Jóvenes',
      'adultos': 'Adultos'
    };
    return labels[dept] || dept;
  };

  if (showDepartmentSelect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
        {/* Background Decorative Blurs */}
        <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

        <div className="w-full max-w-md relative z-10 animate-fade-in">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-10">
            <div className="flex flex-col items-center mb-8 text-center">
              <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 p-4 rounded-2xl mb-4 shadow-inner">
                <Avatar className="h-16 w-16 bg-transparent">
                  <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                  <AvatarFallback className="bg-transparent">
                    <img src="/fire.png" alt="Default Logo" className="h-full w-full object-contain drop-shadow-md" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Sistema de Gestión</p>
              <h1 className="text-2xl font-black text-foreground">
                {showCompanyName && companyName ? companyName : "Comunidad Cristiana Don Torcuato"}
              </h1>
            </div>

            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-semibold mb-1">Seleccionar Departamento</h2>
                <p className="text-sm text-muted-foreground">Elige el área con la que deseas interactuar</p>
              </div>

              <div className="space-y-4">
                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Área / Departamento</Label>
                <Select onValueChange={handleDepartmentSelect}>
                  <SelectTrigger className="w-full h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                    <SelectValue placeholder="Selecciona un departamento" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl shadow-xl">
                    {userDepartments.map((dept) => (
                      <SelectItem key={dept} value={dept} className="rounded-lg cursor-pointer">
                        {getDepartmentLabel(dept)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-pink-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800 p-4 relative overflow-hidden">
      {/* Background Decorative Blurs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="w-full max-w-lg relative z-10 animate-fade-in">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-12">

          <div className="flex flex-col items-center mb-8 text-center">
            <div className="bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-900/40 dark:to-indigo-900/40 p-4 rounded-2xl mb-5 shadow-inner hover:scale-105 transition-transform duration-500">
              <Avatar className="h-20 w-20 bg-transparent">
                <AvatarImage src={logoPath} alt="Logo" className="object-contain" />
                <AvatarFallback className="bg-transparent">
                  <img src="/fire.png" alt="Nexus" className="h-full w-full object-contain drop-shadow-md" />
                </AvatarFallback>
              </Avatar>
            </div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-2">Sistema de Gestión</p>
            <h1 className="text-2xl sm:text-3xl font-black text-foreground mb-1 leading-tight">
              {showCompanyName && companyName ? companyName : "Comunidad Cristiana"} <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-indigo-600 dark:from-purple-400 dark:to-indigo-400">
                {showCompanyName && companyName ? "" : "Don Torcuato"}
              </span>
            </h1>
            <p className="text-sm text-muted-foreground mt-2">Bienvenido de nuevo. Inicia sesión para continuar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Correo Electrónico</Label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                  </div>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="pl-11 h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contraseña</Label>
                  {/* Future feature: <a href="#" className="text-xs text-purple-600 hover:text-purple-800 hover:underline transition-all">¿Olvidaste tu contraseña?</a> */}
                </div>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-slate-400 group-focus-within:text-purple-500 transition-colors" />
                  </div>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="pl-11 h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-lg shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 transition-all duration-300 group"
              disabled={loading || isLoggingIn}
            >
              {loading || isLoggingIn ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Verificando...
                </>
              ) : (
                <>
                  Ingresar al Sistema
                  <ArrowRight className="ml-2 h-5 w-5 opacity-70 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                </>
              )}
            </Button>

            <div className="pt-4 text-center border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-muted-foreground leading-relaxed">
                ¿No tienes una cuenta? <br className="sm:hidden" /> Contacta al director o líder de tu área para solicitar acceso al sistema.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
