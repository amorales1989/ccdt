import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createStudent, getDepartments } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Student, Department, DepartmentType } from "@/types/database";
import { useQuery } from "@tanstack/react-query";

const AgregarAlumno = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    address: "",
    gender: "masculino",
    birthdate: "",
    department: "" as DepartmentType,
    assigned_class: "",
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';

  const availableDepartments = isAdminOrSecretaria 
    ? departments 
    : departments.filter(dept => profile?.departments?.includes(dept.name));

  const availableClasses = formData.department
    ? departments.find(d => d.name === formData.department)?.classes || []
    : [];

  useEffect(() => {
    if (profile?.departments?.[0]) {
      setFormData(prev => ({ 
        ...prev, 
        department: profile.departments[0],
        ...(profile.assigned_class && { assigned_class: profile.assigned_class })
      }));
    }
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.department) {
      toast({
        title: "Error",
        description: "Por favor seleccione un departamento",
        variant: "destructive",
      });
      return;
    }

    if (!formData.assigned_class) {
      toast({
        title: "Error",
        description: "Por favor seleccione una clase",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await createStudent({
        name: formData.name,
        phone: formData.phone || null,
        address: formData.address || null,
        gender: formData.gender,
        birthdate: formData.birthdate || null,
        department: formData.department,
        assigned_class: formData.assigned_class,
      });
      
      toast({
        title: "Alumno agregado",
        description: "El alumno ha sido agregado exitosamente",
      });
      navigate("/");
    } catch (error) {
      console.error("Error al crear alumno:", error);
      toast({
        title: "Error",
        description: "Hubo un error al agregar el alumno",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdminOrSecretaria && (!profile?.departments?.length)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tiene departamentos asignados. Contacte al administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Agregar Nuevo Alumno</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre completo</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="birthdate">Fecha de Nacimiento</Label>
              <Input
                id="birthdate"
                type="date"
                value={formData.birthdate}
                onChange={(e) =>
                  setFormData({ ...formData, birthdate: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Género</Label>
              <Select
                value={formData.gender}
                onValueChange={(value) =>
                  setFormData({ ...formData, gender: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar género" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="masculino">Masculino</SelectItem>
                  <SelectItem value="femenino">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="department">Departamento</Label>
              <Select
                value={formData.department}
                onValueChange={(value) => {
                  setFormData({ 
                    ...formData, 
                    department: value as DepartmentType,
                    assigned_class: "" // Reset class when department changes
                  });
                }}
                required
              >
                <SelectTrigger disabled={!isAdminOrSecretaria && profile?.departments?.length === 1}>
                  <SelectValue placeholder="Seleccionar departamento" />
                </SelectTrigger>
                <SelectContent>
                  {availableDepartments.map((dept) => (
                    <SelectItem key={dept.name} value={dept.name}>
                      {dept.name.charAt(0).toUpperCase() + dept.name.slice(1).replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {formData.department && (
              <div className="space-y-2">
                <Label htmlFor="assigned_class">Clase</Label>
                <Select
                  value={formData.assigned_class}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigned_class: value })
                  }
                  required
                >
                  <SelectTrigger disabled={!isAdminOrSecretaria && profile?.assigned_class}>
                    <SelectValue placeholder="Seleccionar clase" />
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
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Dirección</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) =>
                  setFormData({ ...formData, address: e.target.value })
                }
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Agregando..." : "Agregar Alumno"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgregarAlumno;
