import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/use-toast";

const estudiantes = [
  { id: 1, nombre: "Juan Pérez" },
  { id: 2, nombre: "María García" },
];

const TomarAsistencia = () => {
  const { toast } = useToast();
  const [asistencias, setAsistencias] = useState<Record<number, boolean>>({});

  const marcarAsistencia = (id: number, presente: boolean) => {
    setAsistencias((prev) => ({ ...prev, [id]: presente }));
  };

  const guardarAsistencia = () => {
    console.log("Asistencias guardadas:", asistencias);
    toast({
      title: "Asistencia guardada",
      description: "La asistencia ha sido registrada exitosamente",
    });
  };

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Tomar Asistencia</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Asistencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {estudiantes.map((estudiante) => (
                <TableRow key={estudiante.id}>
                  <TableCell>{estudiante.nombre}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant={asistencias[estudiante.id] ? "default" : "outline"}
                        size="icon"
                        onClick={() => marcarAsistencia(estudiante.id, true)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          asistencias[estudiante.id] === false
                            ? "destructive"
                            : "outline"
                        }
                        size="icon"
                        onClick={() => marcarAsistencia(estudiante.id, false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button onClick={guardarAsistencia} className="mt-4">
            Guardar Asistencia
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TomarAsistencia;