// src/hooks/useCreateEventRequest.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createEvent } from "@/lib/api"; // Ajusta según tu API
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNotifications } from "@/hooks/useNotifications";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CreateEventRequestData {
  title: string;
  description?: string;
  date: string;
  time?: string;
  departamento: string;
  // Agregar otros campos según tu estructura de datos
}

interface CreateEventRequestOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: any) => void;
}

export const useCreateEventRequest = (options?: CreateEventRequestOptions) => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const { sendNewRequestNotification } = useNotifications();

  const createRequestMutation = useMutation({
    mutationFn: async (requestData: CreateEventRequestData) => {
      // Preparar los datos para crear la solicitud
      const eventData = {
        ...requestData,
        solicitud: true, // Marcar como solicitud
        estado: 'solicitud', // Estado inicial
        solicitante: profile?.id, // ID del usuario que solicita
        created_at: new Date().toISOString(),
        // Agregar otros campos según tu estructura
      };

      // Crear el evento/solicitud en la base de datos
      const result = await createEvent(eventData);
      return { result, eventData };
    },
    onSuccess: async ({ result, eventData }) => {
      try {
        // Invalidar queries relevantes
        queryClient.invalidateQueries({ queryKey: ['events'] });
        
        // Preparar datos para la notificación
        const notificationData = {
          title: eventData.title,
          date: format(new Date(eventData.date), "dd/MM/yyyy", { locale: es }),
          requesterName: profile?.first_name && profile?.last_name 
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : 'Usuario',
          department: eventData.departamento || 'Sin especificar'
        };

        // Enviar notificación a administradores y secretarias
        const notificationSent = await sendNewRequestNotification(notificationData);

        // Mostrar toast de éxito
        toast({
          title: "✅ Solicitud enviada",
          description: notificationSent 
            ? "Tu solicitud ha sido enviada y los administradores han sido notificados."
            : "Tu solicitud ha sido enviada. Los administradores la revisarán pronto.",
        });

        // Log para debugging
        console.log('Solicitud creada exitosamente:', {
          eventId: result.id,
          notificationSent,
          requestData: eventData
        });

        // Llamar callback personalizado si existe
        options?.onSuccess?.(result);

      } catch (error) {
        console.error('Error en post-procesamiento de solicitud:', error);
        
        // Aunque la solicitud se creó, hubo un problema con las notificaciones
        toast({
          title: "⚠️ Solicitud enviada",
          description: "Tu solicitud fue creada, pero hubo un problema enviando las notificaciones. Los administradores la revisarán pronto.",
          variant: "default",
        });
      }
    },
    onError: (error) => {
      console.error('Error creando solicitud:', error);
      
      toast({
        title: "❌ Error",
        description: "No se pudo enviar la solicitud. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });

      // Llamar callback personalizado si existe
      options?.onError?.(error);
    }
  });

  return {
    createRequest: createRequestMutation.mutate,
    isCreating: createRequestMutation.isPending,
    error: createRequestMutation.error,
    isSuccess: createRequestMutation.isSuccess,
  };
};

// Hook adicional para validar datos antes de crear la solicitud
export const useValidateEventRequest = () => {
  const validateRequest = (data: CreateEventRequestData): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Validaciones básicas
    if (!data.title?.trim()) {
      errors.push("El título del evento es requerido");
    }

    if (!data.date) {
      errors.push("La fecha del evento es requerida");
    }

    if (!data.departamento?.trim()) {
      errors.push("El departamento es requerido");
    }

    // Validar que la fecha no sea en el pasado
    if (data.date) {
      const eventDate = new Date(data.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Resetear hora para comparar solo fechas

      if (eventDate < today) {
        errors.push("La fecha del evento no puede ser en el pasado");
      }
    }

    // Validar longitud del título
    if (data.title && data.title.length > 100) {
      errors.push("El título no puede tener más de 100 caracteres");
    }

    // Validar longitud de la descripción
    if (data.description && data.description.length > 500) {
      errors.push("La descripción no puede tener más de 500 caracteres");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  return { validateRequest };
};

// Ejemplo de uso en un componente de formulario:
/*
export const EventRequestForm = () => {
  const [formData, setFormData] = useState<CreateEventRequestData>({
    title: '',
    description: '',
    date: '',
    time: '',
    departamento: ''
  });

  const { createRequest, isCreating } = useCreateEventRequest({
    onSuccess: () => {
      // Limpiar formulario o navegar
      setFormData({
        title: '',
        description: '',
        date: '',
        time: '',
        departamento: ''
      });
    }
  });

  const { validateRequest } = useValidateEventRequest();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateRequest(formData);
    if (!validation.isValid) {
      toast({
        title: "Errores en el formulario",
        description: validation.errors.join(", "),
        variant: "destructive"
      });
      return;
    }

    createRequest(formData);
  };

  return (
    <form onSubmit={handleSubmit}>
      // Campos del formulario...
      <Button type="submit" disabled={isCreating}>
        {isCreating ? "Enviando solicitud..." : "Enviar solicitud"}
      </Button>
    </form>
  );
};
*/