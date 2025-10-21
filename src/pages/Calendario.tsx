import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { getEvents, deleteEvent, updateEvent, notifyNewRequest } from "@/lib/api";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
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
import { format, isBefore, startOfDay, isSameMonth, isAfter, startOfMonth, endOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { CalendarPlus, Trash2, Calendar as CalendarIcon, Check, X } from "lucide-react";
import { EventForm } from "@/components/EventForm";
import { useToast } from "@/components/ui/use-toast";
import { createEvent } from "@/lib/api";
import type { Event } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

export default function Calendario() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<Event[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const { toast } = useToast();
  const { profile } = useAuth();

  // Determinar si el usuario puede crear eventos
  const selectedDepartmentStorage = localStorage.getItem('selectedDepartment');
  const isCalendarDepartment = selectedDepartmentStorage === 'calendario' || profile?.departments?.[0] === 'calendario';
  const isSecretaria = profile?.role === 'secretaria';
  const isAdmin = profile?.role === 'admin';
  const isSecrCalendario = profile?.role === 'secr.-calendario';
  const canCreateEvents = isSecretaria || isAdmin || isSecrCalendario;
  
  const queryClient = useQueryClient();

  const { data: allEvents = [], isLoading, refetch } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents
  });

  // Filtrar eventos según el rol del usuario
  const events = allEvents.filter(event => {
    // Si no puede gestionar solicitudes, no mostrar eventos con solicitud: true
    if (!canCreateEvents && (event as any).solicitud === true) {
      return false;
    }
    // No mostrar solicitudes rechazadas para ningún rol
    if ((event as any).estado === 'rechazada') {
      return false;
    }
    return true;
  });

  useEffect(() => {
    if (selectedDate && events.length > 0) {
      const filtered = events
        .filter(event => isSameMonth(new Date(event.date), selectedDate))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setCurrentMonthEvents(filtered);
    }
  }, [selectedDate, events]);

  const eventDates = events.reduce((acc: Record<string, any[]>, event) => {
    const dateStr = format(new Date(event.date), 'yyyy-MM-dd');
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(event);
    return acc;
  }, {});

  // Verificar si el usuario puede editar un evento específico
  const canEditEvent = (event: Event) => {
    if (canCreateEvents) return true;
    // Si es una solicitud propia, puede editarla (verificar por solicitante)
    return (event as any).solicitante === profile?.id;
  };

// Reemplazar la función handleCreateEvent en calendario.tsx
// También agregar el import de notifyNewRequest al inicio del archivo:
// import { getEvents, deleteEvent, updateEvent, createEvent, notifyNewRequest } from "@/lib/api";

const handleCreateEvent = async (eventData: any) => {
  try {
    if (selectedEvent) {
      // Actualizar evento existente
      await updateEvent(selectedEvent.id, {
        ...eventData,
        id: selectedEvent.id
      });
      toast({
        title: (isSecretaria || isAdmin || isSecrCalendario) ? "Evento actualizado" : "Solicitud actualizada",
        description: (isSecretaria || isAdmin || isSecrCalendario) 
          ? "El evento se ha actualizado exitosamente." 
          : "La solicitud se ha actualizado exitosamente.",
      });
    } else {
      // Crear nuevo evento/solicitud
      const dataToSend = {
        ...eventData
      };

      // Si no puede crear eventos directamente (es una solicitud)
      if (!canCreateEvents && profile?.id) {
        dataToSend.solicitante = profile.id;
      }

      // Crear el evento/solicitud
      const newEvent = await createEvent(dataToSend);

      // Si es una solicitud (usuario sin permisos), enviar notificación por email
      if (!canCreateEvents && profile) {
        try {
          const requesterName = profile.first_name && profile.last_name 
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : profile.email || 'Usuario no identificado';

          await notifyNewRequest({
            eventTitle: eventData.title,
            eventDate: eventData.date,
            eventTime: eventData.time,
            department: eventData.departamento,
            requesterName: requesterName,
            description: eventData.description,
            adminEmails: [
              'a19morales89@gmail.com',
              'wmaldonado1987@hotmail.com',
              'daniela.s.galarza86@gmail.com',
              'amonima115@hotmail.com',
              'marcelaponceabril@gmail.com',
              'comunidadcristianadontorcuato@gmail.com'
            ]
          });

          toast({
            title: "Solicitud enviada",
            description: "Tu solicitud ha sido enviada exitosamente.",
          });
        } catch (emailError) {
          console.error('Error sending notification email:', emailError);
          // No fallar la creación del evento por error de email
          toast({
            title: "Solicitud creada",
            description: "La solicitud se ha creado, pero no se pudo enviar la notificación por email.",
            variant: "destructive",
          });
        }
      } else {
        // Para administradores/secretarias (evento directo)
        toast({
          title: "Evento creado",
          description: "El evento se ha creado exitosamente.",
        });
      }
    }

    await refetch();
    setDialogOpen(false);
    setSelectedEvent(null);
  } catch (error) {
    console.error("Error creating/updating event:", error);
    toast({
      title: "Error",
      description: selectedEvent 
        ? ((isSecretaria || isAdmin || isSecrCalendario) ? "No se pudo actualizar el evento." : "No se pudo actualizar la solicitud.")
        : ((isSecretaria || isAdmin || isSecrCalendario) ? "No se pudo crear el evento." : "No se pudo enviar la solicitud."),
      variant: "destructive",
    });
  }
};

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
    setDialogOpen(true);
  };

  const handleDeleteClick = (event: Event, e: React.MouseEvent) => {
    e.stopPropagation();
    setEventToDelete(event);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!eventToDelete) return;
    
    try {
      await deleteEvent(eventToDelete.id);
      await refetch();
      toast({
        title: (isSecretaria || isAdmin || isSecrCalendario) ? "Evento eliminado" : "Solicitud eliminada",
        description: (isSecretaria || isAdmin || isSecrCalendario) 
          ? "El evento se ha eliminado exitosamente."
          : "La solicitud se ha eliminado exitosamente.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: (isSecretaria || isAdmin || isSecrCalendario) 
          ? "No se pudo eliminar el evento."
          : "No se pudo eliminar la solicitud.",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setEventToDelete(null);
    }
  };

  // Mutaciones para aprobar y rechazar solicitudes
  const { mutate: approveRequest } = useMutation({
    mutationFn: async (eventId: string) => {
      return updateEvent(eventId, {
        solicitud: false,
        estado: 'aprobada'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud ha sido aprobada y ahora es visible para todos.",
      });
      setDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aprobar la solicitud.",
        variant: "destructive",
      });
    }
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async (eventId: string) => {
      return updateEvent(eventId, {
        estado: 'rechazada'
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud ha sido rechazada.",
      });
      setDialogOpen(false);
      setSelectedEvent(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar la solicitud.",
        variant: "destructive",
      });
    }
  });

  const handleApproveRequest = (eventId: string) => {
    approveRequest(eventId);
  };

  const handleRejectRequest = (eventId: string) => {
    rejectRequest(eventId);
  };

  // Función para obtener el badge de estado
  const getStatusBadge = (event: any) => {
    if (!canCreateEvents || !event.solicitud) return null;
    
    const estado = event.estado || 'pendiente';
    const variants: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'aprobada': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'rechazada': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };

    return (
      <Badge className={`ml-2 ${variants[estado] || variants['pendiente']}`}>
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
  };

  const modifiers = {
    hasEvent: (date: Date) => {
      const dateStr = format(date, 'yyyy-MM-dd');
      return dateStr in eventDates;
    }
  };

  const modifiersStyles = {
    hasEvent: {
      backgroundColor: '#F2FCE2',
      color: '#064e3b',
      fontWeight: 'bold'
    }
  };

  const getEventCardStyle = (eventDate: string) => {
    const now = new Date();
    const date = new Date(eventDate);
    return isAfter(date, now) 
      ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70" 
      : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70";
  };

  const handleMonthChange = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Cargando calendario...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Calendario de Eventos</CardTitle>
          {/* Solo mostrar el botón de crear si puede crear eventos */}
          {canCreateEvents && (
            <Dialog 
              open={dialogOpen} 
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setSelectedEvent(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <CalendarPlus className="mr-2 h-4 w-4" />
                  Agregar Evento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    {selectedEvent ? "Editar Evento" : "Crear Nuevo Evento"}
                    {selectedEvent && getStatusBadge(selectedEvent)}
                  </DialogTitle>
                </DialogHeader>
                
                {/* Mostrar información de la solicitud si es aplicable */}
                {selectedEvent && canCreateEvents && (selectedEvent as any).solicitud && (
                  <div className="mb-4 p-3 bg-muted/50 rounded-md">
                    <h4 className="font-semibold text-sm mb-2">Información de la Solicitud:</h4>
                    <p className="text-sm text-muted-foreground">
                      <strong>Departamento:</strong> {(selectedEvent as any).departamento || 'No especificado'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Estado:</strong> {(selectedEvent as any).estado || 'Pendiente'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Fecha:</strong> {format(new Date(selectedEvent.date), "dd/MM/yyyy", { locale: es })}
                    </p>
                    {selectedEvent.time && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Hora:</strong> {selectedEvent.time}
                      </p>
                    )}
                    {selectedEvent.description && (
                      <p className="text-sm text-muted-foreground">
                        <strong>Descripción:</strong> {selectedEvent.description}
                      </p>
                    )}
                  </div>
                )}
                
                {/* Solo mostrar el formulario si no es una solicitud rechazada */}
                {!(selectedEvent && (selectedEvent as any).estado === 'rechazada') && (
                  <EventForm 
                    onSubmit={handleCreateEvent} 
                    initialData={selectedEvent || undefined}
                    isRequestMode={!(isSecretaria || isAdmin || isSecrCalendario)}
                    onSuccess={() => {
                      setDialogOpen(false);
                      setSelectedEvent(null);
                    }}
                  />
                )}
                
                {/* Mensaje para solicitudes rechazadas */}
                {selectedEvent && (selectedEvent as any).estado === 'rechazada' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md text-center">
                    <p className="text-red-800 font-medium">Esta solicitud ha sido rechazada y no puede ser modificada.</p>
                  </div>
                )}
                
                {/* Botones para gestionar solicitudes */}
                {selectedEvent && canCreateEvents && (selectedEvent as any).solicitud && 
                  ((selectedEvent as any).estado === 'pendiente' || !(selectedEvent as any).estado) && (
                  <DialogFooter className="mt-4 flex justify-between gap-2">
                    <div className="flex gap-2">
                      <Button 
                        variant="default"
                        className="bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleApproveRequest(selectedEvent.id)}
                      >
                        <Check className="mr-2 h-4 w-4" />
                        Aprobar
                      </Button>
                      <Button 
                        variant="destructive"
                        onClick={() => handleRejectRequest(selectedEvent.id)}
                      >
                        <X className="mr-2 h-4 w-4" />
                        Rechazar
                      </Button>
                    </div>
                  </DialogFooter>
                )}
                
                {/* Botón de eliminar para eventos/solicitudes (no rechazadas) */}
                {selectedEvent && canCreateEvents && !(canCreateEvents && (selectedEvent as any).solicitud) && 
                  (selectedEvent as any).estado !== 'rechazada' && (
                  <DialogFooter className="mt-4 flex justify-between">
                    <Button 
                      variant="destructive" 
                      type="button"
                      onClick={(e) => handleDeleteClick(selectedEvent, e)}
                      className="flex items-center"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Evento
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
          )}
          
          {/* Botón separado para solicitar fecha si no puede crear eventos */}
          {!canCreateEvents && (
            <Dialog 
              open={dialogOpen} 
              onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) setSelectedEvent(null);
              }}
            >
              <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Solicitar Fecha
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="flex items-center">
                    {selectedEvent 
                      ? "Editar Solicitud"
                      : "Solicitar Nueva Fecha"
                    }
                    {selectedEvent && getStatusBadge(selectedEvent)}
                  </DialogTitle>
                </DialogHeader>
                
                {/* Solo mostrar el formulario si puede editar el evento o está creando uno nuevo */}
                {(!selectedEvent || canEditEvent(selectedEvent)) && 
                 !(selectedEvent && (selectedEvent as any).estado === 'rechazada') && (
                  <EventForm 
                    onSubmit={handleCreateEvent} 
                    initialData={selectedEvent || undefined}
                    isRequestMode={true}
                    onSuccess={() => {
                      setDialogOpen(false);
                      setSelectedEvent(null);
                    }}
                  />
                )}
                
                {/* Vista de solo lectura para eventos que no puede editar */}
                {selectedEvent && !canEditEvent(selectedEvent) && (
                  <div className="space-y-4">
                    <div className="p-4 bg-muted/50 rounded-md">
                      <h4 className="font-semibold text-sm mb-3">Detalles del Evento:</h4>
                      <div className="space-y-2">
                        <p className="text-sm">
                          <strong>Título:</strong> {selectedEvent.title}
                        </p>
                        <p className="text-sm">
                          <strong>Fecha:</strong> {format(new Date(selectedEvent.date), "dd/MM/yyyy", { locale: es })}
                        </p>
                        {selectedEvent.time && (
                          <p className="text-sm">
                            <strong>Hora:</strong> {selectedEvent.time}
                          </p>
                        )}
                        {selectedEvent.description && (
                          <p className="text-sm">
                            <strong>Descripción:</strong> {selectedEvent.description}
                          </p>
                        )}
                        {(selectedEvent as any).departamento && (
                          <p className="text-sm">
                            <strong>Departamento:</strong> {(selectedEvent as any).departamento}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Mensaje para solicitudes rechazadas */}
                {selectedEvent && (selectedEvent as any).estado === 'rechazada' && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-md text-center">
                    <p className="text-red-800 font-medium">Esta solicitud ha sido rechazada y no puede ser modificada.</p>
                  </div>
                )}
                
                {/* Botón de eliminar solo para solicitudes propias */}
                {selectedEvent && canEditEvent(selectedEvent) && (selectedEvent as any).estado !== 'rechazada' && (
                  <DialogFooter className="mt-4 flex justify-between">
                    <Button 
                      variant="destructive" 
                      type="button"
                      onClick={(e) => handleDeleteClick(selectedEvent, e)}
                      className="flex items-center"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Eliminar Solicitud
                    </Button>
                  </DialogFooter>
                )}
              </DialogContent>
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-md border shadow-sm p-4 flex justify-center dark:bg-gray-800 dark:border-gray-700">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                onMonthChange={handleMonthChange}
                className="w-full"
                locale={es}
                modifiers={modifiers}
                modifiersStyles={modifiersStyles}
                components={{
                  DayContent: ({ date }) => {
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayEvents = eventDates[dateStr];

                    if (!dayEvents) {
                      return <span>{date.getDate()}</span>;
                    }

                    const allPastEvents = dayEvents.every(event => 
                      isBefore(new Date(event.date), new Date())
                    );

                    return (
                      <HoverCard>
                        <HoverCardTrigger asChild>
                          <span 
                            className={`cursor-pointer w-full h-full flex items-center justify-center ${
                              allPastEvents 
                                ? 'bg-[#ea384c]/10 dark:bg-[#4e2a2a]/70' 
                                : 'bg-[#F2FCE2] dark:bg-[#2a4e27]/70'
                            }`}
                          >
                            {date.getDate()}
                          </span>
                        </HoverCardTrigger>
                        <HoverCardContent className="w-80 dark:bg-gray-800 dark:border-gray-700">
                          <div className="space-y-2">
                            {dayEvents.map((event) => {
                              const isPastEvent = isBefore(new Date(event.date), new Date());
                              return (
                                <div 
                                  key={event.id} 
                                  className={`p-2 rounded-md cursor-pointer ${
                                    isPastEvent 
                                      ? "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70" 
                                      : "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70"
                                  }`}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                      <div className="flex items-center">
                                        <h4 className="font-semibold dark:text-white">{event.title}</h4>
                                        {getStatusBadge(event)}
                                      </div>
                                      {canCreateEvents && (event as any).solicitud && (event as any).departamento && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          Solicitado por: {(event as any).departamento}
                                        </p>
                                      )}
                                    </div>
                                    {/* Solo mostrar botón de eliminar si puede gestionar eventos y puede editar este evento específico */}
                                    {canCreateEvents && canEditEvent(event) && (
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="h-7 w-7 p-0 ml-2" 
                                        onClick={(e) => handleDeleteClick(event, e)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/90" />
                                      </Button>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground whitespace-pre-line dark:text-gray-300">{event.description}</p>
                                </div>
                              );
                            })}
                          </div>
                        </HoverCardContent>
                      </HoverCard>
                    );
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold mb-4 dark:text-white">
                {(isSecretaria || isAdmin || isSecrCalendario) ? "Eventos" : "Fechas solicitadas"} del mes {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
              </h3>
              <div className="space-y-2">
                {currentMonthEvents.length > 0 ? (
                  <div className="overflow-hidden rounded-md border">
                    <div className="bg-primary/10 dark:bg-primary/20">
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead className="font-semibold text-primary w-16">Fecha</TableHead>
                            <TableHead className="font-semibold text-primary">Título</TableHead>
                            <TableHead className="font-semibold text-primary w-16">Hora</TableHead>
                            {canCreateEvents && <TableHead className="font-semibold text-primary w-10"></TableHead>}
                          </TableRow>
                        </TableHeader>
                      </Table>
                    </div>
                    <ScrollArea className="h-[250px]">
                      <Table>
                        <TableBody>
                          {currentMonthEvents.map((event) => (
                            <TableRow 
                              key={event.id} 
                              className={`hover:bg-muted/50 cursor-pointer transition-colors duration-200 ${
                                isAfter(new Date(event.date), new Date()) 
                                ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70" 
                                : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70"
                              }`}
                              onClick={() => handleEventClick(event)}
                            >
                              <TableCell className="font-medium w-16">
                                {format(new Date(event.date), 'dd/MM')}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center">
                                  <span>{event.title}</span>
                                  {getStatusBadge(event)}
                                </div>
                                {canCreateEvents && (event as any).solicitud && (event as any).departamento && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Solicitado por: {(event as any).departamento}
                                  </p>
                                )}
                              </TableCell>
                              <TableCell className="w-16">
                                {event.time || "-"}
                              </TableCell>
                              {canCreateEvents && (
                                <TableCell className="w-10">
                                  {canEditEvent(event) && (
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="h-7 w-7 p-0" 
                                      onClick={(e) => handleDeleteClick(event, e)}
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive hover:text-destructive/90" />
                                    </Button>
                                  )}
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                ) : (
                  <p className="text-muted-foreground dark:text-gray-400">
                    {(isSecretaria || isAdmin || isSecrCalendario) ? "No hay eventos este mes" : "No hay fechas solicitadas este mes"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="dark:bg-gray-800 dark:border-gray-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="dark:text-white">Confirmar eliminación</AlertDialogTitle>
            <AlertDialogDescription className="dark:text-gray-300">
              ¿Estás seguro de que deseas eliminar {(isSecretaria || isAdmin || isSecrCalendario) ? "este evento" : "esta solicitud"}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}