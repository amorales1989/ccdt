
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Department, DepartmentType } from "@/types/database";
import { UserPlus } from "lucide-react";

type AppRole = Database["public"]["Enums"]["app_role"];

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<AppRole>("maestro");
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const { profile, signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const isDirector = profile?.role === 'director';

  useEffect(() => {
    if (isDirector && profile.departments?.[0]) {
      setSelectedDepartment(profile.departments[0]);
      setRole("maestro");
    }
  }, [isDirector, profile]);

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Department[];
    }
  });

  // Update available classes when department changes
  useEffect(() => {
    if (selectedDepartment) {
      const department = departments.find(d => d.name === selectedDepartment);
      setAvailableClasses(department?.classes || []);
      setSelectedClass(""); // Reset selected class when department changes
    } else {
      setAvailableClasses([]);
      setSelectedClass("");
    }
  }, [selectedDepartment, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDepartment) {
      toast({
        title: "Error",
        description: "Por favor seleccione un departamento",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: currentSessionData } = await supabase.auth.getSession();
      const adminSession = currentSessionData.session;
      const departmentObj = departments.find(d => d.name === selectedDepartment);
      const department_id = departmentObj?.id || "";

      const profileData = {
        first_name: firstName,
        last_name: lastName,
        role,
        departments: [selectedDepartment],
        department_id,
        assigned_class: selectedClass || undefined
      };

      await signUp(email, password, profileData);
      await supabase.auth.signOut();

      if (adminSession) {
        await supabase.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token
        });
      }

      toast({
        title: "Registro exitoso",
        description: "El usuario ha sido registrado exitosamente.",
      });

      setEmail("");
      setPassword("");
      setFirstName("");
      setLastName("");
      setRole("maestro");
      setSelectedDepartment(null);
      setSelectedClass("");
      setAvailableClasses([]);

    } catch (error: any) {
      console.error("Register error:", error);

      let errorMessage = "Ha ocurrido un error";

      if (error.message.includes("User already registered")) {
        errorMessage = "Este correo electrónico ya está registrado";
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
              <UserPlus className="h-8 w-8" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-foreground tracking-tight">Registrar Usuario</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Añade nuevos miembros al sistema asignándoles roles y dándoles acceso.
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="max-w-3xl mx-auto">
        <Card className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 -mr-32 -mt-32 w-96 h-96 rounded-full bg-purple-400/10 blur-3xl pointer-events-none"></div>
          <CardHeader className="relative z-10 p-6 sm:p-8 pb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                <UserPlus className="h-5 w-5" />
              </div>
              <CardTitle className="text-2xl font-bold">Datos del Integrante</CardTitle>
            </div>
            <CardDescription className="text-base text-muted-foreground ml-1">
              Completá los datos a continuación para registrar a un integrante.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="relative z-10">
            <CardContent className="space-y-6 p-6 sm:p-8 pt-0">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nombre</Label>
                  <Input
                    id="firstName"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    required
                    placeholder="Ej. Juan"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Apellido</Label>
                  <Input
                    id="lastName"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    required
                    placeholder="Ej. Pérez"
                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Correo Electrónico</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="ejemplo@correo.com"
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Contraseña Temporal</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Rol en el Sistema</Label>
                  <Select value={role} onValueChange={(value: AppRole) => setRole(value)} disabled={isDirector}>
                    <SelectTrigger className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isDirector ? "bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed" : "bg-slate-50"}`}>
                      <SelectValue placeholder="Selecciona un rol" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      <SelectItem value="maestro">Maestro</SelectItem>
                      <SelectItem value="lider">Líder</SelectItem>
                      <SelectItem value="director">Director</SelectItem>
                      <SelectItem value="secretaria">Secretaria</SelectItem>
                      <SelectItem value="secr.-calendario">Secr.-calendario</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Departamento</Label>
                  <Select
                    value={selectedDepartment || undefined}
                    onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
                    disabled={isDirector}
                  >
                    <SelectTrigger className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isDirector ? "bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed" : "bg-slate-50"}`}>
                      <SelectValue placeholder="Selecciona un departamento" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {selectedDepartment && availableClasses.length > 0 && (
                <div className="space-y-2 pt-2 animate-fade-in">
                  <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Clase Asignada (Opcional)</Label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-12 rounded-xl bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/30 text-purple-800 dark:text-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                      <SelectValue placeholder="Selecciona una clase" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl shadow-xl">
                      {availableClasses.map((className) => (
                        <SelectItem key={className} value={className} className="text-purple-700 dark:text-purple-300">
                          {className}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
            <CardFooter className="p-6 sm:p-8 pt-0 mt-4 bg-slate-50/50 dark:bg-slate-800/20 border-t border-slate-100 dark:border-slate-800">
              <Button
                type="submit"
                className="w-full mt-6 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl text-base font-medium transition-all hover:shadow-lg hover:shadow-purple-500/30"
              >
                Crear Cuenta de Usuario
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
