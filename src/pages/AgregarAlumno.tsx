import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createStudent, getDepartments, checkDniExists } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Student, Department, DepartmentType } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const AgregarAlumno = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);
  const [isValidatingDni, setIsValidatingDni] = useState(false);
  
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    phoneCode: "54",
    address: "",
    gender: "masculino",
    birthdate: format(new Date(), 'yyyy-MM-dd'),
    document_number: "",
    department: null as DepartmentType | null,
    department_id: "",
    assigned_class: "",
    nuevo: true, // Por defecto marcado como nuevo
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const isMaestro = profile?.role === 'maestro';

  const availableDepartments = isAdminOrSecretaria 
    ? departments 
    : departments.filter(dept => profile?.departments?.includes(dept.name as DepartmentType));

  const availableClasses = formData.department
    ? departments.find(d => d.name === formData.department)?.classes || []
    : [];

  const departmentHasClasses = availableClasses.length > 0;

  useEffect(() => {
    if (profile) {
      let department = null;
      let departmentId = "";
      let assignedClass = "";
      
      if (profile.departments?.[0]) {
        department = profile.departments[0] as DepartmentType;
        departmentId = profile.department_id || "";
      }
      
      if (profile.assigned_class) {
        assignedClass = profile.assigned_class;
      }
      
      setFormData(prev => ({
        ...prev,
        department,
        department_id: departmentId,
        assigned_class: assignedClass
      }));
      
      if (department && !departmentId) {
        const fetchDepartmentId = async () => {
          try {
            const { data, error } = await supabase
              .from("departments")
              .select("id")
              .eq("name", department)
              .single();
            
            if (error) {
              console.error("Error fetching department ID:", error);
              return;
            }
            
            if (data) {
              console.log("Found department ID:", data.id, "for department:", department);
              setFormData(prev => ({ ...prev, department_id: data.id }));
            }
          } catch (error) {
            console.error("Error in fetchDepartmentId:", error);
          }
        };
        
        fetchDepartmentId();
      }
    }
  }, [profile, departments]);

  const validateDni = async (dni: string) => {
    if (!dni || dni.trim() === '') {
      setDniError(null);
      return true;
    }
    
    setIsValidatingDni(true);
    try {
      const exists = await checkDniExists(dni);
      if (exists) {
        setDniError(`El DNI ${dni} ya está registrado en el sistema`);
        return false;
      } else {
        setDniError(null);
        return true;
      }
    } catch (error) {
      console.error("Error validating DNI:", error);
      return true;
    } finally {
      setIsValidatingDni(false);
    }
  };

  const handleDniBlur = async () => {
    if (formData.document_number && formData.document_number.trim() !== '') {
      await validateDni(formData.document_number);
    } else {
      setDniError(null);
    }
  };

  const formatPhoneNumber = (phoneCode: string, phoneNumber: string) => {
    if (!phoneNumber) return null;

    let cleanNumber = phoneNumber.replace(/\D/g, "");
    
    if (cleanNumber.startsWith("0")) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    if (cleanNumber.startsWith("15")) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    if (phoneCode === "54") {
      return phoneCode + "9" + cleanNumber;
    }
    
    return phoneCode + cleanNumber;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.document_number && formData.document_number.trim() !== '') {
      const isValid = await validateDni(formData.document_number);
      if (!isValid) {
        toast({
          title: "Error",
          description: dniError || "El DNI ya existe en el sistema",
          variant: "destructive",
        });
        return;
      }
    }

    if (!formData.first_name) {
      toast({
        title: "Error",
        description: "Por favor ingrese el nombre del alumno",
        variant: "destructive",
      });
      return;
    }

    const formattedPhone = formatPhoneNumber(formData.phoneCode, formData.phone);
    const birthdate = formData.birthdate || format(new Date(), 'yyyy-MM-dd');

    setIsLoading(true);
    try {
      await createStudent({
        first_name: formData.first_name,
        last_name: formData.last_name || "",
        phone: formattedPhone,
        address: formData.address || null,
        gender: formData.gender || "masculino",
        birthdate: birthdate,
        document_number: formData.document_number || null,
        department: formData.department || null,
        department_id: formData.department_id || undefined,
        assigned_class: formData.assigned_class || null,
        nuevo: formData.nuevo, // Incluir el valor del checkbox
      });
      
      toast({
        title: "Alumno agregado",
        description: `El alumno ha sido agregado exitosamente${formData.nuevo ? ' y marcado como nuevo' : ''}`,
        variant: "success",
      });
      navigate("/");
    } catch (error: any) {
      console.error("Error al crear alumno:", error);
      toast({
        title: "Error",
        description: error.message || "Hubo un error al agregar el alumno",
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">Nombre *</Label>
                <Input
                  id="first_name"
                  value={formData.first_name}
                  onChange={(e) =>
                    setFormData({ ...formData, first_name: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">Apellido</Label>
                <Input
                  id="last_name"
                  value={formData.last_name}
                  onChange={(e) =>
                    setFormData({ ...formData, last_name: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="document_number" error={!!dniError}>DNI</Label>
              <Input
                id="document_number"
                value={formData.document_number}
                onChange={(e) =>
                  setFormData({ 
                    ...formData, 
                    document_number: e.target.value.replace(/\D/g, '') 
                  })
                }
                onBlur={handleDniBlur}
                placeholder="Ingrese el DNI sin puntos"
                error={!!dniError}
                inputMode="numeric"
                pattern="[0-9]*"
              />
              {dniError && (
                <p className="text-sm font-medium text-destructive mt-1">{dniError}</p>
              )}
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
                value={formData.department || undefined}
                onValueChange={(value) => {
                  const selectedDept = departments.find(d => d.name === value);
                  setFormData({ 
                    ...formData, 
                    department: value as DepartmentType,
                    department_id: selectedDept?.id || "",
                    assigned_class: "" 
                  });
                }}
                disabled={isMaestro}
              >
                <SelectTrigger>
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
            {formData.department && departmentHasClasses && (
              <div className="space-y-2">
                <Label htmlFor="assigned_class">Clase</Label>
                <Select
                  value={formData.assigned_class}
                  onValueChange={(value) =>
                    setFormData({ ...formData, assigned_class: value })
                  }
                  disabled={isMaestro}
                >
                  <SelectTrigger>
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
              <div className="grid grid-cols-[100px_1fr] gap-2">
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">+</span>
                  <Input
                    id="phoneCode"
                    value="54"
                    onChange={(e) =>
                      setFormData({ ...formData, phoneCode: e.target.value })
                    }
                    placeholder="54"
                    disabled
                  />
                </div>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  placeholder="Sin 0 ni 15 al inicio, ej: 11xxxxxxxx"
                />
              </div>
              <span className="text-xs text-muted-foreground">No incluir el 0 ni el 15 al inicio del número. Ejemplo correcto: 11xxxxxxxx</span>
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

            {/* Checkbox para marcar como nuevo */}
            <div className="flex items-center space-x-2 pt-4 pb-4 border-b">
              <Checkbox
                id="nuevo"
                checked={formData.nuevo}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, nuevo: checked as boolean })
                }
              />
              <Label 
                htmlFor="nuevo" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Marcar alumno como nuevo
              </Label>
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