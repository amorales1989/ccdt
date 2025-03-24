
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { getDepartments, createNotification } from '@/lib/api';
import { Department } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

const formSchema = z.object({
  title: z.string().min(1, 'El título es requerido'),
  content: z.string().min(1, 'El contenido es requerido'),
  department_id: z.string().optional(),
  assigned_class: z.string().optional(),
  send_to_all: z.boolean().default(false),
});

type FormValues = z.infer<typeof formSchema>;

const CrearNotificacion = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      content: '',
      department_id: '',
      assigned_class: '',
      send_to_all: false,
    },
  });

  // Check if user has permission to create notifications
  useEffect(() => {
    if (profile && profile.role !== 'admin' && profile.role !== 'secretaria') {
      navigate('/');
    }
  }, [profile, navigate]);

  // Fetch departments
  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const data = await getDepartments();
        setDepartments(data);
      } catch (error) {
        console.error('Error fetching departments:', error);
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los departamentos',
          variant: 'destructive',
        });
      }
    };

    fetchDepartments();
  }, [toast]);

  // Update available classes when department changes
  const watchDepartmentId = form.watch('department_id');
  
  useEffect(() => {
    if (!watchDepartmentId) {
      setAvailableClasses([]);
      return;
    }
    
    const selectedDepartment = departments.find(d => d.id === watchDepartmentId);
    if (selectedDepartment && selectedDepartment.classes) {
      setAvailableClasses(selectedDepartment.classes);
      
      // Reset class selection when department changes
      form.setValue('assigned_class', '');
    } else {
      setAvailableClasses([]);
    }
  }, [watchDepartmentId, departments, form]);

  // Handle send to all changes
  const watchSendToAll = form.watch('send_to_all');
  
  useEffect(() => {
    if (watchSendToAll) {
      form.setValue('department_id', '');
      form.setValue('assigned_class', '');
    }
  }, [watchSendToAll, form]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    
    try {
      setIsSubmitting(true);
      
      // Validate that we have either send_to_all or a department selected
      if (!values.send_to_all && !values.department_id) {
        toast({
          title: 'Error',
          description: 'Debe seleccionar un departamento o marcar como "Enviar a todos"',
          variant: 'destructive',
        });
        return;
      }
      
      await createNotification({
        title: values.title,
        content: values.content,
        department_id: values.department_id || undefined,
        assigned_class: values.assigned_class || undefined,
        send_to_all: values.send_to_all,
      });
      
      toast({
        title: 'Notificación creada',
        description: 'La notificación ha sido creada exitosamente',
      });
      
      navigate('/notificaciones');
    } catch (error) {
      console.error('Error creating notification:', error);
      toast({
        title: 'Error',
        description: 'No se pudo crear la notificación',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Crear Notificación</CardTitle>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl>
                      <Input placeholder="Título de la notificación" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contenido</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Contenido de la notificación" 
                        className="min-h-32" 
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="send_to_all"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Enviar a todos</FormLabel>
                      <FormMessage />
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              {!watchSendToAll && (
                <>
                  <FormField
                    control={form.control}
                    name="department_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <Select
                          disabled={watchSendToAll}
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Seleccionar departamento" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((department) => (
                              <SelectItem key={department.id} value={department.id}>
                                {department.name?.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  {watchDepartmentId && availableClasses.length > 0 && (
                    <FormField
                      control={form.control}
                      name="assigned_class"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clase</FormLabel>
                          <Select
                            disabled={watchSendToAll || !watchDepartmentId}
                            onValueChange={field.onChange}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccionar clase (opcional)" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableClasses.map((className) => (
                                <SelectItem key={className} value={className}>
                                  {className}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-between">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/notificaciones')}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Enviando...' : 'Crear Notificación'}
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
};

export default CrearNotificacion;
