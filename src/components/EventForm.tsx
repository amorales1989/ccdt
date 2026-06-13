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
import { DatePickerField } from "./DatePickerField";
import { TimePickerField } from "./TimePickerField";

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

  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);

  // Obtener la fecha actual en formato YYYY-MM-DD en la zona horaria de Argentina
  const today = format(toZonedTime(new Date(), timeZone), 'yyyy-MM-dd');

  const form = useForm<EventFormData>({
    defaultValues: {
      title: initialData?.title || "",
      date: initialData?.date
        ? initialData.date.split('T')[0]
        : "",
      time: initialData?.time || "09:00",
      end_date: initialData?.end_date ? initialData.end_date.split('T')[0] : "",
      end_time: initialData?.end_time || "",
      description: initialData?.description || "",
      departamento: isInitialCustom ? 'otro' : ((initialData as any)?.departamento || ""),
      solicitud: isRequestMode
    }
  });

  const handleSubmit = async (data: EventFormData) => {
    if (!data.title || data.title.trim() === '') {
      form.setError('title', { type: 'manual', message: 'El título es obligatorio' });
      return;
    }

    if (isRequestMode && isCustomDepartment && !customDepartmentValue.trim()) {
      return; // No enviar si el departamento personalizado está vacío
    }

    setIsSubmitting(true);
    try {
      // La fecha ya viene en formato YYYY-MM-DD desde el input
      const dateStr = data.date;

      // Determinar el departamento final a enviar
      const finalDepartment = isRequestMode && isCustomDepartment ? customDepartmentValue : data.departamento;

      const formattedData = {
        ...data,
        date: dateStr,
        end_date: data.end_date || null,
        end_time: data.end_time || null,
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
          rules={{
            required: "El título es obligatorio",
            validate: value => value?.trim() !== '' || "El título no puede estar vacío"
          }}
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
              rules={{ required: "El departamento es obligatorio" }}
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
            rules={{ required: "La fecha de inicio es obligatoria" }}
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Fecha Inicio</FormLabel>
                <FormControl>
                  <DatePickerField
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
                  <DatePickerField
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
          <FormField
            control={form.control}
            name="time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora Inicio</FormLabel>
                <FormControl>
                  <TimePickerField
                    label=""
                    value={field.value || "09:00"}
                    onChange={(v) => field.onChange(v)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="end_time"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Hora Fin (Opción)</FormLabel>
                <FormControl>
                  <TimePickerField
                    label=""
                    value={field.value || ""}
                    onChange={(v) => field.onChange(v)}
                    clearable
                    onClear={() => field.onChange("")}
                  />
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
                  maxLength={150}
                  placeholder={isRequestMode ? "Ingrese la descripción de la solicitud" : "Ingrese la descripción del evento"}
                  className="min-h-[100px] resize-none"
                />
              </FormControl>
              <div className="text-xs text-muted-foreground text-right">
                {(field.value?.length || 0)}/150
              </div>
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