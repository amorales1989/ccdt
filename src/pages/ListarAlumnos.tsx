import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pencil, Trash2, MoreVertical, Filter, Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears, parse, isValid } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';
import { Department, Student } from "@/types/database";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useForm } from "react-hook-form";
import { toast } from "@/hooks/use-toast";
import { StudentDetails } from "@/components/StudentDetails";
import { Badge } from "@/components/ui/badge";
import { importStudentsFromExcel } from "@/lib/api";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useNavigate } from "react-router-dom";

const updateStudent = async (id: string, data: any) => {
  if (data.authorization_id !== undefined) {
    delete data.authorization_id;
  }

  if (data.date_of_birth !== undefined) {
    data.birthdate = data.date_of_birth;
    delete data.date_of_birth;
  }
  
  console.log("Updating student with data:", data);
  
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
  const [importModalState, setImportModalState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [importResults, setImportResults] = useState<{
    failed: number;
    successful: number;
    errors: string[];
  }>({
    failed: 0,
    successful: 0,
    errors: []
  });
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [studentToDelete, setStudentToDelete] = useState<string | null>(null);
  const [studentToEdit, setStudentToEdit] = useState<Student | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [studentsToPromote, setStudentsToPromote] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    department: '',
    ageFrom: '',
    ageTo: '',
  });

  const { user } = useAuth();
  const isMobile = useIsMobile();
  const profile = useAuth().profile;
  const canFilter = profile?.role === 'secretaria' || profile?.role === 'admin';
  const canManageStudents = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'lider' || profile?.role === 'maestro';

  const navigate = useNavigate();

  const { data: students, isLoading, isError, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          departments (name)
        `)
        .order('first_name');

      if (error) {
        console.error("Error fetching students:", error);
        throw error;
      }

      if (profile?.role !== 'secretaria' && profile?.role !== 'admin') {
        return data?.filter(student => student.department_id === profile?.department_id && student.assigned_class === profile?.assigned_class) || [];
      }

      return data;
    },
  });

  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("departments").select("*");
      if (error) {
        console.error("Error fetching departments:", error);
        return [];
      }
      return data || [];
    },
  });

  const { data: authorizations } = useQuery({
    queryKey: ["authorizations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("student_authorizations").select("*");
      if (error) {
        console.error("Error fetching authorizations:", error);
        return [];
      }
      return data || [];
    },
  });

  const form = useForm({
    defaultValues: {
      first_name: "",
      last_name: "",
      gender: "masculino",
      date_of_birth: new Date(),
      address: "",
      phone_number: "",
      email: "",
      document_type: "DNI",
      document_number: "",
      emergency_contact_name: "",
      emergency_contact_phone: "",
      medical_information: "",
      department_id: "",
    },
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());

    if (!isValid(parsedDate)) {
      return null;
    }

    return differenceInYears(new Date(), parsedDate);
  };

  const handleEdit = (student: Student) => {
    setStudentToEdit(student);
    form.reset({
      first_name: student.first_name,
      last_name: student.last_name,
      gender: student.gender,
      date_of_birth: new Date(student.birthdate || student.date_of_birth || new Date()),
      address: student.address || "",
      phone_number: student.phone || student.phone_number || "",
      email: student.email || "",
      document_type: student.document_type || "DNI",
      document_number: student.document_number || "",
      emergency_contact_name: student.emergency_contact_name || "",
      emergency_contact_phone: student.emergency_contact_phone || "",
      medical_information: student.medical_information || "",
      department_id: student.department_id || "",
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = async (values: any) => {
    if (!studentToEdit) return;
    try {
      const formattedValues = {
        ...values,
        date_of_birth: format(values.date_of_birth, "yyyy-MM-dd")
      };
      
      console.log("Submitting form values:", formattedValues);
      
      await updateStudent(studentToEdit.id, formattedValues);
      toast({
        title: "Alumno actualizado",
        description: "El alumno ha sido actualizado correctamente.",
        variant: "success",
      });
      setIsEditModalOpen(false);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error al actualizar",
        description: error.message || "Hubo un error al actualizar el alumno.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = (id: string) => {
    setStudentToDelete(id);
    setDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (!studentToDelete) return;
    try {
      await deleteStudent(studentToDelete);
      toast({
        title: "Alumno eliminado",
        description: "El alumno ha sido eliminado correctamente.",
        variant: "success",
      });
      setDeleteAlertOpen(false);
      setStudentToDelete(null);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "Hubo un error al eliminar el alumno.",
        variant: "destructive",
      });
    }
  };

  const handlePromote = (studentId: string) => {
    setStudentsToPromote(prev => {
      if (prev.includes(studentId)) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handlePromoteAll = () => {
    if (!students) return;
    const allStudentIds = students.map(student => student.id);
    if (studentsToPromote.length === allStudentIds.length) {
      setStudentsToPromote([]);
    } else {
      setStudentsToPromote(allStudentIds);
    }
  };

  const promoteStudents = async () => {
    if (studentsToPromote.length === 0 || !selectedDepartment) {
      toast({
        title: "Error",
        description: "Por favor, seleccione al menos un alumno y un curso.",
        variant: "destructive",
      });
      return;
    }

    setIsPromoting(true);
    try {
      for (const studentId of studentsToPromote) {
        await updateStudent(studentId, { department_id: selectedDepartment });
      }
      toast({
        title: "Alumnos promovidos",
        description: "Los alumnos han sido promovidos correctamente.",
        variant: "success",
      });
      setIsPromoteModalOpen(false);
      setStudentsToPromote([]);
      setSelectedDepartment(null);
      refetch();
    } catch (error: any) {
      toast({
        title: "Error al promover",
        description: error.message || "Hubo un error al promover los alumnos.",
        variant: "destructive",
      });
    } finally {
      setIsPromoting(false);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setExcelError(null);
    const file = event.target.files?.[0];
    if (!file) {
      setExcelError("Por favor, seleccione un archivo.");
      return;
    }

    if (!file.name.endsWith('.xlsx')) {
      setExcelError("Por favor, seleccione un archivo .xlsx.");
      return;
    }

    setExcelFile(file);
  };

  const handleImport = async () => {
    if (!excelFile) {
      setExcelError("Por favor, seleccione un archivo.");
      return;
    }

    setImportModalState("loading");
    setExcelError(null);

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      const binaryStr = e.target.result;
      const wb = XLSX.read(binaryStr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws);

      try {
        const result = await importStudentsFromExcel(data as any[]);
        handleImportResult(result);
      } catch (error: any) {
        setImportModalState("error");
        setImportResults({
          failed: data.length,
          successful: 0,
          errors: [error.message || "Error desconocido al importar desde Excel."]
        });
        toast({
          title: "Error al importar",
          description: error.message || "Hubo un error al importar desde Excel.",
          variant: "destructive",
        });
        console.error("Error importing students from Excel:", error);
      } finally {
        setImportModalState("idle");
        setIsImportModalOpen(false);
        setExcelFile(null);
      }
    };
    reader.onerror = (error) => {
      setImportModalState("error");
      setExcelError("Error al leer el archivo.");
      console.error("Error reading file:", error);
      setIsImportModalOpen(false);
      setExcelFile(null);
    };
    reader.readAsBinaryString(excelFile);
  };

  const filteredStudents = students?.filter(student => {
    if (profile?.role === 'admin' || profile?.role === 'secretaria') {
      const nameFilter = filters.name.toLowerCase();
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const departmentFilter = filters.department;
      const age = calculateAge(student.birthdate);

      const nameMatch = fullName.includes(nameFilter);
      const departmentMatch = departmentFilter ? student.departments?.name === departmentFilter : true;
      const ageFromMatch = filters.ageFrom ? (age !== null && age >= parseInt(filters.ageFrom)) : true;
      const ageToMatch = filters.ageTo ? (age !== null && age <= parseInt(filters.ageTo)) : true;

      return nameMatch && departmentMatch && ageFromMatch && ageToMatch;
    } else {
      const nameFilter = filters.name.toLowerCase();
      const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
      const age = calculateAge(student.birthdate);

      const nameMatch = fullName.includes(nameFilter);
      const ageFromMatch = filters.ageFrom ? (age !== null && age >= parseInt(filters.ageFrom)) : true;
      const ageToMatch = filters.ageTo ? (age !== null && age <= parseInt(filters.ageTo)) : true;

      const departmentMatch = student.department_id === profile?.department_id;
      const classMatch = student.assigned_class === profile?.assigned_class;

      return nameMatch && departmentMatch && classMatch && ageFromMatch && ageToMatch;
    }
  });

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleClearFilters = () => {
    setFilters({
      name: '',
      department: '',
      ageFrom: '',
      ageTo: '',
    });
  };

  const handleImportResult = (result: any) => {
    if (result) {
      setImportModalState("success");
      setImportResults({
        failed: result.failed || 0,
        successful: result.successful || 0,
        errors: result.errors || []
      });

      toast({
        title: "Importación completada",
        description: `${result.successful || 0} alumnos importados correctamente. ${result.failed || 0} alumnos fallaron.`,
        variant: "success",
      });

      if (result.errors && result.errors.length > 0) {
        console.error("Errores de importación:", result.errors);
      }

      queryClient.invalidateQueries({ queryKey: ["students"] });
    }
  };

  const handleStudentClick = (studentId: string) => {
    setExpandedStudentId(expandedStudentId === studentId ? null : studentId);
  };

  const handleWhatsAppClick = (phoneNumber: string | null) => {
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "El alumno no tiene un número de teléfono registrado.",
        variant: "destructive",
      });
      return;
    }

    const cleanedNumber = phoneNumber.replace(/\D/g, '').replace(/^0+/, '');
    const whatsappNumber = cleanedNumber.startsWith('54') 
      ? `+${cleanedNumber}` 
      : `+54${cleanedNumber}`;

    const whatsappUrl = `https://wa.me/${whatsappNumber}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Listado de Alumnos</h2>
          <div className="flex items-center space-x-2">
            {canFilter && (
              <Button variant="outline" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                <Filter className="mr-2 h-4 w-4" />
                Filtrar
              </Button>
            )}
            {(profile?.role === 'admin' || profile?.role === 'secretaria') && (
              <Button onClick={() => setIsImportModalOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                Importar
              </Button>
            )}
            <Button onClick={() => navigate('/agregar')}>
              Agregar Alumno
            </Button>
          </div>
        </div>

        {canFilter && (
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start">
                Filtros <Filter className="ml-2 h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
              <div>
                <Label htmlFor="name">Nombre</Label>
                <Input
                  type="text"
                  id="name"
                  name="name"
                  value={filters.name}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <Label htmlFor="department">Curso</Label>
                <Select onValueChange={(value) => setFilters(prev => ({ ...prev, department: value }))} defaultValue={filters.department}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Todos</SelectItem>
                    {departments?.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ageFrom">Edad Desde</Label>
                <Input
                  type="number"
                  id="ageFrom"
                  name="ageFrom"
                  value={filters.ageFrom}
                  onChange={handleFilterChange}
                />
              </div>
              <div>
                <Label htmlFor="ageTo">Edad Hasta</Label>
                <Input
                  type="number"
                  id="ageTo"
                  name="ageTo"
                  value={filters.ageTo}
                  onChange={handleFilterChange}
                />
              </div>
              <div className="md:col-span-4 flex justify-end">
                <Button variant="secondary" size="sm" onClick={handleClearFilters}>
                  Limpiar Filtros
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}

        <div className="overflow-x-auto mt-4">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="font-medium">Nombre</TableCell>
                {!isMobile && (
                  <TableCell className="font-medium">Curso</TableCell>
                )}
                <TableCell className="font-medium">Edad</TableCell>
                <TableCell className="relative w-[80px]"></TableCell>
              </TableRow>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    Error al cargar los alumnos.
                  </TableCell>
                </TableRow>
              ) : filteredStudents?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No hay alumnos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents?.map((student) => (
                  <React.Fragment key={student.id}>
                    <TableRow className="cursor-pointer hover:bg-gray-50" onClick={() => handleStudentClick(student.id)}>
                      <TableCell className="font-medium">{student.first_name} {student.last_name}</TableCell>
                      {!isMobile && (
                        <TableCell>{student.departments?.name || 'Sin curso'}</TableCell>
                      )}
                      <TableCell>{calculateAge(student.birthdate) || 'Desconocida'}</TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canManageStudents && (
                              <>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(student); }}>
                                  <Pencil className="mr-2 h-4 w-4" /> Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}>
                                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(student.phone); }}>
                              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                              </svg>
                              WhatsApp
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                    {expandedStudentId === student.id && (
                      <TableRow>
                        <TableCell colSpan={4} className="bg-gray-50">
                          <StudentDetails student={student} />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isPromoteModalOpen} onOpenChange={setIsPromoteModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Promover Alumnos</DialogTitle>
              <DialogDescription>
                Seleccione el curso al que desea promover los alumnos seleccionados.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="department" className="text-right">
                  Curso
                </Label>
                <Select onValueChange={setSelectedDepartment} defaultValue={selectedDepartment ?? ""}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccione un curso" />
                  </SelectTrigger>
                  <SelectContent>
                    {departments?.map((department) => (
                      <SelectItem key={department.id} value={department.id}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <div></div>
                <Button variant="outline" onClick={handlePromoteAll} className="col-span-3 justify-start">
                  {studentsToPromote.length === (students?.length || 0) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                </Button>
              </div>
              <div>
                {studentsToPromote.length > 0 && (
                  <div>
                    Alumnos a promover:
                    <div className="mt-2">
                      {studentsToPromote.map(studentId => {
                        const student = students?.find(s => s.id === studentId);
                        return (
                          student && (
                            <Badge key={student.id} className="mr-2">{student.first_name} {student.last_name}</Badge>
                          )
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsPromoteModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" onClick={promoteStudents} disabled={isPromoting}>
                {isPromoting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Promover
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Importar Alumnos desde Excel</DialogTitle>
              <DialogDescription>
                Seleccione un archivo .xlsx para importar los alumnos.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="excelFile" className="text-right">
                  Archivo Excel
                </Label>
                <Input
                  type="file"
                  id="excelFile"
                  accept=".xlsx"
                  onChange={handleFileChange}
                  className="col-span-3"
                />
              </div>
              {excelError && (
                <div className="text-red-500 col-span-4">{excelError}</div>
              )}
              {importModalState === "success" && importResults.errors.length > 0 && (
                <div>
                  Errores:
                  <ul>
                    {importResults.errors.map((error, index) => (
                      <li key={index} className="text-red-500">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsImportModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" onClick={handleImport} disabled={importModalState === "loading" || !excelFile}>
                {importModalState === "loading" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Importar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Editar Alumno</DialogTitle>
              <DialogDescription>
                Realice los cambios necesarios en la información del alumno.
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleUpdate)} className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="first_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl>
                        <Input placeholder="Nombre" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="last_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Apellido</FormLabel>
                      <FormControl>
                        <Input placeholder="Apellido" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Género</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione el género" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="masculino">Masculino</SelectItem>
                          <SelectItem value="femenino">Femenino</SelectItem>
                          <SelectItem value="otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="date_of_birth"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Nacimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={format(field.value, "yyyy-MM-dd")}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="document_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipo de Documento</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione el tipo de documento" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="DNI">DNI</SelectItem>
                          <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                          <SelectItem value="Otro">Otro</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="document_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número de Documento</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Número de documento" 
                          {...field} 
                          onChange={(e) => {
                            const value = e.target.value.replace(/\D/g, '');
                            field.onChange(value);
                          }}
                          inputMode="numeric"
                          pattern="[0-9]*"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Teléfono</FormLabel>
                      <FormControl>
                        <Input placeholder="Teléfono" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input placeholder="Email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Input placeholder="Dirección" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Curso</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                        disabled={profile?.role === 'maestro'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un curso" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments?.map((department) => (
                            <SelectItem key={department.id} value={department.id}>
                              {department.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit">Guardar</Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará al alumno de forma permanente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
};

export default ListarAlumnos;
