
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { Event } from "@/types/database";
import { format, parseISO } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

type EventFormData = Omit<Event, "id" | "created_at" | "updated_at">;

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: Event;
}

export function EventForm({ onSubmit, initialData }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeZone = 'America/Argentina/Buenos_Aires';
  
  // Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria de Argentina
  const today = format(utcToZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      date: initialData?.date ? format(utcToZonedTime(parseISO(initialData.date), timeZone), 'yyyy-MM-dd') : "",
      description: initialData?.description || ""
    }
  });

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      // Convertir la fecha local a UTC antes de enviar
      const localDate = parseISO(data.date);
      const utcDate = zonedTimeToUtc(localDate, timeZone);
      
      const formattedData = {
        ...data,
        date: format(utcDate, 'yyyy-MM-dd')
      };
      
      await onSubmit(formattedData);
      if (!initialData) {
        form.reset();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Título del Evento</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Ingrese el título del evento" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="date"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Fecha</FormLabel>
              <FormControl>
                <Input 
                  type="date" 
                  {...field} 
                  min={today}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Descripción</FormLabel>
              <FormControl>
                <Textarea 
                  {...field} 
                  placeholder="Ingrese la descripción del evento"
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Guardando..." : initialData ? "Actualizar Evento" : "Crear Evento"}
        </Button>
      </form>
    </Form>
  );
}
