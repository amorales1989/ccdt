
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Pencil, Trash2, MoreVertical, Download, Filter } from "lucide-react";
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
  const [phoneCode, setPhoneCode] = useState("54");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | "">("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [editDepartment, setEditDepartment] = useState<DepartmentType | "">("");
  const [editDepartmentId, setEditDepartmentId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();

  type StudentFormData = {
    name: string;
    phone: string;
    address: string;
    birthdate: string;
    gender: "masculino" | "femenino";
    department: DepartmentType | "";
    assigned_class: string;
  };

  const form = useForm<StudentFormData>({
    defaultValues: {
      name: "",
      phone: "",
      address: "",
      birthdate: "",
      gender: "masculino",
      department: "",
      assigned_class: "",
    }
  });

  useEffect(() => {
    if (studentToEdit) {
      console.log("Setting form values for student:", studentToEdit);
      
      let extractedPhoneCode = "54";
      let extractedPhoneNumber = "";
      
      if (studentToEdit.phone) {
        if (studentToEdit.phone.startsWith("54")) {
          extractedPhoneCode = studentToEdit.phone.substring(0, 2);
          
          if (studentToEdit.phone.startsWith("549") && studentToEdit.phone.length >= 12) {
            extractedPhoneNumber = studentToEdit.phone.substring(3);
          } else {
            extractedPhoneNumber = studentToEdit.phone.substring(2);
          }
        } else {
          extractedPhoneNumber = studentToEdit.phone;
        }
      }
      
      setPhoneCode(extractedPhoneCode);
      setPhoneNumber(extractedPhoneNumber);
      
      const validGender = studentToEdit.gender === "femenino" ? "femenino" : "masculino";
      
      const departmentValue = studentToEdit.department || "" as DepartmentType | "";
      
      setEditDepartment(departmentValue);
      
      form.reset({
        name: studentToEdit.name,
        phone: "",
        address: studentToEdit.address || "",
        birthdate: studentToEdit.birthdate || "",
        gender: validGender,
        department: departmentValue,
        assigned_class: studentToEdit.assigned_class || "",
      });
    }
  }, [studentToEdit, form]);

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  const userDepartment = profile?.departments?.[0] || null;
  const userClass = profile?.assigned_class || null;

  useEffect(() => {
    if (!isAdminOrSecretaria && userDepartment) {
      setSelectedDepartment(userDepartment);
      
      const fetchDepartmentId = async () => {
        try {
          const { data, error } = await supabase
            .from("departments")
            .select("id")
            .eq("name", userDepartment)
            .single();
          
          if (error) {
            console.error("Error fetching department ID:", error);
            return;
          }
          
          if (data) {
            console.log("Found department ID:", data.id, "for department:", userDepartment);
            setSelectedDepartmentId(data.id);
          }
        } catch (error) {
          console.error("Error in fetchDepartmentId:", error);
        }
      };
      
      fetchDepartmentId();
      
      if (userClass) {
        setSelectedClass(userClass);
      }
    }
  }, [isAdminOrSecretaria, userDepartment, userClass]);

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

  const availableClasses = selectedDepartment 
    ? departments.find(d => d.name === selectedDepartment)?.classes || []
    : [];

  const editAvailableClasses = editDepartment 
    ? departments.find(d => d.name === editDepartment)?.classes || []
    : [];

  const editDepartmentHasClasses = editAvailableClasses.length > 0;

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["students", selectedDepartmentId, selectedClass],
    queryFn: async () => {
      if (isAdminOrSecretaria && !selectedDepartmentId) {
        return [];
      }

      let query = supabase.from("students").select("*, departments:department_id(name, id)");
      
      if (selectedDepartmentId) {
        query = query.eq("department_id", selectedDepartmentId);
        
        if (selectedClass) {
          query = query.eq("assigned_class", selectedClass);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      console.log("Fetched students:", data);
      
      const processedData = (data || [])
        .map(student => ({
          ...student,
          department: student.departments?.name
        }))
        .sort((a, b) => a.name.localeCompare(b.name)) as Student[];
      
      return processedData;
    },
    enabled: Boolean(profile) && (!isAdminOrSecretaria || Boolean(selectedDepartmentId)),
  });

  const formatPhoneNumber = (phoneCode: string, phoneNumber: string) => {
    if (!phoneNumber) return null;

    let cleanNumber = phoneNumber.replace(/\D/g, "");
    
    if (cleanNumber.startsWith("0")) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    if (cleanNumber.startsWith("15")) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    if (phoneCode === "54") {
      return phoneCode + "9" + cleanNumber;
    }
    
    return phoneCode + cleanNumber;
  };

  const formatPhoneDisplay = (phone: string | null) => {
    if (!phone) return "No especificado";
    
    if (phone.startsWith("549")) {
      return phone.substring(3);
    }
    else if (phone.startsWith("54")) {
      return phone.substring(2);
    }
    
    return phone;
  };

  const handleWhatsAppClick = (phone: string) => {
    if (!phone) return;
    
    let cleanNumber = phone.replace(/\D/g, "");
    
    let hasCountryCode = false;
    if (cleanNumber.startsWith("54")) {
      cleanNumber = cleanNumber.substring(2);
      hasCountryCode = true;
    }
    
    if (cleanNumber.startsWith("0")) {
      cleanNumber = cleanNumber.substring(1);
    }
    
    if (cleanNumber.startsWith("15")) {
      cleanNumber = cleanNumber.substring(2);
    }
    
    if (cleanNumber.length < 10) {
      console.error("Número de teléfono incompleto:", phone);
      toast({
        title: "Error",
        description: "El número de teléfono parece estar incompleto.",
        variant: "destructive",
      });
      return;
    }
    
    if (cleanNumber.length > 10) {
      cleanNumber = cleanNumber.substring(cleanNumber.length - 10);
    }
    
    const formattedPhone = "549" + cleanNumber;
    
    console.log("Número de WhatsApp formateado:", formattedPhone);
    
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "N/A";
    return `${differenceInYears(new Date(), new Date(birthdate))} años`;
  };

  const handleExport = () => {
    const fileName = `alumnos_${selectedDepartment || 'todos'}_${selectedClass || 'todas-clases'}_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    
    const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
      Nombre: student.name,
      Departamento: student.department?.replace(/_/g, ' ') || '',
      Clase: student.assigned_class || '',
      Teléfono: formatPhoneDisplay(student.phone) || '',
      Dirección: student.address || '',
      Género: student.gender,
      'Fecha de Nacimiento': student.birthdate ? format(new Date(student.birthdate), "dd/MM/yyyy") : ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");
    XLSX.writeFile(workbook, fileName);
  };

  const handleDepartmentChange = async (value: string) => {
    const departmentName = value as DepartmentType;
    setSelectedDepartment(departmentName);
    
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id")
        .eq("name", departmentName)
        .single();
      
      if (error) {
        console.error("Error fetching department ID:", error);
        return;
      }
      
      if (data) {
        console.log("Found department ID:", data.id, "for department:", departmentName);
        setSelectedDepartmentId(data.id);
      }
    } catch (error) {
      console.error("Error in handleDepartmentChange:", error);
    }
    
    setSelectedClass(null);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
  };

  const handleEditDepartmentChange = async (value: string) => {
    const departmentName = value as DepartmentType;
    setEditDepartment(departmentName);
    
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id")
        .eq("name", departmentName)
        .single();
      
      if (error) {
        console.error("Error fetching department ID for edit:", error);
        return;
      }
      
      if (data) {
        console.log("Found department ID for edit:", data.id, "for department:", departmentName);
        setEditDepartmentId(data.id);
      }
    } catch (error) {
      console.error("Error in handleEditDepartmentChange:", error);
    }
    
    form.setValue("assigned_class", "");
  };

  const handleEditStudent = (student: Student) => {
    console.log("Editando estudiante:", student);
    setStudentToEdit(student);
    setIsDialogOpen(true);
  };

  const handleDeleteStudent = (student: Student) => {
    console.log("Eliminando estudiante:", student);
    setStudentToDelete(student);
    setIsAlertOpen(true);
  };

  const onSubmit = async (data: StudentFormData) => {
    if (!studentToEdit) return;
    
    const formattedPhone = formatPhoneNumber(phoneCode, phoneNumber);
    
    const updatedData = {
      ...data,
      phone: formattedPhone,
      department: data.department as DepartmentType,
      department_id: editDepartmentId,
      assigned_class: data.assigned_class || null
    };
    
    console.log("Datos a actualizar:", updatedData);
    
    try {
      await updateStudent(studentToEdit.id, updatedData);
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
          <span className="ml-2">{formatPhoneDisplay(student.phone)}</span>
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
                      <div className="grid grid-cols-[200px_1fr_1fr_1fr] gap-4 p-4 w-full">
                        <div className="flex items-center">
                          <CollapsibleTrigger asChild>
                            <button className="font-medium hover:underline text-left w-full truncate">
                              {student.name}
                            </button>
                          </CollapsibleTrigger>
                        </div>
  
                        <div className="flex items-center justify-center">
                          {calculateAge(student.birthdate)}
                        </div>
  
                        <div className="flex items-center justify-end">
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
                <TableCell colSpan={4} className="text-center py-6">
                  No hay alumnos para mostrar en esta categoría
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  const renderFilters = () => {
    if (!isAdminOrSecretaria) return null;

    return (
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="department-filter">Departamento</Label>
            <Select
              value={selectedDepartment}
              onValueChange={handleDepartmentChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un departamento" />
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

          {selectedDepartment && availableClasses.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="class-filter">Clase</Label>
              <Select
                value={selectedClass || undefined}
                onValueChange={handleClassChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las clases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las clases</SelectItem>
                  {availableClasses.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Lista de Alumnos</h2>
        
        {isAdminOrSecretaria && students.length > 0 && (
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

      {renderFilters()}

      {isLoading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : (
        <>
          {isAdminOrSecretaria && !selectedDepartment ? (
            <Card className="p-6 text-center">
              <Filter className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecciona un departamento</h3>
              <p className="text-muted-foreground">
                Por favor, selecciona un departamento para ver los alumnos.
              </p>
            </Card>
          ) : (
            <>
              {!isAdminOrSecretaria && userDepartment && (
                <div className="bg-muted/30 p-4 rounded-lg mb-6">
                  <p className="text-sm text-muted-foreground">
                    Mostrando alumnos de: <span className="font-medium capitalize">{userDepartment.replace(/_/g, ' ')}</span>
                    {userClass && (
                      <> - Clase: <span className="font-medium">{userClass}</span></>
                    )}
                  </p>
                </div>
              )}
              
              {isAdminOrSecretaria && selectedDepartment && (
                <div className="bg-muted/30 p-4 rounded-lg mb-6">
                  <p className="text-sm text-muted-foreground">
                    Mostrando alumnos de: <span className="font-medium capitalize">{selectedDepartment.replace(/_/g, ' ')}</span>
                    {selectedClass && (
                      <> - Clase: <span className="font-medium">{selectedClass}</span></>
                    )}
                  </p>
                </div>
              )}
              
              {renderStudentList(students.filter(student => student.gender === "masculino"), "Varones")}
              {renderStudentList(students.filter(student => student.gender === "femenino"), "Mujeres")}
            </>
          )}
        </>
      )}

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
                    onValueChange={(value: "masculino" | "femenino") => form.setValue("gender", value)}
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
                <div className="grid grid-cols-[100px_1fr] gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-500">+</span>
                    <Input
                      id="phoneCode"
                      value={phoneCode}
                      onChange={(e) => setPhoneCode(e.target.value)}
                      placeholder="54"
                    />
                  </div>
                  <Input
                    id="phoneNumber"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Sin 0 ni 15 al inicio, ej: 1159080306"
                  />
                </div>
                <span className="text-xs text-muted-foreground">No incluir el 0 ni el 15 al inicio del número. Ejemplo correcto: 1159080306</span>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">Dirección</Label>
                <Input 
                  id="address"
                  {...form.register("address")}
                  placeholder="Dirección"
                />
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="department">Departamento</Label>
                  <Select 
                    value={form.getValues("department")}
                    onValueChange={(value) => {
                      form.setValue("department", value as DepartmentType);
                      handleEditDepartmentChange(value);
                    }}
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
                
                {editDepartmentHasClasses && (
                  <div className="space-y-2">
                    <Label htmlFor="assigned_class">Clase</Label>
                    <Select
                      value={form.getValues("assigned_class") || undefined}
                      onValueChange={(value) => {
                        form.setValue("assigned_class", value);
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar clase" />
                      </SelectTrigger>
                      <SelectContent>
                        {editAvailableClasses.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
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
