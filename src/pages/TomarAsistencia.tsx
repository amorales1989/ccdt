import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudents, markAttendance, createEvent } from "@/lib/api";
import { format } from "date-fns";

const TomarAsistencia = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [asistencias, setAsistencias] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const handleSaveAttendance = async () => {
    setIsLoading(true);
    try {
      // Primero creamos el evento para hoy
      const event = await createEvent({
        title: `Asistencia ${format(new Date(), "dd/MM/yyyy")}`,
        date: format(new Date(), "yyyy-MM-dd"),
        description: "Registro de asistencia",
      });

      // Luego guardamos la asistencia de cada alumno
      await Promise.all(
        Object.entries(asistencias).map(([studentId, status]) =>
          markAttendance({
            student_id: studentId,
            event_id: event.id,
            status,
          })
        )
      );

      toast({
        title: "Asistencia guardada",
        description: "La asistencia ha sido registrada exitosamente",
      });

      // Limpiar el estado
      setAsistencias({});
      
    } catch (error) {
      console.error("Error al guardar asistencia:", error);
      toast({
        title: "Error",
        description: "Hubo un error al guardar la asistencia",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const marcarAsistencia = (id: string, presente: boolean) => {
    setAsistencias((prev) => ({ ...prev, [id]: presente }));
  };

  if (isLoadingStudents) {
    return <div className="p-6">Cargando alumnos...</div>;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Tomar Asistencia - {format(new Date(), "dd/MM/yyyy")}</CardTitle>
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
              {students?.map((student) => (
                <TableRow key={student.id}>
                  <TableCell>{student.name}</TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant={asistencias[student.id] ? "default" : "outline"}
                        size="icon"
                        onClick={() => marcarAsistencia(student.id, true)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={
                          asistencias[student.id] === false
                            ? "destructive"
                            : "outline"
                        }
                        size="icon"
                        onClick={() => marcarAsistencia(student.id, false)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button 
            onClick={handleSaveAttendance} 
            className="mt-4"
            disabled={isLoading || Object.keys(asistencias).length === 0}
          >
            {isLoading ? "Guardando..." : "Guardar Asistencia"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TomarAsistencia;