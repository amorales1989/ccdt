import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import type { Database } from "@/integrations/supabase/types";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDepartmentSelect, setShowDepartmentSelect] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Database["public"]["Enums"]["department_type"] | null>(null);
  const [userDepartments, setUserDepartments] = useState<Database["public"]["Enums"]["department_type"][]>([]);
  const { signIn, profile, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // useEffect para verificar cuando el perfil se haya cargado completamente
  useEffect(() => {
    if (profile) {
      console.log("Perfil cargado correctamente:", profile);
      if (profile.departments && profile.departments.length > 1) {
        setUserDepartments(profile.departments);
        setShowDepartmentSelect(true); // Mostrar selector si tiene más de un departamento
      } else if (profile.departments && profile.departments.length === 1) {
        const dept = profile.departments[0];
        localStorage.setItem('selectedDepartment', dept);
        navigate("/"); // Si solo tiene un departamento, proceder al login automáticamente
      } else {
        navigate("/"); // Si no tiene departamentos, también procede al login
      }
    }
  }, [profile, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password); // Intentar iniciar sesión

      // Si el perfil tiene más de un departamento, no debemos continuar hasta que se seleccione uno
      if (profile?.departments && profile.departments.length > 1) {
        return; // No continuamos con el inicio de sesión si tiene más de un departamento
      }

      console.log("Login exitoso, verificando departamentos:", profile?.departments);
    } catch (error: any) {
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

  const handleDepartmentSelect = (value: string) => {
    console.log("Departamento seleccionado:", value);
    setSelectedDepartment(value as Database["public"]["Enums"]["department_type"]);
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

  // Mostrar la vista del selector de departamento si el usuario tiene más de uno
  if (showDepartmentSelect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
          <img src="/fire.png" alt="Fire Logo" className="w-16 h-16 mb-2" />
            <CardTitle>Seleccionar Departamento</CardTitle>
            <CardDescription>
              Selecciona el departamento con el que deseas trabajar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Label>Departamento</Label>
              <Select onValueChange={handleDepartmentSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {userDepartments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {getDepartmentLabel(dept)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Vista de inicio de sesión cuando no hay que seleccionar departamento
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
        <img src="/fire.png" alt="Fire Logo" className="w-16 h-16 mb-2" />
          <CardTitle>Iniciar Sesión</CardTitle>
          <CardDescription>
            Ingresa tus credenciales para acceder
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Correo Electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full">
              Iniciar Sesión
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              *Si no tienes una cuenta, por favor contacta al director o líder de tu área para solicitar acceso.
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
