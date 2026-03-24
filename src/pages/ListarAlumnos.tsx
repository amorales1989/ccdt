import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pencil, Trash2, MoreVertical, Filter, Upload, Loader2, FileDown, UserPlus, CircleChevronDown, CircleChevronUp, Check, MessageSquare, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { jsPDF } from "jspdf";
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
import { importStudentsFromExcel, updateStudent, getStudents, deleteStudent, getDepartments, getObservations } from "@/lib/api";
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
import { useNavigate, useSearchParams } from "react-router-dom";
import { zodResolver } from "@hookform/resolvers/zod";
import { CustomTooltip } from "@/components/CustomTooltip";
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
  const canFilter = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'director';
  const canManageStudents = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'lider' || profile?.role === 'maestro' || profile?.role === 'director';

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

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

    // Si es director, filtrar por departamento (todo el departamento)
    if (profile?.role === 'director' && profile?.department_id) {
      filteredStudents = allStudents.filter(student =>
        student.department_id === profile.department_id
      );
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

  // ============ CONSULTA DE CLASES - USAR DEPARTAMENTOS Y STUDENTS ============
  const { data: classes } = useQuery({
    queryKey: ["classes", filters.department],
    queryFn: async () => {
      // 1. Obtener clases del departamento si está seleccionado
      const selectedDeptObj = departments?.find(d =>
        d.name === filters.department || (d.id === profile?.department_id && profile?.role === 'director')
      );
      const deptClasses = selectedDeptObj?.classes || [];

      // 2. Obtener clases de los estudiantes existentes (para retrocompatibilidad)
      let studentClasses: string[] = [];
      if (allStudents) {
        let studentsToAnalyze = allStudents;
        if (filters.department) {
          studentsToAnalyze = allStudents.filter(student =>
            student.departments?.name === filters.department ||
            student.department === filters.department
          );
        }
        studentClasses = [...new Set(
          studentsToAnalyze
            .map(student => student.assigned_class)
            .filter(Boolean)
        )] as string[];
      }

      // 3. Combinar y devolver únicas
      return [...new Set([...deptClasses, ...studentClasses])].sort();
    },
    enabled: !!allStudents || !!departments,
  });



  const formSchema = z.object({
    first_name: z.string().min(1, "El nombre es requerido"),
    last_name: z.string().optional(),
    gender: z.string(),
    birthdate: z.any().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    document_number: z.string().optional(),
    department_id: z.string().optional(),

    assigned_class: z.string().optional(),
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
      document_number: "",
      department_id: "",
      assigned_class: ""
    },
    resolver: zodResolver(formSchema),
  });

  useEffect(() => {
    refetch();
  }, [refetch]);

  useEffect(() => {
    if (!profile) {
      navigate('/');
      return;
    }

    // Leer parámetros de búsqueda al cargar
    const deptParam = searchParams.get('department');
    const classParam = searchParams.get('class');

    if (deptParam || classParam) {
      setFilters(prev => ({
        ...prev,
        department: deptParam || '',
        class: classParam || ''
      }));
      setIsFilterOpen(true);
    } else if (profile?.role === 'director' && profile?.department_id && departments) {
      const directorDept = departments.find(d => d.id === profile.department_id);
      if (directorDept) {
        setFilters(prev => ({ ...prev, department: directorDept.name }));
        setIsFilterOpen(true);
      }
    }
  }, [profile, navigate, searchParams, departments]);

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
      queryClient.invalidateQueries({ queryKey: ["students"] });
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
      assigned_class: student.assigned_class || "",
    });
    setIsEditModalOpen(true);
  };

  const handleDownloadStudentPDF = async (student: Student) => {
    try {
      toast({
        title: "Generando PDF",
        description: "Obteniendo historial de observaciones...",
      });

      const observations = await getObservations(student.id);
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(75, 85, 99);
      doc.text(`Informe de ${student.first_name} ${student.last_name || ""}`, pageWidth / 2, 20, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(107, 114, 128);
      doc.text(`Fecha de generación: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, pageWidth / 2, 28, { align: "center" });

      doc.setDrawColor(229, 231, 235);
      doc.line(20, 35, pageWidth - 20, 35);

      // Student Data Section
      doc.setFontSize(16);
      doc.setTextColor(31, 41, 55);
      doc.setFont("helvetica", "bold");
      doc.text("Datos Personales", 20, 48);

      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81);

      const leftCol = 25;
      const dataYStart = 58;
      const rowHeight = 8;

      const age = student.birthdate ? calculateAge(student.birthdate) : null;
      doc.text(`Edad: ${age ? `${age} años` : "No registrada"}`, leftCol, dataYStart);

      doc.text(`DNI: ${student.document_number || "No registrado"}`, leftCol, dataYStart + rowHeight);
      doc.text(`Género: ${student.gender === 'masculino' ? 'Masculino' : 'Femenino'}`, leftCol, dataYStart + (rowHeight * 2));
      doc.text(`Fecha de Nacimiento: ${student.birthdate ? format(parseISO(student.birthdate), "dd/MM/yyyy") : "No registrada"}`, leftCol, dataYStart + (rowHeight * 3));
      doc.text(`Teléfono: ${student.phone || "No registrado"}`, leftCol, dataYStart + (rowHeight * 4));
      doc.text(`Dirección: ${student.address || "No registrada"}`, leftCol, dataYStart + (rowHeight * 5));
      doc.text(`Departamento: ${student.department || "No asignado"}`, leftCol, dataYStart + (rowHeight * 6));
      doc.text(`Clase: ${student.assigned_class || "No asignada"}`, leftCol, dataYStart + (rowHeight * 7));

      // Observations Section
      let currentY = dataYStart + (rowHeight * 9) + 15;

      doc.line(20, currentY - 5, pageWidth - 20, currentY - 5);

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      doc.text("Historial de Observaciones", 20, currentY);

      currentY += 12;

      if (!observations || observations.length === 0) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "italic");
        doc.setTextColor(107, 114, 128);
        doc.text("No hay observaciones registradas para este alumno.", 25, currentY);
      } else {
        observations.forEach((obs, index) => {
          // Check if we need a new page
          if (currentY > 260) {
            doc.addPage();
            currentY = 25;
          }

          // Background for date header
          doc.setFillColor(243, 244, 246);
          doc.rect(25, currentY - 5, pageWidth - 50, 8, 'F');

          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(75, 85, 99);
          const dateStr = obs.created_at ? format(parseISO(obs.created_at), "dd/MM/yyyy HH:mm") : "Sin fecha";
          const author = obs.profiles ? ` - Por: ${obs.profiles.first_name} ${obs.profiles.last_name}` : "";
          doc.text(`${dateStr}${author}`, 30, currentY);

          currentY += 8;

          doc.setFontSize(11);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(55, 65, 81);

          const lines = doc.splitTextToSize(obs.observation, pageWidth - 60);
          doc.text(lines, 30, currentY);

          currentY += (lines.length * 5) + 8;
        });
      }

      doc.save(`informe_${student.first_name}_${student.last_name || ""}.pdf`);

      toast({
        title: "PDF Generado",
        description: "El informe se ha descargado correctamente.",
        variant: "success"
      });
    } catch (error: any) {
      console.error("Error al generar PDF:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al generar el PDF: " + error.message,
        variant: "destructive"
      });
    }
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
      queryClient.invalidateQueries({ queryKey: ["students"] });
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
      queryClient.invalidateQueries({ queryKey: ["students"] });
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
      queryClient.invalidateQueries({ queryKey: ["students"] });
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
    if (profile?.role === 'director' && profile?.department_id && departments) {
      const directorDept = departments.find(d => d.id === profile.department_id);
      setFilters({
        name: '',
        department: directorDept?.name || '',
        class: '',
      });
    } else {
      setFilters({
        name: '',
        department: '',
        class: '',
      });
    }
    setSearchParams({});
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
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setExpandedStudentId(student.id); }}>
              <MessageSquare className="mr-2 h-4 w-4" /> Observaciones
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      // En desktop, mostrar botones directamente
      return (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {canManageStudents && !student.isAuthorized && (
            <>
              <CustomTooltip title="Editar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 hover:bg-accent hover:text-accent-foreground"
                  onClick={(e) => { e.stopPropagation(); handleEdit(student); }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </CustomTooltip>

              <CustomTooltip title="Eliminar">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={(e) => { e.stopPropagation(); handleDelete(student.id); }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CustomTooltip>
            </>
          )}
          <CustomTooltip title="WhatsApp">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 transition-colors"
              onClick={(e) => { e.stopPropagation(); handleWhatsAppClick(student.phone); }}
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
            </Button>
          </CustomTooltip>

          {student.nuevo && (
            <CustomTooltip title="Marcar como no nuevo">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                onClick={(e) => { e.stopPropagation(); handleMarkAsOld(student.id); }}
              >
                <Check className="h-4 w-4" />
              </Button>
            </CustomTooltip>
          )}

          <CustomTooltip title="Descargar Informe PDF">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={(e) => { e.stopPropagation(); handleDownloadStudentPDF(student); }}
            >
              <FileText className="h-4 w-4" />
            </Button>
          </CustomTooltip>

          <CustomTooltip title="Ver/Agregar Observaciones">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-primary hover:text-primary/80 hover:bg-primary/10"
              onClick={(e) => { e.stopPropagation(); setExpandedStudentId(student.id); }}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
          </CustomTooltip>

        </div>
      );
    }
  };

  return (
    <div className="animate-fade-in space-y-8 pb-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-lg">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div className="text-center sm:text-left">
              <h2 className="text-3xl font-black text-foreground tracking-tight">Directorio de Alumnos</h2>
              <p className="text-muted-foreground text-sm mt-1">Gestión general e información detallada</p>
            </div>

            <div className="flex items-center space-x-2">
              {canFilter && (
                <CustomTooltip title="Filtrar alumnos">
                  <Button variant="outline" className="bg-white/80 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 shadow-sm text-foreground hover:text-foreground" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                    <Filter className="h-4 w-4" />
                  </Button>
                </CustomTooltip>
              )}
              {(profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'director') && (
                <CustomTooltip title="Exportar a Excel">
                  <Button variant="outline" className="bg-white/80 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 border-slate-200 dark:border-slate-700 shadow-sm text-foreground hover:text-foreground" onClick={exportToExcel}>
                    <FileDown className="h-4 w-4" />
                  </Button>
                </CustomTooltip>
              )}
              <CustomTooltip title="Agregar nuevo alumno">
                <Button onClick={() => navigate('/agregar')} className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Nuevo
                </Button>
              </CustomTooltip>
            </div>
          </div>

          {canFilter && (
            <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <CollapsibleTrigger asChild>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">

                <div>
                  <Label htmlFor="department">Departamento</Label>
                  <Select
                    onValueChange={(value) => setFilters(prev => ({ ...prev, department: value === "all" ? "" : value, class: '' }))}
                    value={filters.department || "all"}
                    disabled={profile?.role === 'director'}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Seleccione un departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile?.role !== 'director' && <SelectItem value="all">Todos</SelectItem>}
                      {departments?.filter(dept => profile?.role !== 'director' || profile.department_id === dept.id).map((department) => (
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
                        <SelectItem key={String(className)} value={String(className)}>
                          {String(className)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-end">
                  <Button
                    className="bg-slate-900 hover:bg-slate-800 text-white dark:bg-slate-950 dark:hover:bg-slate-900 shadow-lg rounded-full px-6 transition-all active:scale-95"
                    size="sm"
                    onClick={handleClearFilters}
                  >
                    Limpiar Filtros
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="overflow-hidden mt-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200 dark:border-slate-700/50 rounded-2xl shadow-sm">
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
            <DialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
            <DialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
            <DialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
              <DialogHeader>
                <DialogTitle>Editar Alumno</DialogTitle>
                <DialogDescription>
                  Realice los cambios necesarios en la información del alumno.
                </DialogDescription>
              </DialogHeader>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(handleUpdate)} className="grid gap-4 py-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                            disabled={profile?.role === 'maestro' || profile?.role === 'director'}
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

                    <FormField
                      control={form.control}
                      name="assigned_class"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Clase</FormLabel>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={field.value}
                            value={field.value}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Seleccione una clase" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value=" ">Ninguna</SelectItem>
                              {classes?.map((className) => (
                                <SelectItem key={String(className)} value={String(className)}>
                                  {String(className)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="flex justify-end">
                    <Button type="submit">Guardar</Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
            <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
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
        </div>
      </section>
    </div>
  );
};

export default ListarAlumnos;