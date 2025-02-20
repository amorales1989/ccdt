
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Check, X } from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { markAttendance, getAttendance } from "@/lib/api";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const TomarAsistencia = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [asistencias, setAsistencias] = useState<Record<string, boolean>>({});
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isLoading, setIsLoading] = useState(false);
  const [showAlert, setShowAlert] = useState(false);

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";
  const currentDepartment = profile?.departments?.[0];
  const userClass = profile?.assigned_class;

  const { data: students = [], isLoading: isLoadingStudents } = useQuery({
    queryKey: ["students-attendance", currentDepartment, userClass],
    queryFn: async () => {
      console.log("Fetching students for attendance...", { currentDepartment, userClass });
      let query = supabase.from("students").select("*");

      if (!isAdminOrSecretaria) {
        if (!currentDepartment) {
          console.log("No department assigned to user");
          return [];
        }
        
        // Filtrar por departamento
        query = query.eq("department", currentDepartment);
        
        // Si el usuario tiene una clase asignada, filtrar también por clase
        if (userClass) {
          console.log("Filtering by class:", userClass);
          query = query.eq("assigned_class", userClass);
        }
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching students for attendance:", error);
        throw error;
      }
      console.log("Fetched students for attendance:", data);
      return data;
    },
  });

  const checkExistingAttendance = async (date: string) => {
    try {
      const attendanceData = await getAttendance(date, date, currentDepartment);
      const hasAttendance = attendanceData && attendanceData.length > 0;
      console.log("Checking attendance for date:", date, "department:", currentDepartment, "exists:", hasAttendance);
      return hasAttendance;
    } catch (error) {
      console.error("Error checking existing attendance:", error);
      return false;
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedDate) {
      toast({
        title: "Error",
        description: "Por favor seleccione una fecha",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const hasExistingAttendance = await checkExistingAttendance(selectedDate);
      
      if (hasExistingAttendance) {
        setShowAlert(true);
        setIsLoading(false);
        return;
      }

      await Promise.all(
        Object.entries(asistencias).map(([studentId, status]) =>
          markAttendance({
            student_id: studentId,
            date: selectedDate,
            status,
            department: currentDepartment,
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

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedDate(e.target.value);
  };

  if (!isAdminOrSecretaria && !currentDepartment) {
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

  if (isLoadingStudents) {
    return <div className="p-6">Cargando alumnos...</div>;
  }

  return (
    <div className="p-6">
      <Card>
        <CardHeader>
          <CardTitle>Tomar Asistencia - {format(new Date(selectedDate), "dd/MM/yyyy")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            className="border p-2 rounded w-full"
          />
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
            disabled={isLoading || Object.keys(asistencias).length === 0 || !selectedDate}
          >
            {isLoading ? "Guardando..." : "Guardar Asistencia"}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={showAlert} onOpenChange={setShowAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asistencia ya registrada</AlertDialogTitle>
            <AlertDialogDescription>
              Ya existe un registro de asistencia para la fecha {format(new Date(selectedDate), "dd/MM/yyyy")} en este departamento. 
              Por favor, seleccione otra fecha o consulte el historial de asistencia.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowAlert(false)}>Aceptar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TomarAsistencia;
