import { Button } from "@/components/ui/button";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getDepartments } from "@/lib/api";
import type { Event } from "@/types/database";
import { format, parseISO, addDays } from "date-fns";
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MuiDatePickerField } from "./MuiDatePickerField";

type EventFormData = Omit<Event, "id" | "created_at" | "updated_at"> & {
  departamento?: string;
  end_date?: string;
  end_time?: string;
  solicitud?: boolean;
};

interface EventFormProps {
  onSubmit: (data: EventFormData) => void;
  initialData?: Event;
  isRequestMode?: boolean; // Nueva prop para determinar si se está solicitando
  onSuccess?: () => void;
}

export function EventForm({ onSubmit, initialData, isRequestMode = false, onSuccess }: EventFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isCustomDepartment, setIsCustomDepartment] = useState(false);
  const [customDepartmentValue, setCustomDepartmentValue] = useState('');
  const timeZone = 'America/Argentina/Buenos_Aires';

  // Obtener departamentos para el selector (excluyendo calendario)
  const { data: allDepartments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: getDepartments,
    enabled: isRequestMode // Solo cargar cuando sea modo solicitud
  });

  // Filtrar departamentos excluyendo calendario
  const availableDepartments = allDepartments.filter(dept => dept.name !== 'calendario');

  // Verificar si el valor inicial es un departamento personalizado
  const initialDepartment = (initialData as any)?.departamento || "";
  const isInitialCustom = initialDepartment && !availableDepartments.some(dept => dept.name === initialDepartment);

  // Inicializar estado para departamento personalizado
  useEffect(() => {
    if (isInitialCustom) {
      setIsCustomDepartment(true);
      setCustomDepartmentValue(initialDepartment);
      form.setValue('departamento', 'otro');
    }
  }, [isInitialCustom, initialDepartment]);

  // Manejar cambio de departamento
  const handleDepartmentChange = (value: string) => {
    if (value === 'otro') {
      setIsCustomDepartment(true);
      setCustomDepartmentValue('');
    } else {
      setIsCustomDepartment(false);
      setCustomDepartmentValue('');
    }
  };

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

  const initialEndTimeValue = initialData?.end_time || "";
  const initialEndTimeParts = initialEndTimeValue ? parseTime(initialEndTimeValue) : { hour: null, minute: null };
  const [endHour, setEndHour] = useState<number | null>(initialEndTimeParts.hour);
  const [endMinute, setEndMinute] = useState<number | null>(initialEndTimeParts.minute);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Sync state with initialData when it changes (for editing)
  useEffect(() => {
    const timeValue = initialData?.time || "09:00";
    const parts = parseTime(timeValue);
    setHour(parts.hour);
    setMinute(parts.minute);
    setTimeValue(timeValue);

    const endTimeValue = initialData?.end_time || "";
    if (endTimeValue) {
      const endParts = parseTime(endTimeValue);
      setEndHour(endParts.hour);
      setEndMinute(endParts.minute);
    } else {
      setEndHour(null);
      setEndMinute(null);
    }
  }, [initialData]);

  // Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria de Argentina
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      date: initialData?.date
        ? initialData.date.split('T')[0]
        : "",
      time: initialTimeValue,
      end_date: initialData?.end_date ? initialData.end_date.split('T')[0] : "",
      end_time: initialEndTimeValue,
      description: initialData?.description || "",
      departamento: isInitialCustom ? 'otro' : ((initialData as any)?.departamento || ""),
      solicitud: isRequestMode
    }
  });

  // Function to format the time in 24-hour format for form submission
  const formatTimeFor24Hour = () => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const formatEndTimeFor24Hour = () => {
    if (endHour === null || endMinute === null) return "";
    return `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`;
  };

  // Update the form's time value when hour or minute changes
  const updateFormTime = () => {
    const formattedTime = formatTimeFor24Hour();
    form.setValue('time', formattedTime);
    setTimeValue(formattedTime);
    setShowTimePicker(false);
  };

  const updateFormEndTime = () => {
    const formattedTime = formatEndTimeFor24Hour();
    form.setValue('end_time', formattedTime);
    setShowEndTimePicker(false);
  };

  const handleSubmit = async (data: EventFormData) => {
    setIsSubmitting(true);
    try {
      // La fecha ya viene en formato YYYY-MM-DD desde el input
      const dateStr = data.date;

      // Determinar el departamento final a enviar
      const finalDepartment = isRequestMode && isCustomDepartment ? customDepartmentValue : data.departamento;

      const formattedData = {
        ...data,
        date: dateStr,
        end_date: data.end_date,
        end_time: data.end_time,
        // Agregar campos específicos para solicitudes
        ...(isRequestMode && {
          departamento: finalDepartment,
          solicitud: true,
          estado: 'solicitud'
        })
      };

      if (initialData) {
        // For update operations, include the ID
        await onSubmit({
          ...formattedData,
          id: initialData.id
        } as any);
      } else {
        // For create operations
        await onSubmit(formattedData);
      }

      if (!initialData) {
        form.reset();
        setIsCustomDepartment(false);
        setCustomDepartmentValue('');
      }

      // Call onSuccess callback to close modal if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error("Error submitting form:", error);
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

  const adjustEndHour = (increment: boolean) => {
    setEndHour(prev => {
      let val = prev === null ? 12 : prev;
      let newHour = increment ? val + 1 : val - 1;
      if (newHour > 23) newHour = 0;
      if (newHour < 0) newHour = 23;
      return newHour;
    });
  };

  const adjustEndMinute = (increment: boolean) => {
    setEndMinute(prev => {
      let val = prev === null ? 0 : prev;
      let newMinute = increment ? val + 5 : val - 5;
      if (newMinute >= 60) newMinute = 0;
      if (newMinute < 0) newMinute = 55;
      return newMinute;
    });
  };

  const displayTime = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  const displayEndTime = endHour !== null && endMinute !== null
    ? `${endHour.toString().padStart(2, '0')}:${endMinute.toString().padStart(2, '0')}`
    : "Sin hora";


  // Determinar el texto del botón según el modo y si se está editando
  const getButtonText = () => {
    if (isSubmitting) {
      return "Guardando...";
    }

    if (initialData) {
      return isRequestMode ? "Actualizar Solicitud" : "Actualizar Evento";
    }

    return isRequestMode ? "Solicitar Evento" : "Crear Evento";
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
        {/* Title field */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{isRequestMode ? "Título de la Solicitud" : "Título del Evento"}</FormLabel>
              <FormControl>
                <Input {...field} placeholder={isRequestMode ? "Ingrese el título de la solicitud" : "Ingrese el título del evento"} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Department field - solo para modo solicitud */}
        {isRequestMode && (
          <>
            <FormField
              control={form.control}
              name="departamento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Departamento que solicita</FormLabel>
                  <Select
                    onValueChange={(value) => {
                      field.onChange(value);
                      handleDepartmentChange(value);
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccione el departamento" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableDepartments.map((department) => (
                        <SelectItem
                          key={department.id}
                          value={department.name || ''}
                        >
                          {department.name?.replace(/_/g, ' ').split(' ').map(word =>
                            word.charAt(0).toUpperCase() + word.slice(1)
                          ).join(' ')}
                        </SelectItem>
                      ))}
                      <SelectItem value="otro">
                        Otro (especificar)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Campo personalizado de departamento - aparece cuando se selecciona "Otro" */}
            {isCustomDepartment && (
              <FormItem>
                <FormLabel>Especificar departamento</FormLabel>
                <FormControl>
                  <Input
                    value={customDepartmentValue}
                    onChange={(e) => setCustomDepartmentValue(e.target.value)}
                    placeholder="Ingrese el nombre del departamento"
                  />
                </FormControl>
                {!customDepartmentValue.trim() && (
                  <p className="text-sm text-destructive">Este campo es obligatorio</p>
                )}
              </FormItem>
            )}
          </>
        )}


        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha Inicio</FormLabel>
                <FormControl>
                  <MuiDatePickerField
                    value={field.value ? parseISO(field.value) : undefined}
                    onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                    open={startDateOpen}
                    onOpenChange={setStartDateOpen}
                    placeholder="Fecha inicio"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_date"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha Fin (Opción)</FormLabel>
                <FormControl>
                  <MuiDatePickerField
                    value={field.value ? parseISO(field.value) : undefined}
                    onChange={(date) => field.onChange(date ? format(date, 'yyyy-MM-dd') : '')}
                    open={endDateOpen}
                    onOpenChange={setEndDateOpen}
                    placeholder="Fecha fin"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Time field with custom time picker */}
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora Inicio</FormLabel>
                <FormControl>
                  <Popover open={showTimePicker} onOpenChange={setShowTimePicker}>
                    <PopoverTrigger asChild>
                      <div className="flex items-center border border-input rounded-md px-3 py-2 bg-background cursor-pointer hover:bg-accent/50 transition-colors">
                        <Clock className="h-4 w-4 mr-2 text-[#9b87f5]" />
                        <span>{displayTime}</span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-4 bg-popover rounded-2xl shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200" side="bottom" align="center">
                      <p className="text-[10px] font-bold text-center mb-4 text-muted-foreground uppercase tracking-widest">Seleccionar hora</p>

                      {/* Time display and controls */}
                      <div className="flex items-center justify-center mb-4 gap-3">
                        {/* Hour selector */}
                        <div className="relative flex flex-col items-center">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustHour(true)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <div className="w-12 h-12 flex items-center justify-center bg-primary/10 dark:bg-primary/20 rounded-xl text-xl font-black text-primary">
                            {hour.toString().padStart(2, '0')}
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustHour(false)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Separator */}
                        <div className="text-xl font-bold">:</div>

                        {/* Minute selector */}
                        <div className="relative flex flex-col items-center">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustMinute(true)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <div className="w-12 h-12 flex items-center justify-center bg-accent/20 dark:bg-accent/10 rounded-xl text-xl font-black text-foreground opacity-80">
                            {minute.toString().padStart(2, '0')}
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustMinute(false)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-center mt-2">
                        <Button
                          type="button"
                          onClick={updateFormTime}
                          className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-sm rounded-xl w-full h-9 text-xs"
                        >
                          Aceptar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


          {/* Time field with custom time picker */}
          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora Fin (Opción)</FormLabel>
                <FormControl>
                  <Popover
                    open={showEndTimePicker}
                    onOpenChange={(open) => {
                      if (open && endHour === null) {
                        setEndHour(13);
                        setEndMinute(0);
                      }
                      setShowEndTimePicker(open);
                    }}
                  >
                    <PopoverTrigger asChild>
                      <div className="flex items-center border border-input rounded-md px-3 py-2 bg-background cursor-pointer hover:bg-accent/50 transition-colors">
                        <Clock className="h-4 w-4 mr-2 text-[#9b87f5]" />
                        <span className={!form.watch('end_time') && endHour === null ? "text-muted-foreground" : ""}>
                          {displayEndTime}
                        </span>
                      </div>
                    </PopoverTrigger>
                    <PopoverContent className="w-[260px] p-4 bg-popover rounded-2xl shadow-2xl border border-border animate-in fade-in zoom-in-95 duration-200" side="bottom" align="center">
                      <p className="text-[10px] font-bold text-center mb-4 text-muted-foreground uppercase tracking-widest">Seleccionar hora</p>

                      {/* Time display and controls */}
                      <div className="flex items-center justify-center mb-4 gap-3">
                        {/* Hour selector */}
                        <div className="relative flex flex-col items-center">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustEndHour(true)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <div className="w-12 h-12 flex items-center justify-center bg-primary/10 dark:bg-primary/20 rounded-xl text-xl font-black text-primary">
                            {(endHour !== null ? endHour : 12).toString().padStart(2, '0')}
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustEndHour(false)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Separator */}
                        <div className="text-xl font-bold">:</div>

                        {/* Minute selector */}
                        <div className="relative flex flex-col items-center">
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustEndMinute(true)}
                          >
                            <ChevronUp className="h-4 w-4" />
                          </button>
                          <div className="w-12 h-12 flex items-center justify-center bg-accent/20 dark:bg-accent/10 rounded-xl text-xl font-black text-foreground opacity-80">
                            {(endMinute !== null ? endMinute : 0).toString().padStart(2, '0')}
                          </div>
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-primary transition-colors p-1"
                            onClick={() => adjustEndMinute(false)}
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex justify-between mt-2 gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => { setEndHour(null); setEndMinute(null); form.setValue('end_time', ''); setShowEndTimePicker(false); }}
                          className="rounded-xl flex-1 h-9 text-xs"
                        >
                          Limpiar
                        </Button>
                        <Button
                          type="button"
                          onClick={updateFormEndTime}
                          className="bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-sm rounded-xl flex-1 h-9 text-xs"
                        >
                          Aceptar
                        </Button>
                      </div>
                    </PopoverContent>
                  </Popover>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />


        </div>

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
                  placeholder={isRequestMode ? "Ingrese la descripción de la solicitud" : "Ingrese la descripción del evento"}
                  className="min-h-[100px]"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl mt-4"
        >
          {getButtonText()}
        </Button>
      </form>
    </Form>
  );
}