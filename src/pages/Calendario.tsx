import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MuiCalendar } from "@/components/MuiCalendar";
import { Badge } from "@/components/ui/badge";
import { getEvents, deleteEvent, updateEvent, notifyNewRequest, getUsers, notifyRequestResponse } from "@/lib/api";
import { useState, useEffect, useMemo } from "react";
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
import { DeleteConfirmationDialog } from "@/components/DeleteConfirmationDialog";
import { format, isBefore, startOfDay, isSameMonth, isAfter, startOfMonth, endOfMonth, parseISO, eachDayOfInterval } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { createEvent } from "@/lib/api";
import type { Event, Profile } from "@/types/database";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { CustomTabs } from "@/components/CustomTabs";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardCheck, CheckCircle, XCircle, AlertCircle, Clock4, Building, User, FileText as FileTextIcon, Clock, CalendarPlus, Trash2, Calendar as CalendarIcon, Check, X } from "lucide-react";
import { EventForm } from "@/components/EventForm";

export default function Calendario() {
  const [activeTab, setActiveTab] = useState("calendario");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [currentMonthEvents, setCurrentMonthEvents] = useState<Event[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Fecha no disponible");
  const [selectedRequest, setSelectedRequest] = useState<Event | null>(null);
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

  // Filtrar solicitudes según permisos (Lógica de solicitudes.tsx)
  const filteredRequests = useMemo(() => {
    let filtered;
    if (canCreateEvents) {
      // Para gestores: solo mostrar solicitudes PENDIENTES
      filtered = allEvents.filter(event => {
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        return esSolicitud;
      });
    } else {
      // Para usuarios regulares: mostrar sus últimas 10 solicitudes
      filtered = allEvents.filter(event => {
        const solicitanteId = (event as any).solicitante;
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        const tieneEstado = (event as any).estado === 'aprobada' || (event as any).estado === 'rechazada';
        return solicitanteId === profile?.id && (esSolicitud || tieneEstado);
      });
    }
    return filtered.sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );
  }, [allEvents, canCreateEvents, profile?.id]);

  // Obtener usuarios para mostrar nombres en solicitudes
  const { data: users = [] as Profile[] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!profile && (isAdmin || isSecretaria || isSecrCalendario)
  });

  const getUserName = (userId: string): string => {
    const user = (users as Profile[]).find((u) => u.id === userId);
    if (!user) return 'Usuario no encontrado';
    return `${user.first_name.trim()} ${user.last_name.trim()}`.trim();
  };
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
        .filter(event => isSameMonth(parseISO(event.date), selectedDate))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setCurrentMonthEvents(filtered);
    }
  }, [selectedDate, events]);

  const eventDates = events.reduce((acc: Record<string, any[]>, event) => {
    try {
      const startDate = parseISO(event.date);
      let eventRange = [startDate];

      if (event.end_date) {
        const endDate = parseISO(event.end_date);
        if (!isBefore(endDate, startDate)) {
          eventRange = eachDayOfInterval({ start: startDate, end: endDate });
        }
      }

      eventRange.forEach((day: Date) => {
        const dateStr = format(day, 'yyyy-MM-dd');
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        // Avoid duplicates if the event is spanning across months or something
        if (!acc[dateStr].find(e => e.id === event.id)) {
          acc[dateStr].push(event);
        }
      });
    } catch (e) {
      console.error(e);
    }
    return acc;
  }, {});

  // Verificar si el usuario puede editar un evento específico
  const canEditEvent = (event: Event) => {
    if (canCreateEvents) return true;
    // Si es una solicitud propia, puede editarla (verificar por solicitante)
    return (event as any).solicitante === profile?.id;
  };

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
              eventEndDate: eventData.end_date,
              eventTime: eventData.time,
              eventEndTime: eventData.end_time,
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
    onSuccess: async (_, eventId) => {
      // Notificación por email (Lógica de solicitudes.tsx)
      const event = allEvents.find(e => e.id === eventId);
      if (event && event.solicitante) {
        const user = users.find(u => u.id === event.solicitante);
        if (user && user.email) {
          try {
            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: `${user.first_name} ${user.last_name}`,
              requesterEmail: user.email,
              estado: 'aprobado',
              solicitante_id: event.solicitante,
              adminMessage: 'Tu solicitud ha sido aprobada.'
            });
          } catch (e) { console.error(e); }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud aprobada",
        description: "La solicitud ha sido aprobada.",
      });
      setDialogOpen(false);
      setSelectedEvent(null);
      setSelectedRequest(null);
    }
  });

  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      return updateEvent(eventId, {
        estado: 'rechazada',
        motivoRechazo: reason
      } as any);
    },
    onSuccess: async (_, { eventId, reason }) => {
      const event = allEvents.find(e => e.id === eventId);
      if (event && event.solicitante) {
        const user = users.find(u => u.id === event.solicitante);
        if (user && user.email) {
          try {
            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: `${user.first_name} ${user.last_name}`,
              requesterEmail: user.email,
              estado: 'rechazado',
              adminMessage: reason,
              solicitante_id: event.solicitante,
            });
          } catch (e) { console.error(e); }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud ha sido rechazada.",
      });
      setDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedEvent(null);
      setSelectedRequest(null);
    }
  });

  const handleApproveRequest = (eventId: string) => {
    approveRequest(eventId);
  };

  const handleRejectRequest = (eventId: string) => {
    setSelectedRequest(allEvents.find(e => e.id === eventId) || null);
    setRejectReason("Fecha no disponible");
    setRejectDialogOpen(true);
  };

  const handleConfirmReject = () => {
    if (selectedRequest && rejectReason.trim()) {
      rejectRequest({ eventId: selectedRequest.id, reason: rejectReason.trim() });
    }
  };

  const getStatusBadge = (event: any) => {
    const isSolicitud = event.solicitud === true && event.estado === 'solicitud';
    const estado = event.estado || 'pendiente';

    if (isSolicitud) {
      return (
        <Badge className="ml-2 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Clock4 className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }

    const variants: { [key: string]: string } = {
      'pendiente': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      'aprobada': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'rechazada': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };

    return (
      <Badge className={`ml-2 ${variants[estado] || variants['pendiente']} flex items-center gap-1`}>
        {estado === 'aprobada' && <CheckCircle className="h-3 w-3" />}
        {estado === 'rechazada' && <XCircle className="h-3 w-3" />}
        {estado.charAt(0).toUpperCase() + estado.slice(1)}
      </Badge>
    );
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
    <div className="animate-fade-in space-y-8 pb-8 p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-center mb-8">
        <CustomTabs
          value={activeTab}
          onChange={setActiveTab}
          options={[
            { value: "calendario", label: "Calendario", icon: CalendarIcon },
            { value: "solicitudes", label: `Solicitudes ${filteredRequests.length > 0 ? "(" + filteredRequests.length + ")" : ""}`, icon: ClipboardCheck }
          ]}
        />
      </div>

      {activeTab === "calendario" && (
        <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl">
          {/* Decorative background blurs */}
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8 border-b border-purple-200/60 dark:border-slate-700/60 pb-6">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
                  <CalendarIcon className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-foreground tracking-tight">Calendario de Eventos</h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {(isSecretaria || isAdmin || isSecrCalendario) ? "Gestiona los eventos y solicitudes" : "Consulta y solicita nuevas fechas"}
                  </p>
                </div>
              </div>
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
                    <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl">
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Agregar Evento
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>

                    <div className="p-6 sm:p-8 relative z-10">
                      <DialogHeader className="mb-6">
                        <DialogTitle className="flex items-center gap-3 text-2xl text-slate-800 dark:text-slate-100">
                          <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                            {selectedEvent ? <CalendarIcon className="h-6 w-6" /> : <CalendarPlus className="h-6 w-6" />}
                          </div>
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
                            <strong>Fecha:</strong> {format(parseISO(selectedEvent.date), "dd/MM/yyyy", { locale: es })}
                            {selectedEvent.end_date && selectedEvent.end_date !== selectedEvent.date && (
                              <> - {format(parseISO(selectedEvent.end_date), "dd/MM/yyyy", { locale: es })}</>
                            )}
                          </p>
                          {(selectedEvent.time || selectedEvent.end_time) && (
                            <p className="text-sm text-muted-foreground">
                              <strong>Hora:</strong> {selectedEvent.time || 'N/A'} {selectedEvent.end_time ? `- ${selectedEvent.end_time} hs` : 'hs'}
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
                          <DialogFooter className="mt-8 flex justify-between gap-3">
                            <div className="flex flex-col sm:flex-row gap-3 w-full">
                              <Button
                                variant="default"
                                className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md shadow-green-500/20 rounded-xl"
                                onClick={() => handleApproveRequest(selectedEvent!.id)}
                              >
                                Otorgar Fecha
                              </Button>
                              <Button
                                variant="destructive"
                                className="w-full sm:w-auto shadow-md shadow-red-500/20 rounded-xl"
                                onClick={() => {
                                  handleRejectRequest(selectedEvent!.id);
                                  setDialogOpen(false);
                                }}
                              >
                                Rechazar Fecha
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
                              onClick={(e) => handleDeleteClick(selectedEvent!, e)}
                              className="flex items-center"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Eliminar Evento
                            </Button>
                          </DialogFooter>
                        )}
                    </div>
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
                    <Button className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      Solicitar Fecha
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="w-[95vw] max-w-xl sm:max-w-xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden">
                    <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>

                    <div className="p-6 sm:p-8 relative z-10">
                      <DialogHeader className="mb-6">
                        <DialogTitle className="flex items-center gap-3 text-2xl text-slate-800 dark:text-slate-100">
                          <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                            {selectedEvent ? <CalendarIcon className="h-6 w-6" /> : <CalendarPlus className="h-6 w-6" />}
                          </div>
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
                            onClick={(e) => handleDeleteClick(selectedEvent!, e)}
                            className="flex items-center w-full sm:w-auto shadow-md shadow-red-500/20 rounded-xl"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Eliminar Solicitud
                          </Button>
                        </DialogFooter>
                      )}
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="mt-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendario visual (Izquierda) */}
                <div className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl border border-white/40 dark:border-slate-700/50 shadow-sm p-4 flex justify-center h-fit">
                  <MuiCalendar
                    selectedDate={selectedDate}
                    onDateSelect={setSelectedDate}
                    onMonthChange={handleMonthChange}
                    eventDates={eventDates}
                    renderDayWithEvents={(date, dayEvents) => {
                      return (
                        <HoverCard>
                          <HoverCardTrigger asChild>
                            <span
                              style={{
                                position: 'absolute',
                                inset: 0,
                                cursor: 'pointer',
                              }}
                            />
                          </HoverCardTrigger>
                          <HoverCardContent className="w-80 dark:bg-gray-800 dark:border-gray-700" style={{ zIndex: 9999 }}>
                            <div className="space-y-2">
                              {dayEvents.map((event) => {
                                const isPastEvent = isBefore(parseISO(event.date), new Date());
                                return (
                                  <div
                                    key={event.id}
                                    className={`p-2 rounded-md cursor-pointer ${isPastEvent
                                      ? 'bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70'
                                      : 'bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70'
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
                    }}
                  />
                </div>

                {/* Lista de eventos del mes (Derecha) */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-6">
                    <h3 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400">
                      {(isSecretaria || isAdmin || isSecrCalendario) ? "Eventos" : "Fechas solicitadas"} de {format(selectedDate || new Date(), 'MMMM yyyy', { locale: es })}
                    </h3>
                  </div>
                  <div className="space-y-4">
                    {currentMonthEvents.length > 0 ? (
                      <div className="overflow-hidden rounded-2xl border border-white/40 dark:border-slate-700/50 bg-white/40 dark:bg-slate-900/40 backdrop-blur-sm shadow-sm">
                        <div className="bg-indigo-50/80 dark:bg-indigo-900/20">
                          <Table>
                            <TableHeader>
                              <TableRow className="hover:bg-transparent border-b-indigo-100 dark:border-b-indigo-900/30">
                                <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300 w-16">Fecha</TableHead>
                                <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300">Título</TableHead>
                                <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300 w-16">Hora</TableHead>
                                {canCreateEvents && <TableHead className="font-semibold text-indigo-700 dark:text-indigo-300 w-10"></TableHead>}
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
                                  className={"hover:bg-muted/50 cursor-pointer transition-colors duration-200 " + (isAfter(parseISO(event.date), new Date())
                                    ? "bg-[#F2FCE2] hover:bg-[#F2FCE2]/80 dark:bg-[#2a4e27]/50 dark:hover:bg-[#2a4e27]/70"
                                    : "bg-[#ea384c]/10 hover:bg-[#ea384c]/20 dark:bg-[#4e2a2a]/50 dark:hover:bg-[#4e2a2a]/70"
                                  )}
                                  onClick={() => handleEventClick(event)}
                                >
                                  <TableCell className="font-medium">
                                    {format(parseISO(event.date), 'dd/MM')}
                                    {event.end_date && event.end_date !== event.date && (
                                      <span className="text-[10px] block opacity-70">
                                        al {format(parseISO(event.end_date), 'dd/MM')}
                                      </span>
                                    )}
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
                                  <TableCell className="w-16 text-xs px-2">
                                    {event.time || "-"}
                                    {event.end_time && (
                                      <span className="block opacity-70">-{event.end_time}</span>
                                    )}
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
            </div>
          </div>
        </section>
      )}

      {activeTab === "solicitudes" && (
        <div className="space-y-8 mt-0 focus-visible:outline-none focus-visible:ring-0">
          <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white flex-shrink-0">
                  <ClipboardCheck className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-foreground tracking-tight">
                    {canCreateEvents ? "Solicitudes Pendientes" : "Mis Solicitudes"}
                  </h2>
                  <p className="text-muted-foreground text-sm mt-1">
                    {canCreateEvents ? "Gestiona las solicitudes de fechas para eventos" : "Revisa el estado de tus últimas peticiones"}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-4">
            {filteredRequests.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-12 text-center relative overflow-hidden">
                <div className="bg-white/60 dark:bg-slate-800/60 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-purple-100 dark:border-slate-700">
                  <Clock4 className="h-10 w-10 text-purple-400 dark:text-purple-500" />
                </div>
                <h3 className="text-xl font-bold mb-2">No hay solicitudes</h3>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {canCreateEvents ? "Todas las solicitudes han sido procesadas o no hay nuevas por revisar." : "Aún no has realizado ninguna solicitud de evento."}
                </p>
              </div>
            ) : (
              filteredRequests.map((request: any) => (
                <div
                  key={request.id}
                  className="group relative bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden p-5"
                  onClick={() => handleEventClick(request)}
                >
                  <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-lg group-hover:text-purple-600 transition-colors uppercase">{request.title}</h3>
                        {getStatusBadge(request)}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground font-medium">
                        <div className="flex items-center gap-1.5"><CalendarIcon className="h-4 w-4 text-purple-500" /> {format(parseISO(request.date), 'dd/MM/yyyy')} {request.end_date && request.end_date !== request.date && `- ${format(parseISO(request.end_date), 'dd/MM/yyyy')}`}</div>
                        <div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-indigo-500" /> {request.time || 'N/A'} {request.end_time && `- ${request.end_time}`}</div>
                        <div className="flex items-center gap-1.5"><Building className="h-4 w-4 text-pink-500" /> {request.departamento || 'N/A'}</div>
                        {canCreateEvents && request.solicitante && (
                          <div className="flex items-center gap-1.5"><User className="h-4 w-4 text-blue-500" /> {getUserName(request.solicitante)}</div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <DeleteConfirmationDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Confirmar eliminación"
        description={`¿Estás seguro de que deseas eliminar ${(isSecretaria || isAdmin || isSecrCalendario) ? "este evento" : "esta solicitud"}? Esta acción no se puede deshacer.`}
      />

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent className="w-[95vw] max-w-md sm:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-red-200/50 dark:border-red-900/30 rounded-3xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              Motivo de Rechazo
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Ingrese el motivo del rechazo:
              </label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo del rechazo..."
                className="min-h-[120px] resize-none rounded-2xl bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 focus:ring-red-500/20"
                maxLength={500}
              />
              <div className="text-xs text-muted-foreground mt-2 text-right">
                {rejectReason.length}/500 caracteres
              </div>
            </div>

            {selectedRequest && (
              <div className="bg-red-50/50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30 font-medium">
                <p className="text-sm text-muted-foreground">Solicitud a rechazar:</p>
                <p className="font-bold uppercase">{selectedRequest.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(parseISO(selectedRequest.date), 'dd/MM/yyyy')}
                  {(selectedRequest.time || selectedRequest.end_time) && ` - ${selectedRequest.time || 'N/A'}${selectedRequest.end_time ? ` - ${selectedRequest.end_time}` : ''}`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("Fecha no disponible");
              }}
              className="rounded-xl w-full sm:w-auto"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
              className="flex items-center gap-2 rounded-xl w-full sm:w-auto font-bold"
            >
              <X className="h-4 w-4" />
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}