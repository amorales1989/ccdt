import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getEvents, updateEvent, getUsers, notifyRequestResponse } from "@/lib/api";
import { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Check,
  X,
  Calendar,
  Clock,
  Building,
  ClipboardCheck,
  Clock4,
  FileText,
  User,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import type { Event } from "@/types/database";
import { useAuth } from "@/contexts/AuthContext";

// Tipo para el usuario
interface User {
  id: string;
  first_name: string;
  last_name: string;
  role: string;
  assigned_class: string;
  departments: string[];
  department_id: string;
  email: string;
}

export default function Solicitudes() {
  const [selectedRequest, setSelectedRequest] = useState<Event | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("Fecha no disponible");

  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Verificar permisos
  const canManageRequests = profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'secr.-calendario';

  const { data: allEvents = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['events'],
    queryFn: getEvents,
    refetchOnWindowFocus: true, // Actualizar cuando el usuario vuelva a la pantalla
    staleTime: 0 // Considerar los datos como obsoletos inmediatamente
  });

  // Obtener todos los usuarios para poder mostrar nombres
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    refetchOnWindowFocus: true,
    staleTime: 5 * 60 * 1000 // Los usuarios cambian menos frecuentemente (5 minutos)
  });

  // Función para obtener el nombre del usuario por ID
  const getUserName = (userId: string): string => {
    const user = users.find((u: User) => u.id === userId);
    if (!user) return 'Usuario no encontrado';
    return `${user.first_name.trim()} ${user.last_name.trim()}`.trim();
  };

  // Función para obtener el usuario completo por ID
  const getUser = (userId: string): User | null => {
    return users.find((u: User) => u.id === userId) || null;
  };

  // Función para obtener el badge de estado
  const getStatusBadge = (request: Event) => {
    const estado = (request as any).estado;
    const esSolicitud = (request as any).solicitud === true && (request as any).estado === 'solicitud';
    if (esSolicitud) {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 flex items-center gap-1">
          <Clock4 className="h-3 w-3" />
          Pendiente
        </Badge>
      );
    }

    if (estado === 'aprobada') {
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Aprobada
        </Badge>
      );
    }

    if (estado === 'rechazada') {
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 flex items-center gap-1">
          <XCircle className="h-3 w-3" />
          Rechazada
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        Sin estado
      </Badge>
    );
  };

  // Filtrar solicitudes según permisos
  const filteredRequests = useMemo(() => {
    let filtered;

    if (canManageRequests) {
      // Para gestores: solo mostrar solicitudes PENDIENTES (solicitud: true)
      filtered = allEvents.filter(event => {
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        return esSolicitud; // Solo solicitudes pendientes
      });
    } else {
      // Para usuarios regulares: mostrar TODAS sus solicitudes (pendientes, aprobadas, rechazadas)
      filtered = allEvents.filter(event => {
        const solicitanteId = (event as any).solicitante;
        const esSolicitud = (event as any).solicitud === true && (event as any).estado === 'solicitud';
        const tieneEstado = (event as any).estado === 'aprobada' || (event as any).estado === 'rechazada';

        // Incluir si es del usuario y es una solicitud O tiene estado de aprobación/rechazo
        return solicitanteId === profile?.id && (esSolicitud || tieneEstado);
      });
    }

    // Ordenar por fecha de creación (más recientes primero)
    const sorted = filtered.sort((a, b) =>
      new Date(b.created_at || b.date).getTime() - new Date(a.created_at || a.date).getTime()
    );

    // Para usuarios regulares, limitar a los últimos 10 registros
    if (!canManageRequests) {
      return sorted.slice(0, 10);
    }

    return sorted;
  }, [allEvents, canManageRequests, profile?.id]);

  // Mutaciones para aprobar y rechazar solicitudes (solo para gestores)
  const { mutate: approveRequest } = useMutation({
    mutationFn: async (eventId: string) => {
      return updateEvent(eventId, {
        solicitud: false,
        estado: 'aprobada'
      });
    },
    onSuccess: async (_, eventId) => {
      // Obtener el evento actualizado
      const event = allEvents.find(e => e.id === eventId);

      if (event) {
        const solicitanteId = (event as any).solicitante;
        const user = users.find((u: User) => u.id === solicitanteId);

        if (user && user.email) {
          try {
            const requesterName = `${user.first_name.trim()} ${user.last_name.trim()}`.trim();

            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: requesterName,
              requesterEmail: user.email,
              estado: 'aprobado',
              description: event.description || undefined,
              solicitante_id: solicitanteId,
              adminMessage: 'Tu solicitud ha sido aprobada. El evento ahora es visible en el calendario para todos.'
            });

          } catch (emailError) {
            console.error('Error enviando email de aprobación:', emailError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud aceptada",
        description: "La solicitud ha sido aceptada.",
      });
      setDetailsDialogOpen(false);
      setSelectedRequest(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo aceptar la solicitud.",
        variant: "destructive",
      });
    }
  });


  const { mutate: rejectRequest } = useMutation({
    mutationFn: async ({ eventId, reason }: { eventId: string; reason: string }) => {
      return updateEvent(eventId, {
        estado: 'rechazada',
        motivoRechazo: reason
      });
    },
    onSuccess: async (_, { eventId, reason }) => {
      const event = allEvents.find(e => e.id === eventId);

      if (event) {
        const solicitanteId = (event as any).solicitante;
        const user = users.find((u: User) => u.id === solicitanteId);

        if (user && user.email) {
          try {
            const requesterName = `${user.first_name.trim()} ${user.last_name.trim()}`.trim();

            await notifyRequestResponse({
              eventTitle: event.title,
              eventDate: event.date,
              eventTime: event.time || undefined,
              department: (event as any).departamento,
              requesterName: requesterName,
              requesterEmail: user.email,
              estado: 'rechazado',
              description: event.description || undefined,
              adminMessage: reason,
              solicitante_id: solicitanteId,
            });

          } catch (emailError) {
            console.error('Error enviando email de rechazo:', emailError);
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['events'] });
      toast({
        title: "Solicitud rechazada",
        description: "La solicitud ha sido rechazada.",
      });
      setDetailsDialogOpen(false);
      setRejectDialogOpen(false);
      setSelectedRequest(null);
      setRejectReason("Fecha no disponible");
    },
    onError: () => {
      toast({
        title: "Error",
        description: "No se pudo rechazar la solicitud.",
        variant: "destructive",
      });
    }
  });

  const handleViewDetails = (request: Event) => {
    setSelectedRequest(request);
    setDetailsDialogOpen(true);
  };

  const handleApprove = () => {
    if (selectedRequest) {
      approveRequest(selectedRequest.id);
    }
  };

  const handleReject = () => {
    if (selectedRequest) {
      setRejectDialogOpen(true);
    }
  };

  const handleConfirmReject = () => {
    if (selectedRequest && rejectReason.trim()) {
      rejectRequest({ eventId: selectedRequest.id, reason: rejectReason.trim() });
    }
  };

  const isLoading = eventsLoading || usersLoading;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Cargando solicitudes...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Título y descripción según permisos
  const pageTitle = canManageRequests
    ? "Solicitudes Pendientes"
    : "Mis Solicitudes";

  const pageDescription = canManageRequests
    ? "Gestiona las solicitudes de eventos pendientes de aprobación"
    : "Revisa el estado de tus últimas 10 solicitudes de eventos";

  const emptyStateTitle = canManageRequests
    ? "No hay solicitudes pendientes"
    : "No tienes solicitudes";

  const emptyStateDescription = canManageRequests
    ? "Todas las solicitudes han sido procesadas o no hay nuevas solicitudes por revisar."
    : "Aún no has realizado ninguna solicitud de evento. Puedes crear una nueva solicitud desde el calendario.";

  return (
    <div className="animate-fade-in space-y-8 pb-8 p-4 md:p-6">
      {/* Encabezado con Glassmorphism */}
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl max-w-7xl mx-auto">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white flex-shrink-0">
              <ClipboardCheck className="h-8 w-8" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-3xl font-black text-foreground tracking-tight">{pageTitle}</h2>
                <Badge className="bg-white/50 text-purple-700 dark:bg-slate-800/50 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50 text-sm px-3 py-1 rounded-full shadow-sm backdrop-blur-sm">
                  {filteredRequests.length}
                </Badge>
              </div>
              <p className="text-muted-foreground text-sm mt-1">{pageDescription}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Lista de solicitudes */}
      <div className="space-y-4 max-w-7xl mx-auto">
        {filteredRequests.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md p-12 text-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent pointer-events-none"></div>
            <div className="relative z-10">
              <div className="bg-white/60 dark:bg-slate-800/60 w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-purple-100 dark:border-slate-700">
                <Clock4 className="h-12 w-12 text-purple-400 dark:text-purple-500" />
              </div>
              <h3 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-purple-400 mb-2">{emptyStateTitle}</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                {emptyStateDescription}
              </p>
            </div>
          </div>
        ) : (
          filteredRequests.map((request) => {
            const solicitanteId = (request as any).solicitante;
            const nombreSolicitante = solicitanteId ? getUserName(solicitanteId) : 'No especificado';

            return (
              <div
                key={request.id}
                className="group relative bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-md hover:shadow-xl hover:shadow-purple-500/10 hover:-translate-y-1 hover:border-purple-300/50 dark:hover:border-purple-500/50 transition-all duration-300 cursor-pointer overflow-hidden p-6"
                onClick={() => handleViewDetails(request)}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/0 via-transparent to-pink-500/0 group-hover:from-purple-500/5 group-hover:to-pink-500/5 transition-colors duration-500"></div>

                <div className="relative z-10 flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="flex-1 space-y-4">
                    {/* Título y estado */}
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                        {request.title}
                      </h3>
                      {getStatusBadge(request)}
                    </div>

                    {/* Información básica */}
                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                        <Calendar className="h-4 w-4 text-purple-500" />
                        <span className="font-medium">{format(new Date(request.date), "dd/MM/yyyy", { locale: es })}</span>
                      </div>

                      {request.time && (
                        <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          <Clock className="h-4 w-4 text-indigo-500" />
                          <span className="font-medium">{request.time}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                        <Building className="h-4 w-4 text-pink-500" />
                        <span className="font-medium capitalize text-slate-700 dark:text-slate-300">
                          {(request as any).departamento || 'No especificado'}
                        </span>
                      </div>

                      {/* Mostrar solicitante solo si se tienen permisos de gestión */}
                      {canManageRequests && (
                        <div className="flex items-center gap-1.5 bg-slate-100/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-200/50 dark:border-slate-700/50">
                          <User className="h-4 w-4 text-blue-500" />
                          <span className="font-medium text-slate-700 dark:text-slate-300">
                            {nombreSolicitante}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Descripción (preview) */}
                    {request.description && (
                      <div className="flex items-start gap-2 pt-2">
                        <FileText className="h-4 w-4 text-slate-400 mt-1 flex-shrink-0" />
                        <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {request.description}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal de detalles */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="w-[95vw] max-w-2xl sm:max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-0 max-h-[90vh] overflow-y-auto overflow-x-hidden">
          <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>

          <div className="p-6 sm:p-8 relative z-10">
            <DialogHeader className="mb-6">
              <DialogTitle className="flex items-center gap-3 text-2xl">
                <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                  <ClipboardCheck className="h-6 w-6" />
                </div>
                {canManageRequests ? "Detalles de la Solicitud" : "Detalles de mi Solicitud"}
              </DialogTitle>
            </DialogHeader>

            {selectedRequest && (
              <div className="space-y-6">
                {/* Estado */}
                <div className="flex items-center justify-center p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/50">
                  {getStatusBadge(selectedRequest)}
                </div>

                {/* Información del evento */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Título del evento</label>
                    <h3 className="text-xl font-semibold mt-1">{selectedRequest.title}</h3>
                  </div>

                  {/* Información del solicitante (solo para gestores) */}
                  {canManageRequests && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Solicitado por</label>
                      <div className="flex items-center gap-2 mt-1">
                        <User className="h-4 w-4 text-primary" />
                        <span className="font-medium text-lg">
                          {(selectedRequest as any).solicitante
                            ? getUserName((selectedRequest as any).solicitante)
                            : 'No especificado'
                          }
                        </span>
                        {/* Mostrar rol del usuario si está disponible */}
                        {(selectedRequest as any).solicitante && (() => {
                          const user = getUser((selectedRequest as any).solicitante);
                          return user ? (
                            <Badge variant="outline" className="ml-2 capitalize">
                              {user.role}
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Fecha solicitada</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Calendar className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {format(new Date(selectedRequest.date), "dd/MM/yyyy", { locale: es })}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Hora</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {selectedRequest.time || 'No especificada'}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Departamento</label>
                      <div className="flex items-center gap-2 mt-1">
                        <Building className="h-4 w-4 text-primary" />
                        <span className="font-medium capitalize">
                          {(selectedRequest as any).departamento || 'No especificado'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Descripción */}
                  {selectedRequest.description && (
                    <div>
                      <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Descripción del evento</label>
                      <div className="mt-2 p-5 bg-white/60 dark:bg-slate-950/40 rounded-2xl border border-slate-100 dark:border-slate-800/60 shadow-inner">
                        <p className="whitespace-pre-line leading-relaxed text-slate-700 dark:text-slate-300">{selectedRequest.description}</p>
                      </div>
                    </div>
                  )}

                  {/* Motivo de rechazo (si existe) */}
                  {(selectedRequest as any).motivoRechazo && (
                    <div>
                      <label className="text-sm font-medium text-slate-500 dark:text-slate-400">Motivo de rechazo</label>
                      <div className="mt-2 p-5 bg-red-50/80 dark:bg-red-950/30 rounded-2xl border border-red-100 dark:border-red-900/30">
                        <p className="text-red-800 dark:text-red-300 leading-relaxed font-medium">
                          {(selectedRequest as any).motivoRechazo}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Información de solicitud */}
                  <div className="pt-4 border-t">
                    <label className="text-sm font-medium text-muted-foreground">Información de la solicitud</label>
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>Solicitud creada el {format(new Date(selectedRequest.created_at || selectedRequest.date), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
                      {selectedRequest.updated_at && selectedRequest.updated_at !== selectedRequest.created_at && (
                        <p>Última actualización: {format(new Date(selectedRequest.updated_at), "dd/MM/yyyy 'a las' HH:mm", { locale: es })}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Botones de acción - solo para gestores y solicitudes pendientes */}
            {canManageRequests && selectedRequest && ((selectedRequest as any).solicitud === true && (selectedRequest as any).estado === 'solicitud') && (
              <DialogFooter className="flex justify-center gap-4 pt-6 border-t">
                <Button
                  variant="default"
                  size="lg"
                  className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white flex items-center gap-2 min-w-[160px] rounded-xl shadow-md shadow-green-500/20"
                  onClick={handleApprove}
                >
                  <Check className="h-5 w-5" />
                  Aprobar Solicitud
                </Button>
                <Button
                  variant="destructive"
                  size="lg"
                  className="flex items-center gap-2 min-w-[160px] rounded-xl shadow-md shadow-red-500/20"
                  onClick={handleReject}
                >
                  <X className="h-5 w-5" />
                  Rechazar
                </Button>
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de motivo de rechazo */}
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
              <div className="bg-red-50/50 dark:bg-red-950/20 p-4 rounded-2xl border border-red-100 dark:border-red-900/30">
                <p className="text-sm font-medium text-muted-foreground">Solicitud a rechazar:</p>
                <p className="font-semibold">{selectedRequest.title}</p>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(selectedRequest.date), "dd/MM/yyyy", { locale: es })}
                  {selectedRequest.time && ` - ${selectedRequest.time}`}
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-center gap-3 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setRejectDialogOpen(false);
                setRejectReason("Fecha no disponible");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmReject}
              disabled={!rejectReason.trim()}
              className="flex items-center gap-2"
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