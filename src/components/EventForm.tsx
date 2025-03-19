
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
  
  // Parse hour, minute, and period from the time string
  const parseTime = (timeString: string) => {
    const [hourStr, minuteStr] = timeString.split(':');
    let hour = parseInt(hourStr, 10);
    const minute = parseInt(minuteStr, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    
    // Convert 24-hour format to 12-hour format for display
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    
    return { hour, minute, period };
  };
  
  const initialTimeParts = parseTime(initialTimeValue);
  const [hour, setHour] = useState(initialTimeParts.hour);
  const [minute, setMinute] = useState(initialTimeParts.minute);
  const [period, setPeriod] = useState(initialTimeParts.period);
  
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
    let hour24 = hour;
    
    // Convert from 12-hour to 24-hour format
    if (period === 'PM' && hour < 12) hour24 += 12;
    if (period === 'AM' && hour === 12) hour24 = 0;
    
    return `${hour24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  // Update the form's time value when hour, minute, or period changes
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

  // Generate clock numbers for the visual clock
  const clockNumbers = Array.from({ length: 12 }, (_, i) => i + 1);

  // Calculate position for clock numbers and the hand
  const getNumberPosition = (number: number) => {
    const angle = (number * 30 - 90) * (Math.PI / 180);
    const radius = 70;
    const x = radius * Math.cos(angle);
    const y = radius * Math.sin(angle);
    return { x, y };
  };

  const getHandPosition = () => {
    // For hour hand
    const hourAngle = ((hour % 12) * 30 - 90) * (Math.PI / 180);
    const radius = 40;
    const x = radius * Math.cos(hourAngle);
    const y = radius * Math.sin(hourAngle);
    return { x, y };
  };

  const handPosition = getHandPosition();

  // Handle hour increment/decrement
  const adjustHour = (increment: boolean) => {
    setHour(prevHour => {
      let newHour = increment ? prevHour + 1 : prevHour - 1;
      if (newHour > 12) newHour = 1;
      if (newHour < 1) newHour = 12;
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
                    <span>{displayTime} {period}</span>
                  </div>

                  {showTimePicker && (
                    <div className="absolute z-50 mt-2 p-4 bg-white rounded-lg shadow-lg border border-gray-200 w-[300px]">
                      <p className="text-sm text-center mb-2 text-gray-500">Select time</p>
                      
                      {/* Time display and controls */}
                      <div className="flex items-center justify-between mb-6">
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
                        
                        {/* AM/PM selector */}
                        <div className="flex flex-col">
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-t-md ${period === 'AM' ? 'bg-[#f897fb] text-white' : 'bg-gray-100'}`}
                            onClick={() => setPeriod('AM')}
                          >
                            AM
                          </button>
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-b-md ${period === 'PM' ? 'bg-[#f897fb] text-white' : 'bg-gray-100'}`}
                            onClick={() => setPeriod('PM')}
                          >
                            PM
                          </button>
                        </div>
                      </div>
                      
                      {/* Visual clock */}
                      <div className="relative w-40 h-40 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
                        {/* Clock center */}
                        <div className="absolute w-2 h-2 bg-[#6E59A5] rounded-full"></div>
                        
                        {/* Hour hand */}
                        <div 
                          className="absolute w-[3px] h-20 bg-[#6E59A5] rounded-full origin-bottom"
                          style={{ 
                            transform: `translate(${handPosition.x}px, ${handPosition.y}px) rotate(${((hour % 12) * 30)}deg)`,
                            transformOrigin: '50% 100%'
                          }}
                        ></div>
                        
                        {/* Hour numbers */}
                        {clockNumbers.map(number => {
                          const position = getNumberPosition(number);
                          const isSelected = hour === number;
                          return (
                            <div 
                              key={number}
                              className={`absolute flex items-center justify-center text-sm
                                ${isSelected ? 'w-8 h-8 bg-[#6E59A5] text-white rounded-full' : ''}
                              `}
                              style={{ 
                                transform: `translate(${position.x}px, ${position.y}px)` 
                              }}
                            >
                              {number}
                            </div>
                          );
                        })}
                      </div>
                      
                      {/* Action buttons */}
                      <div className="flex justify-between mt-4">
                        <Button 
                          type="button" 
                          variant="outline"
                          onClick={() => setShowTimePicker(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="button"
                          onClick={updateFormTime}
                          className="bg-[#9b87f5] hover:bg-[#7E69AB]"
                        >
                          OK
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
