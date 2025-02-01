import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [role, setRole] = useState<string>("maestro");
  const [departments, setDepartments] = useState<Database["public"]["Enums"]["department_type"][]>([]);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleDepartmentChange = (value: string) => {
    const department = value as Database["public"]["Enums"]["department_type"];
    if (departments.includes(department)) {
      setDepartments(departments.filter(d => d !== department));
    } else {
      setDepartments([...departments, department]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (departments.length === 0) {
      toast({
        title: "Error",
        description: "Por favor seleccione al menos un departamento",
        variant: "destructive",
      });
      return;
    }

    try {
      await signUp(email, password, {
        first_name: firstName,
        last_name: lastName,
        role: role as "admin" | "lider" | "director" | "maestro" | "secretaria",
        departments: departments,
      });
      toast({
        title: "Registro exitoso",
        description: "El usuario ha sido registrado exitosamente.",
      });
      navigate("/secretaria");
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

  const departmentOptions: Database["public"]["Enums"]["department_type"][] = ["niños", "adolescentes", "jovenes", "adultos"];

  return (
    <div className="container mx-auto py-8">
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Registrar Nuevo Usuario</CardTitle>
          <CardDescription>
            Ingresa los datos del nuevo usuario
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
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
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="maestro">Maestro</SelectItem>
                  <SelectItem value="lider">Líder</SelectItem>
                  <SelectItem value="director">Director</SelectItem>
                  <SelectItem value="secretaria">Secretaria</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Departamentos</Label>
              <div className="grid grid-cols-2 gap-2">
                {departmentOptions.map((dept) => (
                  <Button
                    key={dept}
                    type="button"
                    variant={departments.includes(dept) ? "default" : "outline"}
                    onClick={() => handleDepartmentChange(dept)}
                    className="w-full"
                  >
                    {dept.charAt(0).toUpperCase() + dept.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full">
              Registrar Usuario
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}