
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Pencil, Trash2, MoreVertical, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';
import { DepartmentType, Department, Student } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Form, FormField, FormItem, FormLabel, FormControl, FormDescription, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";

// Definir funciones para actualizar y eliminar estudiantes si no existen en lib/api
const updateStudent = async (id: string, data: any) => {
  const { error } = await supabase
    .from("students")
    .update(data)
    .eq("id", id);
  
  if (error) throw error;
  return { success: true };
};

const deleteStudent = async (id: string) => {
  const { error } = await supabase
    .from("students")
    .delete()
    .eq("id", id);
  
  if (error) throw error;
  return { success: true };
};

const ListarAlumnos = () => {
  const { profile } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  // Configurar formulario con react-hook-form
  const form = useForm({
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      birthdate: "",
      gender: "",
      department: "",
      assigned_class: "",
    }
  });

  // Reset form when student to edit changes
  useEffect(() => {
    if (studentToEdit) {
      console.log("Setting form values for student:", studentToEdit);
      form.reset({
        name: studentToEdit.name,
        phone: studentToEdit.phone || "",
        address: studentToEdit.address || "",
        birthdate: studentToEdit.birthdate || "",
        gender: studentToEdit.gender,
        department: studentToEdit.department || "",
        assigned_class: studentToEdit.assigned_class || "",
      });
    }
  }, [studentToEdit, form]);

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  // Usar departamento y clase del perfil del usuario
  const userDepartment = profile?.departments?.[0] || null;
  const userClass = profile?.assigned_class || null;

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order('name');
      
      if (error) throw error;
      return data as Department[];
    },
  });

  // Obtener estudiantes filtrados por el departamento y clase del usuario
  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["students", userDepartment, userClass],
    queryFn: async () => {
      let query = supabase.from("students").select("*");
      
      // Si el usuario no es admin o secretaria, aplicar filtros
      if (!isAdminOrSecretaria) {
        // Filtrar por departamento del usuario
        if (userDepartment) {
          query = query.eq("department", userDepartment);
          
          // Si el usuario tiene una clase asignada, filtrar también por esa clase
          if (userClass) {
            query = query.eq("assigned_class", userClass);
          }
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).sort((a, b) => a.name.localeCompare(b.name)) as Student[];
    },
    enabled: Boolean(profile), // Solo hacer la consulta cuando tengamos el perfil
  });

  const handleWhatsAppClick = (phone: string) => {
    if (!phone) return;
    
    // Eliminar todos los caracteres que no sean dígitos
    let formattedPhone = phone.replace(/\D/g, "");
    
    // Manejar el formato específico para números argentinos
    // Asegurarse de que el número tenga el formato internacional correcto
    if (formattedPhone.startsWith("11") && formattedPhone.length === 10) {
      // Es un número de Buenos Aires que comienza con 11 (código de área)
      formattedPhone = "549" + formattedPhone;
    } else if (formattedPhone.startsWith("15") && formattedPhone.length === 10) {
      // Es un número celular que comienza con 15
      formattedPhone = "549" + formattedPhone.substring(2);
    } else if (formattedPhone.length === 10) {
      // Otros números argentinos de 10 dígitos
      formattedPhone = "54" + formattedPhone;
    } else if (!formattedPhone.startsWith("54")) {
      // Si no comienza con 54, agregar el prefijo de Argentina
      formattedPhone = "54" + formattedPhone;
    }
    
    // Asegurarse de que los números celulares tengan el 9 después del código de país
    if (formattedPhone.startsWith("54") && !formattedPhone.startsWith("549") && formattedPhone.length >= 10) {
      formattedPhone = "549" + formattedPhone.substring(2);
    }
    
    console.log("Número de WhatsApp formateado:", formattedPhone);
    
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "N/A";
    return `${differenceInYears(new Date(), new Date(birthdate))} años`;
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
      Nombre: student.name,
      Departamento: student.department?.replace(/_/g, ' ') || '',
      Clase: student.assigned_class || '',
      Teléfono: student.phone || '',
      Dirección: student.address || '',
      Género: student.gender,
      'Fecha de Nacimiento': student.birthdate ? format(new Date(student.birthdate), "dd/MM/yyyy") : ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");

    const fileName = `alumnos_${userDepartment || 'todos'}_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  // Función para abrir modal de edición
  const handleEditStudent = (student: Student) => {
    console.log("Editando estudiante:", student);
    setStudentToEdit(student);
    setIsDialogOpen(true);
  };

  // Función para abrir diálogo de confirmación de eliminación
  const handleDeleteStudent = (student: Student) => {
    console.log("Eliminando estudiante:", student);
    setStudentToDelete(student);
    setIsAlertOpen(true);
  };

  // Manejar el envío del formulario de edición
  const onSubmit = async (data: any) => {
    if (!studentToEdit) return;
    
    console.log("Datos a actualizar:", data);
    
    try {
      await updateStudent(studentToEdit.id, data);
      toast({
        title: "Alumno actualizado",
        description: `Los datos de ${data.name} han sido actualizados con éxito.`,
      });
      setIsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      refetch();
    } catch (error) {
      console.error("Error al actualizar alumno:", error);
      toast({
        title: "Error",
        description: "No se pudo actualizar el alumno. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  // Confirmar eliminación de alumno
  const confirmDelete = async () => {
    if (!studentToDelete) return;
    
    try {
      await deleteStudent(studentToDelete.id);
      toast({
        title: "Alumno eliminado",
        description: `${studentToDelete.name} ha sido eliminado con éxito.`,
      });
      setIsAlertOpen(false);
      queryClient.invalidateQueries({ queryKey: ["students"] });
      refetch();
    } catch (error) {
      console.error("Error al eliminar alumno:", error);
      toast({
        title: "Error",
        description: "No se pudo eliminar el alumno. Intente nuevamente.",
        variant: "destructive",
      });
    }
  };

  const renderStudentDetails = (student: any) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 px-4 bg-muted/30 rounded-lg">
      <div className="space-y-2">
        <div className="font-semibold">Información Personal</div>
        <div>
          <span className="font-medium">Nombre:</span>
          <span className="ml-2">{student.name}</span>
        </div>
        <div>
          <span className="font-medium">Género:</span>
          <span className="ml-2 capitalize">{student.gender}</span>
        </div>
        <div>
          <span className="font-medium">Edad:</span>
          <span className="ml-2">{calculateAge(student.birthdate)}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Contacto</div>
        <div>
          <span className="font-medium">Teléfono:</span>
          <span className="ml-2">{student.phone || "No especificado"}</span>
        </div>
        <div>
          <span className="font-medium">Dirección:</span>
          <span className="ml-2">{student.address || "No especificada"}</span>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-semibold">Información Académica</div>
        <div>
          <span className="font-medium">Departamento:</span>
          <span className="ml-2 capitalize">{student.department?.replace(/_/g, ' ') || "No especificado"}</span>
        </div>
        <div>
          <span className="font-medium">Clase:</span>
          <span className="ml-2">{student.assigned_class || "Sin asignar"}</span>
        </div>
        <div>
          <span className="font-medium">Fecha de nacimiento:</span>
          <span className="ml-2">
            {student.birthdate 
              ? format(new Date(student.birthdate), "dd/MM/yyyy") 
              : "No especificada"}
          </span>
        </div>
      </div>
    </div>
  );

  const renderActions = (student: any) => {
    // Acciones para la vista normal (no móvil)
    const actions = (
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={(e) => {
            e.stopPropagation();
            handleWhatsAppClick(student.phone);
          }}
          title="Enviar mensaje de WhatsApp"
        >
          <MessageSquare className="h-4 w-4" />
          {isMobile && <span className="ml-2">WhatsApp</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Editar alumno"
          onClick={(e) => {
            e.stopPropagation();
            handleEditStudent(student);
          }}
        >
          <Pencil className="h-4 w-4" />
          {isMobile && <span className="ml-2">Editar</span>}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          title="Eliminar alumno"
          onClick={(e) => {
            e.stopPropagation();
            handleDeleteStudent(student);
          }}
        >
          <Trash2 className="h-4 w-4" />
          {isMobile && <span className="ml-2">Eliminar</span>}
        </Button>
      </>
    );

    // Vista para dispositivos móviles
    if (isMobile) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" onClick={(e) => e.stopPropagation()}>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              handleWhatsAppClick(student.phone);
            }}>
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              handleEditStudent(student);
            }}>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="text-red-600"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteStudent(student);
              }}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return <div className="flex gap-2">{actions}</div>;
  };

  const renderStudentList = (students: any[], title: string) => (
    <Card className="p-4 md:p-6 mb-6 w-full">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto w-full">
        <Table className="w-full">
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
                <Collapsible
                  key={student.id}
                  open={selectedStudent?.id === student.id}
                  onOpenChange={() => {
                    setSelectedStudent(selectedStudent?.id === student.id ? null : student);
                  }}
                >
                  <TableRow>
                    <TableCell className="p-0 w-full">
                      <div className="grid grid-cols-[1fr,auto,auto] items-center gap-4 p-4 w-full">
                        <div className="min-w-[150px]">
                          <CollapsibleTrigger asChild>
                            <button className="font-medium hover:underline text-left w-full">
                              {student.name}
                            </button>
                          </CollapsibleTrigger>
                        </div>
                        <div className="text-muted-foreground text-right whitespace-nowrap">
                          {calculateAge(student.birthdate)}
                        </div>
                        <div className="flex items-center justify-end gap-2 shrink-0">
                          <span className="text-muted-foreground text-right hidden md:block whitespace-nowrap">
                            {student.phone || "No especificado"}
                          </span>
                          {renderActions(student)}
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                  <CollapsibleContent>
                    <TableRow>
                      <TableCell className="p-0 w-full">
                        {renderStudentDetails(student)}
                      </TableCell>
                    </TableRow>
                  </CollapsibleContent>
                </Collapsible>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6">
                  No hay alumnos para mostrar en esta categoría
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Lista de Alumnos</h2>
        
        {isAdminOrSecretaria && (
          <Button
            variant="outline"
            onClick={handleExport}
            className="w-full md:w-auto"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : (
        <>
          {userDepartment && !isAdminOrSecretaria && (
            <div className="bg-muted/30 p-4 rounded-lg mb-6">
              <p className="text-sm text-muted-foreground">
                Mostrando alumnos de: <span className="font-medium capitalize">{userDepartment.replace(/_/g, ' ')}</span>
                {userClass && (
                  <> - Clase: <span className="font-medium">{userClass}</span></>
                )}
              </p>
            </div>
          )}
          
          {renderStudentList(students.filter(student => student.gender === "masculino"), "Varones")}
          {renderStudentList(students.filter(student => student.gender === "femenino"), "Mujeres")}
        </>
      )}

      {/* Modal de edición de alumno */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Alumno</DialogTitle>
            <DialogDescription>
              Actualiza la información del alumno {studentToEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre completo</Label>
                <Input 
                  id="name"
                  {...form.register("name")}
                  placeholder="Nombre completo"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gender">Género</Label>
                  <Select 
                    defaultValue={form.getValues("gender")}
                    onValueChange={(value) => form.setValue("gender", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="masculino">Masculino</SelectItem>
                      <SelectItem value="femenino">Femenino</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="birthdate">Fecha de nacimiento</Label>
                  <Input 
                    id="birthdate"
                    type="date"
                    {...form.register("birthdate")}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono</Label>
                <Input 
                  id="phone"
                  {...form.register("phone")}
                  placeholder="Teléfono"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input 
                  id="address"
                  {...form.register("address")}
                  placeholder="Dirección"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Select 
                    defaultValue={form.getValues("department")}
                    onValueChange={(value) => form.setValue("department", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {dept.name.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="assigned_class">Clase</Label>
                  <Input 
                    id="assigned_class"
                    {...form.register("assigned_class")}
                    placeholder="Clase"
                  />
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit">Guardar cambios</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente a {studentToDelete?.name} y no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ListarAlumnos;
