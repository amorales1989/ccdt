
import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { useState } from "react";
import type { Event } from "@/types/database";
import { format, parseISO, addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Clock } from "lucide-react";

type EventFormData = Omit<Event, "id" | "created_at" | "updated_at">;

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: Event;
  onSuccess?: () => void;
}

export function EventForm({ onSubmit, initialData, onSuccess }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const timeZone = 'America/Argentina/Buenos_Aires';
  
  // Parse initial time value if available
  const initialTimeValue = initialData?.time || "09:00";
  const [timeValue, setTimeValue] = useState(initialTimeValue);
  
  // Parse hour and minute from the time string
  const parseTime = (timeString: string) => {
    const [hourStr, minuteStr] = timeString.split(':');
    const hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    
    return { hour, minute };
  };
  
  const initialTimeParts = parseTime(initialTimeValue);
  const [hour, setHour] = useState(initialTimeParts.hour);
  const [minute, setMinute] = useState(initialTimeParts.minute);
  
  // Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria de Argentina
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      date: initialData?.date ? format(toZonedTime(parseISO(initialData.date), timeZone), 'yyyy-MM-dd') : "",
      time: initialTimeValue,
      description: initialData?.description || ""
    }
  });

  // Function to format the time in 24-hour format for form submission
  const formatTimeFor24Hour = () => {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Update the form's time value when hour or minute changes
  const updateFormTime = () => {
    const formattedTime = formatTimeFor24Hour();
    form.setValue('time', formattedTime);
    setTimeValue(formattedTime);
    setShowTimePicker(false);
  };

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      // Convertir la fecha local a UTC antes de enviar y sumar un día
      const localDate = parseISO(data.date);
      const dateWithAddedDay = addDays(localDate, 1);
      const utcDate = fromZonedTime(dateWithAddedDay, timeZone);
      
      const formattedData = {
        ...data,
        date: format(utcDate, 'yyyy-MM-dd')
      };
      
      if (initialData) {
        // For update operations, include the ID
        await onSubmit({
          ...formattedData,
          id: initialData.id
        } as any); // Using 'as any' to bypass TypeScript's type check for this special case
      } else {
        // For create operations
        await onSubmit(formattedData);
      }
      
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

  // Handle hour increment/decrement
  const adjustHour = (increment: boolean) => {
    setHour(prevHour => {
      let newHour = increment ? prevHour + 1 : prevHour - 1;
      if (newHour > 23) newHour = 0;
      if (newHour < 0) newHour = 23;
      return newHour;
    });
  };

  // Handle minute increment/decrement
  const adjustMinute = (increment: boolean) => {
    setMinute(prevMinute => {
      let newMinute = increment ? prevMinute + 5 : prevMinute - 5;
      if (newMinute >= 60) newMinute = 0;
      if (newMinute < 0) newMinute = 55;
      return newMinute;
    });
  };

  // Format time for display
  const displayTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Title field */}
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

        {/* Date field */}
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

        {/* Time field with custom time picker */}
        <FormField
          control={form.control}
          name="time"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hora</FormLabel>
              <FormControl>
                <div className="relative">
                  <div 
                    className="flex items-center border border-input rounded-md px-3 py-2 bg-background cursor-pointer"
                    onClick={() => setShowTimePicker(!showTimePicker)}
                  >
                    <Clock className="h-4 w-4 mr-2 text-[#9b87f5]" />
                    <span>{displayTime}</span>
                  </div>

                  {showTimePicker && (
                    <div className="absolute z-50 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-[300px]">
                      <p className="text-sm text-center mb-2 text-gray-500">Seleccionar hora</p>
                      
                      {/* Time display and controls */}
                      <div className="flex items-center justify-center mb-6 gap-4">
                        {/* Hour selector */}
                        <div className="relative flex flex-col items-center">
                          <button 
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => adjustHour(true)}
                          >
                            ▲
                          </button>
                          <div className="w-16 h-16 flex items-center justify-center bg-[#E5DEFF] rounded-md text-3xl font-medium text-[#6E59A5]">
                            {hour.toString().padStart(2, '0')}
                          </div>
                          <button 
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => adjustHour(false)}
                          >
                            ▼
                          </button>
                        </div>
                        
                        {/* Separator */}
                        <div className="text-3xl font-bold">:</div>
                        
                        {/* Minute selector */}
                        <div className="relative flex flex-col items-center">
                          <button 
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => adjustMinute(true)}
                          >
                            ▲
                          </button>
                          <div className="w-16 h-16 flex items-center justify-center bg-gray-100 rounded-md text-3xl font-medium">
                            {minute.toString().padStart(2, '0')}
                          </div>
                          <button 
                            type="button"
                            className="text-gray-400 hover:text-gray-600"
                            onClick={() => adjustMinute(false)}
                          >
                            ▼
                          </button>
                        </div>
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex justify-between mt-4">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowTimePicker(false)}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          type="button"
                          onClick={updateFormTime}
                          className="bg-[#9b87f5] hover:bg-[#7E69AB]"
                        >
                          Aceptar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description field */}
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
