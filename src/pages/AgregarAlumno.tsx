import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useState } from "react";

const AgregarAlumno = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    nombre: "",
    edad: "",
    telefono: "",
    direccion: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Datos del alumno:", formData);
    toast({
      title: "Alumno agregado",
      description: "El alumno ha sido agregado exitosamente",
    });
    setFormData({ nombre: "", edad: "", telefono: "", direccion: "" });
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Agregar Nuevo Alumno</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre completo</Label>
              <Input
                id="nombre"
                value={formData.nombre}
                onChange={(e) =>
                  setFormData({ ...formData, nombre: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edad">Edad</Label>
              <Input
                id="edad"
                type="number"
                value={formData.edad}
                onChange={(e) => setFormData({ ...formData, edad: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="telefono">Teléfono</Label>
              <Input
                id="telefono"
                value={formData.telefono}
                onChange={(e) =>
                  setFormData({ ...formData, telefono: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="direccion">Dirección</Label>
              <Input
                id="direccion"
                value={formData.direccion}
                onChange={(e) =>
                  setFormData({ ...formData, direccion: e.target.value })
                }
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Agregar Alumno
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgregarAlumno;