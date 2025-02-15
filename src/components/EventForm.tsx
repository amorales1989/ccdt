
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { Event } from "@/types/database";
import { format, parseISO, addDays } from "date-fns";

type EventFormData = Omit<Event, "id" | "created_at" | "updated_at">;

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: Event;
}

export function EventForm({ onSubmit, initialData }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Obtener la fecha actual en formato YYYY-MM-DD
  const today = format(new Date(), 'yyyy-MM-dd');

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      // Ajustamos la fecha inicial si existe
      date: initialData?.date ? format(addDays(parseISO(initialData.date), 1), 'yyyy-MM-dd') : "",
      description: initialData?.description || ""
    }
  });

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      // Ajustamos la fecha antes de enviar
      const formattedData = {
        ...data,
        date: format(parseISO(data.date), 'yyyy-MM-dd')
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
