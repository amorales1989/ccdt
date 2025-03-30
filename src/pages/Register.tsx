
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
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
      if (department) {
        setAvailableClasses(department.classes || []);
        setSelectedDepartmentId(department.id);
        console.log(`Selected department ID: ${department.id} (${typeof department.id})`);
      } else {
        setAvailableClasses([]);
        setSelectedDepartmentId(null);
      }
      setSelectedClass(""); // Reset selected class when department changes
    } else {
      setAvailableClasses([]);
      setSelectedClass("");
      setSelectedDepartmentId(null);
    }
  }, [selectedDepartment, departments]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    if (!selectedDepartment) {
      toast({
        title: "Error",
        description: "Por favor seleccione un departamento",
        variant: "destructive",
      });
      setIsLoading(false);
      return;
    }

    try {
      // Log registration data for debugging
      console.log("Registration data:", {
        email,
        firstName,
        lastName,
        role,
        selectedDepartment,
        selectedDepartmentId,
        selectedClass
      });
      
      // Ensure all required data is present
      if (!email || !password || !firstName || !lastName || !selectedDepartmentId) {
        throw new Error("Por favor complete todos los campos obligatorios");
      }
      
      const profileData = {
        first_name: firstName,
        last_name: lastName,
        role,
        departments: selectedDepartment ? [selectedDepartment] : [],
        department_id: selectedDepartmentId,
        assigned_class: selectedClass || null
      };

      console.log("Profile data to be sent:", profileData);
      
      // Register the user
      await signUp(email, password, profileData);
      
      // Success notification
      toast({
        title: "Registro exitoso",
        description: "El usuario ha sido registrado exitosamente.",
        variant: "success",
      });
      
      // Navigate to secretary page
      navigate("/secretaria");
    } catch (error: any) {
      console.error("Register error:", error);
      
      // Handle different error scenarios
      let errorMessage = "Ha ocurrido un error";
      
      if (error.message) {
        if (error.message.includes("User already registered")) {
          errorMessage = "Este correo electrónico ya está registrado";
        } else if (error.message.includes("Database error")) {
          errorMessage = "Error en la base de datos al registrar el usuario. Verifique los datos ingresados.";
        } else {
          // Use the error message from the API if available
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Rol</Label>
              <Select value={role} onValueChange={(value: AppRole) => setRole(value)}>
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
              <Label htmlFor="department">Departamento</Label>
              <Select 
                value={selectedDepartment || undefined}
                onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un departamento" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.name}>
                      {dept.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedDepartment && availableClasses.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="class">Clase</Label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona una clase" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableClasses.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Registrando..." : "Registrar Usuario"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
