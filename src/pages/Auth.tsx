import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Database } from "@/integrations/supabase/types";

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDepartmentSelect, setShowDepartmentSelect] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<Database["public"]["Enums"]["department_type"] | null>(null);
  const [userDepartments, setUserDepartments] = useState<Database["public"]["Enums"]["department_type"][]>([]);
  const { signIn, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signIn(email, password);
      // After successful login, check if user has departments
      if (profile?.departments && profile.departments.length > 0) {
        setUserDepartments(profile.departments);
        setShowDepartmentSelect(true);
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      
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
    setSelectedDepartment(value as Database["public"]["Enums"]["department_type"]);
    // Store selected department in localStorage
    localStorage.setItem('selectedDepartment', value);
    navigate("/");
  };

  if (showDepartmentSelect) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Seleccionar Departamento</CardTitle>
            <CardDescription>
              Selecciona el departamento con el que deseas ingresar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select onValueChange={handleDepartmentSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un departamento" />
              </SelectTrigger>
              <SelectContent>
                {userDepartments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-accent/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
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