
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { Event } from "@/types/database";
import { format, parseISO, addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from 'date-fns-tz';

type EventFormData = Omit<Event, "id" | "created_at" | "updated_at"> & {
  time?: string;
};

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: Event;
  onSuccess?: () => void;
}

export function EventForm({ onSubmit, initialData, onSuccess }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timeZone = 'America/Argentina/Buenos_Aires';
  
  // Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria de Argentina
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  // Generate time options for the select
  const timeOptions = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute of [0, 30]) {
      const formattedHour = hour.toString().padStart(2, '0');
      const formattedMinute = minute.toString().padStart(2, '0');
      timeOptions.push(`${formattedHour}:${formattedMinute}`);
    }
  }

  // Extract time from initialData if available
  const initialTime = initialData?.description?.match(/Hora: (\d{2}:\d{2})/)?.[1] || "09:00";

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      date: initialData?.date ? format(toZonedTime(parseISO(initialData.date), timeZone), 'yyyy-MM-dd') : "",
      description: initialData?.description?.replace(/Hora: \d{2}:\d{2}\s*/, "") || "",
      time: initialTime
    }
  });

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      // Convertir la fecha local a UTC antes de enviar y sumar un día
      const localDate = parseISO(data.date);
      const dateWithAddedDay = addDays(localDate, 1);
      const utcDate = fromZonedTime(dateWithAddedDay, timeZone);
      
      // Add time to description
      const descriptionWithTime = data.time 
        ? `${data.description || ""}\nHora: ${data.time}`
        : data.description;
      
      const formattedData = {
        ...data,
        date: format(utcDate, 'yyyy-MM-dd'),
        description: descriptionWithTime,
      };
      
      await onSubmit(formattedData);
      if (!initialData) {
        form.reset();
      }
      
      // Call onSuccess callback to close modal if provided
      if (onSuccess) {
        onSuccess();
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
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hora</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione la hora" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {timeOptions.map((time) => (
                    <SelectItem key={time} value={time}>
                      {time}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
