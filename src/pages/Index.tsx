
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEvents, createEvent, updateEvent, deleteEvent, getStudents } from "@/lib/api";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, isBefore, startOfToday } from "date-fns";
import { es } from "date-fns/locale";
import type { Event, DepartmentType, Student } from "@/types/database";
import { StudentSearch } from "@/components/StudentSearch";

const Index = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  const { data: students = [], isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: () => getStudents().then(data => {
      // Ensure all students have a properly typed department
      return data.map(student => ({
        ...student,
        department: student.department as DepartmentType
      })) as Student[];
    })
  });

  const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria";

  const renderStudentStats = () => {
    if (!profile) return null;

    const userDepartments = profile.departments || [];

    const departmentTypes: DepartmentType[] = ["escuelita_central", "pre_adolescentes", "adolescentes", "jovenes", "jovenes_adultos", "adultos"];
    const studentsByDepartment = departmentTypes.reduce((acc, dept) => {
      if (!isAdminOrSecretary && !userDepartments.includes(dept)) {
        return acc;
      }

      const deptStudents = students.filter(s => {
        if (s.departments && s.departments.name) {
          return s.departments.name === dept;
        }
        return s.department === dept;
      });

      acc[dept] = {
        male: deptStudents.filter(s => s.gender === "masculino").length,
        female: deptStudents.filter(s => s.gender === "femenino").length,
        total: deptStudents.length
      };
      return acc;
    }, {} as Record<DepartmentType, { male: number; female: number; total: number }>);

    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Estadísticas de Alumnos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {Object.entries(studentsByDepartment).map(([dept, stats]) => (
              <Card key={dept} className="p-4">
                <h3 className="font-semibold text-lg capitalize mb-2">
                  {dept.replace(/_/g, ' ')}
                  {profile?.role === "maestro" && profile?.assigned_class && (
                    <span className="block text-sm text-muted-foreground">
                      Clase: {profile.assigned_class}
                    </span>
                  )}
                </h3>
                <div className="space-y-2">
                  <p>Varones: {stats.male}</p>
                  <p>Mujeres: {stats.female}</p>
                  <p className="font-semibold">Total: {stats.total}</p>
                </div>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  };

  const { mutate: createEventMutate } = useMutation({
    mutationFn: (newEvent: Omit<Event, "id" | "created_at" | "updated_at">) => createEvent(newEvent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento creado",
        description: "El evento ha sido creado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al crear el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: updateEventMutate } = useMutation({
    mutationFn: (event: Event) => updateEvent(event.id, event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento actualizado",
        description: "El evento ha sido actualizado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al actualizar el evento",
        variant: "destructive",
      });
    }
  });

  const { mutate: deleteEventMutate } = useMutation({
    mutationFn: (id: string) => deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Evento eliminado",
        description: "El evento ha sido eliminado exitosamente",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Hubo un error al eliminar el evento",
        variant: "destructive",
      });
    }
  });

  const handleCreateEvent = (event: Omit<Event, "id" | "created_at" | "updated_at">) => {
    createEventMutate(event);
  };

  const handleUpdateEvent = (event: Event) => {
    updateEventMutate(event);
  };

  const handleDeleteEvent = (id: string) => {
    deleteEventMutate(id);
  };

  const futureEvents = events.filter(event => !isBefore(new Date(event.date), startOfToday()));

  return (
    <div>
      {isAdminOrSecretary && !studentsLoading && (
        <StudentSearch students={students} />
      )}
      
      {renderStudentStats()}

      <Card>
        <CardHeader>
          <CardTitle>Calendario de Eventos</CardTitle>
        </CardHeader>
        <CardContent>
          {isAdminOrSecretary && (
            <div className="mb-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Evento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Agregar Evento</DialogTitle>
                  </DialogHeader>
                  <EventForm onSubmit={handleCreateEvent} />
                </DialogContent>
              </Dialog>
            </div>
          )}
          {eventsLoading ? (
            <p>Cargando eventos...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {futureEvents.map((event) => (
                <Card key={event.id}>
                  <CardHeader>
                    <CardTitle>{event.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(event.date), "dd/MM/yyyy", { locale: es })}
                    </p>
                    {event.description && (
                      <p className="text-sm mt-2">{event.description}</p>
                    )}
                    {isAdminOrSecretary && (
                      <div className="flex justify-end mt-4 space-x-2">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="secondary" size="sm">
                              <Edit2 className="mr-2 h-4 w-4" />
                              Editar
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Evento</DialogTitle>
                            </DialogHeader>
                            <EventForm
                              initialData={event}
                              onSubmit={handleUpdateEvent}
                            />
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteEvent(event.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
