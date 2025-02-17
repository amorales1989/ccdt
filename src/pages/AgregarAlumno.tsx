
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { DepartmentType, Student } from "@/types/database";

const AgregarAlumno = () => {
  const { profile } = useAuth();
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | undefined>(
    profile?.departments?.[0] || undefined
  );
  const [selectedClass, setSelectedClass] = useState<string | undefined>(
    profile?.assigned_class || undefined
  );
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gender, setGender] = useState("masculino");
  const [birthdate, setBirthdate] = useState("");
  const { toast } = useToast();

  const { mutate: createStudent, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedDepartment) {
        throw new Error("Debes seleccionar un departamento");
      }

      const { data, error } = await supabase.from("students").insert([{
        name,
        phone,
        address,
        gender,
        birthdate,
        department: selectedDepartment,
        assigned_class: selectedClass,
      }]).select().single();

      if (error) {
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      toast({
        title: "Éxito",
        description: "Alumno creado correctamente",
      });
      // Reset form fields
      setName("");
      setPhone("");
      setAddress("");
      setGender("masculino");
      setBirthdate("");
      setSelectedClass(undefined);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Hubo un error al crear el alumno",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createStudent();
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Agregar Alumno</h1>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Información del Alumno</CardTitle>
          <CardDescription>Ingrese los datos del nuevo alumno</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ingrese el nombre del alumno"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Departamento</Label>
                <Select
                  value={selectedDepartment}
                  onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    {profile?.departments?.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input
                  type="tel"
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ingrese el teléfono del alumno"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input
                  type="text"
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Ingrese la dirección del alumno"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="gender">Género</Label>
                <Select value={gender} onValueChange={(value: string) => setGender(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione un género" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="femenino">Femenino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthdate">Fecha de Nacimiento</Label>
                <Input
                  type="date"
                  id="birthdate"
                  value={birthdate}
                  onChange={(e) => setBirthdate(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Clase Asignada</Label>
                <Input
                  type="text"
                  value={selectedClass || ''}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  placeholder="Ingrese la clase asignada"
                />
              </div>
            </div>
            <Button disabled={isPending} type="submit">
              {isPending ? "Creando..." : "Crear Alumno"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgregarAlumno;
