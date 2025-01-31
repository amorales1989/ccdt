import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getStudents, markAttendance, getEvents } from "@/lib/api";
import { format } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const TomarAsistencia = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [asistencias, setAsistencias] = useState<Record<string, boolean>>({});
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);

  const { data: students, isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: getEvents,
  });

  // Set default event on component mount
  useEffect(() => {
    if (events && events.length > 0 && !selectedEventId) {
      const today = format(new Date(), 'yyyy-MM-dd');
      const todayEvent = events.find(event => 
        format(new Date(event.date), 'yyyy-MM-dd') === today && 
        event.title.toLowerCase().includes('reunion')
      );
      
      if (todayEvent) {
        setSelectedEventId(todayEvent.id);
        console.log('Selected default event:', todayEvent.title);
      }
    }
  }, [events, selectedEventId]);

  const handleSaveAttendance = async () => {
    if (!selectedEventId) {
      toast({
        title: "Error",
        description: "Por favor seleccione un evento",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      await Promise.all(
        Object.entries(asistencias).map(([studentId, status]) =>
          markAttendance({
            student_id: studentId,
            event_id: selectedEventId,
            status,
          })
        )
      );

      toast({
        title: "Asistencia guardada",
        description: "La asistencia ha sido registrada exitosamente",
      });

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
        <CardContent className="space-y-4">
          <Select onValueChange={setSelectedEventId} value={selectedEventId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar evento" />
            </SelectTrigger>
            <SelectContent>
              {events?.map((event) => (
                <SelectItem key={event.id} value={event.id}>
                  {event.title} - {format(new Date(event.date), "dd/MM/yyyy")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

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
            className="w-full"
            disabled={isLoading || Object.keys(asistencias).length === 0 || !selectedEventId}
          >
            {isLoading ? "Guardando..." : "Guardar Asistencia"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default TomarAsistencia;