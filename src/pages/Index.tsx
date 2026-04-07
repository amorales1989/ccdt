
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
import { LoadingOverlay } from "@/components/LoadingOverlay";

export default function Index() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDepartmentSelect, setShowDepartmentSelect] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [userDepartments, setUserDepartments] = useState<DepartmentType[]>([]);
  const [logoPath, setLogoPath] = useState("/fire.png"); // Default logo
  const [companyName, setCompanyName] = useState("");
  const [showCompanyName, setShowCompanyName] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { signIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 1000 * 60 * 30, // 30 minutes
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

        navigate("/home"); // Si solo tiene un departamento, proceder al login automáticamente
      } else {
        navigate("/home"); // Si no tiene departamentos, también procede al login
      }
    }
  }, [profile, navigate, company]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await signIn(email, password); // Intentar iniciar sesión

      // Si el perfil tiene más de un departamento, no debemos continuar hasta que se seleccione uno
      if (profile?.departments && profile.departments.length > 1) {
        setIsSubmitting(false);
        return; // No continuamos con el inicio de sesión si tiene más de un departamento
      }
    } catch (error: any) {
      setIsSubmitting(false);
      console.error("Error de autenticación:", error);
      let errorMessage = "Ha ocurrido un error";

      if (error.message.includes("email_provider_disabled")) {
        errorMessage = "El inicio de sesión por correo electrónico está deshabilitado. Por favor contacte al administrador.";
      } else if (error.message.includes("email_not_confirmed")) {
        errorMessage = "Por favor confirma tu correo electrónico antes de iniciar sesión";
      } else if (error.message.includes("Invalid login credentials")) {
        errorMessage = "Credenciales inválidas";
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
    navigate("/home"); // Procedemos al login después de seleccionar el departamento
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
      {isSubmitting && <LoadingOverlay message="Iniciando sesión..." />}

      {/* Background Decorative Blurs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-purple-400/20 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none"></div>
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-blue-400/10 rounded-full blur-3xl translate-x-1/3 translate-y-1/3 pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-white/40 dark:border-slate-700/50 shadow-2xl rounded-3xl p-8 sm:p-10 mb-6">
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

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Correo Electrónico</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="ejemplo@correo.com"
                    className="h-12 pl-4 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="h-12 pl-4 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2">
              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl text-base font-medium"
              >
                Ingresar al Sistema
              </Button>
            </div>
          </form>
        </div>

        <p className="text-xs text-muted-foreground text-center px-4">
          *Si no tienes una cuenta, por favor contacta al director o líder de tu área para solicitar acceso.
        </p>
      </div>
    </div>
  );
}
