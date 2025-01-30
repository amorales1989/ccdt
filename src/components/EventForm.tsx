import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";

interface EventFormData {
  title: string;
  date: string;
  description: string;
}

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: EventFormData;
}

export function EventForm({ onSubmit, initialData }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<EventFormData>({
    defaultValues: initialData || {
      title: "",
      date: "",
      description: ""
    }
  });

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      onSubmit(data);
      form.reset();
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
                <Input type="date" {...field} />
              </FormControl>
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
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? "Guardando..." : "Guardar Evento"}
        </Button>
      </form>
    </Form>
  );
}