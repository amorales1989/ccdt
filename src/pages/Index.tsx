
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Trash2, Users, CheckCircle2, PersonStanding } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EventForm } from "@/components/EventForm";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react"; // Added the missing useState import
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
      return data.map(student => ({
        ...student,
        department: student.department as DepartmentType
      })) as Student[];
    })
  });

  const isAdminOrSecretary = profile?.role === "admin" || profile?.role === "secretaria";

  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventForEdit, setSelectedEventForEdit] = useState<Event | null>(null);

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

    const formatDepartmentName = (name: string) => {
      return name.replace(/_/g, ' ').split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
    };

    return (
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-4">Estadísticas de Alumnos</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(studentsByDepartment).map(([dept, stats]) => (
            <div key={dept} className="overflow-hidden rounded-lg shadow-md transition-all hover:shadow-lg">
              <div className="bg-[#9b87f5] p-4 text-center">
                <h3 className="font-semibold text-white">
                  {formatDepartmentName(dept)}
                </h3>
              </div>
              <div className="bg-white p-6 text-center">
                <div className="mb-4">
                  <p className="text-sm text-gray-500">Total</p>
                  <p className="text-[#7E69AB] text-5xl font-semibold">{stats.total}</p>
                </div>
                <div className="space-y-2 mt-4">
                  <div className="flex items-center text-gray-600">
                    <PersonStanding className="h-5 w-5 text-[#3A82AF] mr-2" />
                    <p>Varones: {stats.male}</p>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <PersonStanding className="h-5 w-5 text-[#E83E8C] mr-2" />
                    <p>Mujeres: {stats.female}</p>
                  </div>
                  {profile?.role === "maestro" && profile?.assigned_class && (
                    <div className="flex items-center text-gray-600">
                      <CheckCircle2 className="h-4 w-4 text-[#7E69AB] mr-2" />
                      <p>Clase: {profile.assigned_class}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
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
      setEventDialogOpen(false);
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
      setEventDialogOpen(false);
      setSelectedEventForEdit(null);
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

  const handleEditEvent = (event: Event) => {
    setSelectedEventForEdit(event);
    setEventDialogOpen(true);
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
              <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => setSelectedEventForEdit(null)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Agregar Evento
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {selectedEventForEdit ? "Editar Evento" : "Agregar Evento"}
                    </DialogTitle>
                  </DialogHeader>
                  <EventForm 
                    onSubmit={selectedEventForEdit ? handleUpdateEvent : handleCreateEvent} 
                    initialData={selectedEventForEdit || undefined}
                    onSuccess={() => {
                      setEventDialogOpen(false);
                      setSelectedEventForEdit(null);
                    }}
                  />
                </DialogContent>
              </Dialog>
            </div>
          )}
          {eventsLoading ? (
            <p>Cargando eventos...</p>
          ) : futureEvents.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-lg text-muted-foreground">No hay eventos próximos programados</p>
              {isAdminOrSecretary && (
                <p className="text-sm text-muted-foreground mt-2">Haga clic en "Agregar Evento" para crear uno nuevo</p>
              )}
            </div>
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
                      <p className="text-sm mt-2 whitespace-pre-line">{event.description}</p>
                    )}
                    {isAdminOrSecretary && (
                      <div className="flex justify-end mt-4 space-x-2">
                        <Button 
                          variant="secondary" 
                          size="sm" 
                          onClick={() => handleEditEvent(event)}
                        >
                          <Edit2 className="mr-2 h-4 w-4" />
                          Editar
                        </Button>
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
