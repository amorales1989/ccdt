import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pencil, Trash2, MoreVertical, Filter, Upload, Loader2, FileDown, UserPlus, CircleChevronDown, CircleChevronUp, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears, parse, isValid, parseISO } from "date-fns";
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
import { importStudentsFromExcel, updateStudent, getStudents, deleteStudent, getDepartments } from "@/lib/api";
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
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import * as z from "zod";

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
    class: '',
  });

  const { user } = useAuth();
  const isMobile = useIsMobile();
  const profile = useAuth().profile;
  const canFilter = profile?.role === 'secretaria' || profile?.role === 'admin';
  const canManageStudents = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'lider' || profile?.role === 'maestro';

  const navigate = useNavigate();

  // ============ CONSULTA PRINCIPAL DE ESTUDIANTES USANDO BACKEND API ============
  const { data: allStudents, isLoading, isError, refetch } = useQuery({
    queryKey: ["students"],
    queryFn: getStudents,
  });

  // Filtrar estudiantes según el rol y permisos del usuario
  const students = React.useMemo(() => {
    if (!allStudents?.length) return [];

    let filteredStudents = allStudents;

    // Si es admin o secretaria, mostrar todos los estudiantes
    if (profile?.role === 'secretaria' || profile?.role === 'admin') {
      return filteredStudents.map(student => ({
        ...student,
        department: student.departments?.name || student.department
      }));
    }

    // Para otros roles, filtrar por departamento y clase
    if (profile?.department_id && profile?.assigned_class) {
      filteredStudents = allStudents.filter(student =>
        student.department_id === profile.department_id &&
        student.assigned_class === profile.assigned_class
      );
    }

    // TODO: Aquí puedes agregar lógica para estudiantes autorizados de otros departamentos
    // cuando implementes ese endpoint en tu backend

    return filteredStudents.map(student => ({
      ...student,
      department: student.departments?.name || student.department
    }));
  }, [allStudents, profile]);

  // ============ CONSULTA DE DEPARTAMENTOS USANDO BACKEND API ============
  const { data: departments } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  // ============ CONSULTA DE AUTORIZACIONES - MANTENER SUPABASE POR AHORA ============
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

  // ============ CONSULTA DE CLASES - USAR STUDENTS DEL BACKEND ============
  const { data: classes } = useQuery({
    queryKey: ["classes", filters.department],
    queryFn: async () => {
      if (!allStudents) return [];

      let studentsToAnalyze = allStudents;

      // Si hay un departamento seleccionado, filtrar por ese departamento
      if (filters.department) {
        studentsToAnalyze = allStudents.filter(student =>
          student.departments?.name === filters.department ||
          student.department === filters.department
        );
      }

      // Obtener clases únicas y filtrar valores nulos/vacíos
      const uniqueClasses = [...new Set(
        studentsToAnalyze
          .map(student => student.assigned_class)
          .filter(Boolean)
      )];

      return uniqueClasses.sort();
    },
    enabled: !!allStudents,
  });

  useEffect(() => {
    // Siempre limpiar la clase cuando cambie el departamento
    setFilters(prev => ({ ...prev, class: '' }));
  }, [filters.department]);

  const formSchema = z.object({
  first_name: z.string().min(1, "El nombre es requerido"),
  last_name: z.string().optional(),
  gender: z.string(),
  birthdate: z.any().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  document_number: z.string().optional(),
  department_id: z.string().optional(),
});

// ========== ACTUALIZAR DEFAULT VALUES (línea ~124) ==========
const form = useForm({
  defaultValues: {
    first_name: "",
    last_name: "",
    gender: "masculino",
    birthdate: "",
    address: "",
    phone: "",
    document_number: ""
  },
  resolver: zodResolver(formSchema),
});

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!profile) {
      navigate('/');
    }
  }, [profile, navigate]);

  const calculateAge = (dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());

    if (!isValid(parsedDate)) {
      return null;
    }

    return differenceInYears(new Date(), parsedDate);
  };

  // NUEVA FUNCIÓN DE EXPORTAR
  const exportToExcel = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay alumnos para exportar.",
        variant: "destructive",
      });
      return;
    }

    try {
      const dataToExport = filteredStudents.map(student => ({
        'Nombre': student.first_name || '',
        'Apellido': student.last_name || '',
        'Género': student.gender || '',
        'Fecha de Nacimiento': student.birthdate || '', // ⭐ Solo birthdate
        'Edad': calculateAge(student.birthdate || '') || '', // ⭐ Solo birthdate
        'Documento Número': student.document_number || '',
        'Teléfono': student.phone || '', // ⭐ Solo phone
        'Dirección': student.address || '',
        'Departamento': student.departments?.name || student.department || 'Sin departamento',
        'Clase/anexo': student.assigned_class || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Alumnos');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `alumnos_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Exportación exitosa",
        description: `Se exportaron ${filteredStudents.length} alumnos a ${fileName}`,
        variant: "success",
      });
    } catch (error) {
      console.error("Error al exportar:", error);
      toast({
        title: "Error al exportar",
        description: "Hubo un error al generar el archivo Excel.",
        variant: "destructive",
      });
    }
  };

  // ============ FUNCIÓN PARA MARCAR COMO NO NUEVO USANDO BACKEND API ============
  const handleMarkAsOld = async (studentId: string) => {
    try {
      await updateStudent(studentId, { nuevo: false });

      toast({
        title: "Alumno actualizado",
        description: "El alumno ya no está marcado como nuevo.",
        variant: "success",
      });
      refetch();
    } catch (error: any) {
      console.error("Error updating student:", error);
      toast({
        title: "Error al actualizar",
        description: error.message || "Hubo un error al actualizar el alumno.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (student: Student) => {
  setStudentToEdit(student);
  const birthDate = student.birthdate || "";

  form.reset({
    first_name: student.first_name || "",
    last_name: student.last_name || "",
    gender: student.gender || "masculino",
    birthdate: birthDate,
    address: student.address || "",
    phone: student.phone || "",
    document_number: student.document_number || "",
    department_id: student.department_id || "",
  });
  setIsEditModalOpen(true);
};

  // ============ FUNCIÓN PARA ACTUALIZAR USANDO BACKEND API ============
  const handleUpdate = async (values: any) => {
    if (!studentToEdit) return;
    try {
      console.log("Raw form values:", values);

      await updateStudent(studentToEdit.id, values);
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

  // ============ FUNCIÓN PARA ELIMINAR USANDO BACKEND API ============
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

  // ============ FUNCIÓN PARA PROMOVER USANDO BACKEND API ============
  const promoteStudents = async () => {
    if (studentsToPromote.length === 0 || !selectedDepartment) {
      toast({
        title: "Error",
        description: "Por favor, seleccione al menos un alumno y un departamento.",
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

  // ============ FUNCIÓN PARA IMPORTAR USANDO BACKEND API ============
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
    const nameFilter = filters.name.toLowerCase();
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const departmentFilter = filters.department;
    const classFilter = filters.class;

    const nameMatch = fullName.includes(nameFilter);
    const departmentMatch = departmentFilter ?
      (student.departments?.name === departmentFilter || student.department === departmentFilter) : true;
    const classMatch = classFilter ? student.assigned_class === classFilter : true;

    return nameMatch && departmentMatch && classMatch;
  });

  // Separar alumnos en dos grupos: normales y nuevos
  const regularStudents = filteredStudents?.filter(student => !student.nuevo) || [];
  const newStudents = filteredStudents?.filter(student => student.nuevo === true) || [];
  const hasNewStudents = newStudents.length > 0;

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
      class: '',
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

  // Función para renderizar una fila de alumno
  const renderStudentRow = (student: Student) => (
    <React.Fragment key={student.id}>
      <TableRow
        className={`cursor-pointer hover:bg-gray-50 ${student.isAuthorized ? 'bg-green-50' : ''} ${student.nuevo ? 'bg-blue-50' : ''}`}
        onClick={() => handleStudentClick(student.id)}
      >
        <TableCell className="font-medium">
          <div className="flex items-center gap-2">
            {expandedStudentId === student.id ? (
              <CircleChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <CircleChevronDown className="h-4 w-4 text-gray-500" />
            )}
            <span>{student.first_name} {student.last_name}</span>
            {student.isAuthorized && (
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                Autorizado
              </Badge>
            )}

          </div>
        </TableCell>
        {!isMobile && (
          <TableCell>{student.departments?.name || student.department || 'Sin departamento'}</TableCell>
        )}
        <TableCell>{calculateAge(student.birthdate) || 'N/A'}</TableCell>
        <TableCell className="text-right">
          {renderActionButtons(student)}
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
  );

  // Función para renderizar las acciones según si es móvil o no
  const renderActionButtons = (student: Student) => {
    if (isMobile) {
      // En móvil, mantener el menú desplegable
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canManageStudents && !student.isAuthorized && (
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
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              WhatsApp
            </DropdownMenuItem>
            {student.nuevo && (
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleMarkAsOld(student.id); }}>
                <Check className="mr-2 h-4 w-4" /> Marcar como no nuevo
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      // En desktop, mostrar botones directamente
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canManageStudents && !student.isAuthorized && (
            <>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0"
                      onClick={(e) => { e.stopPropagation(); handleEdit(student); }}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Editar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                      onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Eliminar</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-green-600 hover:text-green-700"
                  onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(student.phone); }}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>WhatsApp</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {student.nuevo && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700"
                    onClick={(e) => { e.stopPropagation(); handleMarkAsOld(student.id); }}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Marcar como no nuevo</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

        </div>
      );
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Listado de Alumnos</h2>
          <TooltipProvider>
            <div className="flex items-center space-x-2">
              {canFilter && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                      <Filter className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Filtrar alumnos</p>
                  </TooltipContent>
                </Tooltip>
              )}
              {(profile?.role === 'admin' || profile?.role === 'secretaria') && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" onClick={exportToExcel}>
                      <FileDown className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>Exportar a Excel</p>
                  </TooltipContent>
                </Tooltip>
              )}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button onClick={() => navigate('/agregar')}>
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Agregar nuevo</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>

        {canFilter && (
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
            </CollapsibleTrigger>
            <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

              <div>
                <Label htmlFor="department">Departamento</Label>
                <Select
                  onValueChange={(value) => setFilters(prev => ({ ...prev, department: value === "all" ? "" : value }))}
                  defaultValue={filters.department || "all"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione un departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {departments?.map((department) => (
                      <SelectItem key={department.id} value={department.name}>
                        {department.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="class">Anexo/Clase</Label>
                <Select
                  onValueChange={(value) => setFilters(prev => ({ ...prev, class: value === "all" ? "" : value }))}
                  value={filters.class || "all"}
                  key={filters.department} // Forzar re-render cuando cambie el departamento
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleccione una clase" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {classes?.map((className) => (
                      <SelectItem key={className} value={className}>
                        {className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="md:col-span-3 flex justify-end">
                <Button className="text-white" variant="secondary" size="sm" onClick={handleClearFilters}>
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
                  <TableCell className="font-medium">Departamento</TableCell>
                )}
                <TableCell className="font-medium">Edad</TableCell>
                <TableCell className={`flex justify-center ${isMobile ? 'w-[80px]' : 'w-[120px]'}`}>Acciones</TableCell>
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
              ) : (regularStudents.length === 0 && newStudents.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No hay alumnos registrados.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Renderizar alumnos regulares */}
                  {regularStudents.map((student) => renderStudentRow(student))}

                  {/* Línea separadora y alumnos nuevos */}
                  {hasNewStudents && (
                    <>
                      <TableRow>
                        <TableCell colSpan={4} className="py-4">
                          <div className="flex items-center justify-center">
                            <div className="flex-grow border-t border-gray-300"></div>
                            <span className="mx-4 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-medium">
                              Nuevos Alumnos
                            </span>
                            <div className="flex-grow border-t border-gray-300"></div>
                          </div>
                        </TableCell>
                      </TableRow>
                      {newStudents.map((student) => renderStudentRow(student))}
                    </>
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={isPromoteModalOpen} onOpenChange={setIsPromoteModalOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Promover Alumnos</DialogTitle>
              <DialogDescription>
                Seleccione el departamento al que desea promover los alumnos seleccionados.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="department" className="text-right">
                  Departamento
                </Label>
                <Select onValueChange={setSelectedDepartment} defaultValue={selectedDepartment ?? ""}>
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Seleccione un departamento" />
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
                      <FormLabel>Nombre*</FormLabel>
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
                  name="birthdate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Nacimiento</FormLabel>
                      <FormControl>
                        <Input
                          type="date"
                          {...field}
                          value={field.value || ''}
                        />
                      </FormControl>
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

                {/* ⭐ ACTUALIZADO: phone en lugar de phone_number */}
                <FormField
                  control={form.control}
                  name="phone"
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
                      <FormLabel>Departamento</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                        disabled={profile?.role === 'maestro'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Seleccione un departamento" />
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