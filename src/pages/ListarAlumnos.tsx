import React from "react";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Pencil, Trash2, MoreVertical, Filter, Upload, Loader2, FileDown, UserPlus, CircleChevronDown, CircleChevronUp, Check, MessageSquare, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LoadingOverlay } from "@/components/LoadingOverlay";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { importStudentsFromExcel, updateStudent, getStudents, deleteStudent, getDepartments, getObservations, getAttendance } from "@/lib/api";
import AgregarAlumno from "@/pages/AgregarAlumno";
import { CustomTabs } from "@/components/CustomTabs";
import { BirthdayList } from "@/components/BirthdayList";
import { exportAttendanceReport } from "@/lib/attendancePdfUtils";
import { Calendar } from "lucide-react";
import { useCompany } from "@/contexts/CompanyContext";
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
  const [isUpdating, setIsUpdating] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [excelError, setExcelError] = useState<string | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [studentsToPromote, setStudentsToPromote] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [isPromoting, setIsPromoting] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    name: '',
    department: '',
    class: '',
  });
  const [sortConfig, setSortConfig] = useState<{ key: 'name' | 'age', direction: 'asc' | 'desc' } | null>(null);
  const [activeTab, setActiveTab] = useState<"miembros" | "cumpleanos">("miembros");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const { user } = useAuth();
  const isMobile = useIsMobile();
  const profile = useAuth().profile;
  const canFilter = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'director' || profile?.role === 'director_general';
  const canManageStudents = profile?.role === 'secretaria' || profile?.role === 'admin' || profile?.role === 'lider' || profile?.role === 'maestro' || profile?.role === 'director' || profile?.role === 'director_general';

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyId } = useCompany();

  // ============ CONSULTA PRINCIPAL DE MIEMBROS USANDO BACKEND API ============
  const { data: allStudents, isLoading, isError, refetch } = useQuery({
    queryKey: ["students", companyId],
    queryFn: getStudents,
  });

  // ============ CONSULTA DE AUTORIZACIONES - MANTENER SUPABASE POR AHORA ============
  const { data: authorizations } = useQuery({
    queryKey: ["authorizations", companyId],
    queryFn: async () => {
      const { data, error } = await (supabase.from("student_authorizations") as any).select("*").eq('company_id', companyId);
      if (error) {
        console.error("Error fetching authorizations:", error);
        return [];
      }
      return data || [];
    },
  });

  // Filtrar miembros según el rol y permisos del usuario
  const students = React.useMemo(() => {
    if (!allStudents?.length) return [];

    const filteredStudentsBase = allStudents.filter(s => !s.deleted_at);

    // Si es admin o secretaria, mostrar todos los miembros
    if (profile?.role === 'secretaria' || profile?.role === 'admin') {
      return filteredStudentsBase.map(student => ({
        ...student,
        department: student.departments?.name || student.department
      }));
    }

    // Identificar a los autorizados específicamente para mi departamento/clase
    const myAuthorizedStudentIds = authorizations
      ? authorizations
        .filter((auth: any) =>
          auth.department_id === profile?.department_id &&
          (!auth.class || auth.class === profile?.assigned_class || auth.class === "all")
        )
        .map((auth: any) => auth.student_id)
      : [];

    // Unir mis miembros regulares con los autorizados
    let filteredList = filteredStudentsBase.filter(student => {
      // Caso 1: Miembro regular de mi departamento (y clase si soy maestro)
      const isRegular = (
        ((profile?.role === 'director' || profile?.role === 'director_general') &&
          (profile?.departments?.includes(student.departments?.name || student.department) || student.department_id === profile?.department_id)) ||
        (profile?.department_id && profile?.assigned_class &&
          student.department_id === profile.department_id &&
          student.assigned_class === profile.assigned_class)
      );

      // Caso 2: Miembro de otro departamento pero autorizado al mío
      const isAuthorized = myAuthorizedStudentIds.includes(student.id);

      return isRegular || isAuthorized;
    });

    return filteredList.map(student => {
      const isAuthorizedToMe = myAuthorizedStudentIds.includes(student.id) && student.department_id !== profile?.department_id;
      return {
        ...student,
        department: student.departments?.name || student.department,
        isAuthorized: isAuthorizedToMe
      };
    });
  }, [allStudents, profile, authorizations]);

  const calculateAge = React.useCallback((dateOfBirth: string): number | null => {
    if (!dateOfBirth) return null;
    const parsedDate = parse(dateOfBirth, 'yyyy-MM-dd', new Date());

    if (!isValid(parsedDate)) {
      return null;
    }

    return differenceInYears(new Date(), parsedDate);
  }, []);

  const filteredStudents = React.useMemo(() => {
    return students?.filter(student => {
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
  }, [students, filters]);

  const sortedStudents = React.useMemo(() => {
    if (!filteredStudents) return [];
    if (!sortConfig) return filteredStudents;

    return [...filteredStudents].sort((a, b) => {
      if (sortConfig.key === 'name') {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        if (nameA < nameB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (nameA > nameB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      if (sortConfig.key === 'age') {
        const ageA = calculateAge(a.birthdate || '') || 0;
        const ageB = calculateAge(b.birthdate || '') || 0;
        if (ageA < ageB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (ageA > ageB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      }
      return 0;
    });
  }, [filteredStudents, sortConfig, calculateAge]);

  const regularStudents = sortedStudents?.filter(student => !student.nuevo) || [];
  const newStudents = sortedStudents?.filter(student => student.nuevo === true) || [];
  const hasNewStudents = newStudents.length > 0;

  const handleSort = (key: 'name' | 'age') => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // ============ CONSULTA DE DEPARTAMENTOS USANDO BACKEND API ============
  const { data: departments } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: getDepartments,
  });


  // ============ CONSULTA DE CLASES - USAR DEPARTAMENTOS Y STUDENTS ============
  const { data: classes } = useQuery({
    queryKey: ["classes", filters.department, companyId],
    queryFn: async () => {
      // 1. Obtener clases del departamento si está seleccionado
      const selectedDeptObj = departments?.find(d =>
        d.name === filters.department || (d.id === profile?.department_id && profile?.role === 'director')
      );
      const deptClasses = selectedDeptObj?.classes || [];

      // 2. Obtener clases de los miembros existentes (para retrocompatibilidad)
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

  const watchedDepartmentId = form.watch("department_id");
  const editModalClasses = React.useMemo(() => {
    if (!watchedDepartmentId || !departments) return [];
    const dept = departments.find(d => d.id === watchedDepartmentId);
    return dept?.classes || [];
  }, [watchedDepartmentId, departments]);

  // Limpiar la clase asignada si cambia el departamento
  useEffect(() => {
    if (isEditModalOpen && watchedDepartmentId) {
      const currentClass = form.getValues("assigned_class");
      if (currentClass && !editModalClasses.includes(currentClass)) {
        form.setValue("assigned_class", "");
      }
    }
  }, [watchedDepartmentId, editModalClasses, form, isEditModalOpen]);

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
    } else if ((profile?.role === 'director' || profile?.role === 'director_general') && departments) {
      if (isFilterOpen) return;

      const directorDept = profile.department_id ? departments.find(d => d.id === profile.department_id) : null;
      if (directorDept) {
        setFilters(prev => ({ ...prev, department: directorDept.name }));
        setIsFilterOpen(true);
      }
    }
  }, [profile, navigate, searchParams, departments, isFilterOpen]);


  const handleDownloadAttendanceReport = async () => {
    if (!students || students.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay miembros en la lista actual para generar el reporte.",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingReport(true);
    try {
      const currentYear = new Date().getFullYear();
      const startDate = `${currentYear}-01-01`;
      const endDate = `${currentYear}-12-31`;

      // Obtener asistencias del año actual
      // Si el usuario tiene un departamento asignado, filtramos por ese departamento
      const attendanceClassFilter = (profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'director' || profile?.role === 'director_general')
        ? (filters.class || undefined)
        : (profile?.assigned_class || undefined);

      const allYearAttendance = await getAttendance(
        startDate,
        endDate,
        undefined,
        profile?.role !== 'admin' && profile?.role !== 'secretaria' ? profile?.department_id : (filters.department ? null : undefined),
        attendanceClassFilter
      );

      // Si estamos filtrando por un departamento o clase específica en la UI, aplicamos esos filtros a la data de asistencia
      let filteredAttendance = allYearAttendance;
      if (filters.department) {
        filteredAttendance = filteredAttendance.filter(a => a.department === filters.department);
      }
      if (filters.class) {
        filteredAttendance = filteredAttendance.filter(a => a.assigned_class === filters.class);
      }

      // Obtener los IDs de los estudiantes que están actualmente en la lista (filtrados)
      const currentStudentIds = new Set(students.map(s => s.id));

      // Filtrar asistencias solo para los estudiantes visibles actualmente
      const relevantAttendance = filteredAttendance.filter(a => currentStudentIds.has(a.student_id));

      // Calcular días de actividad total (fechas únicas con al menos una asistencia registrada para este grupo)
      const uniqueDates = new Set(relevantAttendance.map(a => a.date));
      const totalActivityDays = uniqueDates.size;

      if (totalActivityDays === 0) {
        toast({
          title: "Sin actividad",
          description: "No se encontraron registros de asistencia para este grupo en el año actual.",
          variant: "destructive",
        });
        setIsGeneratingReport(false);
        return;
      }

      // Procesar datos por estudiante
      const reportData = students.map(student => {
        const studentAttendances = relevantAttendance.filter(a => a.student_id === student.id && a.status === true);
        const presenceCount = studentAttendances.length;
        const percentage = (presenceCount / totalActivityDays) * 100;

        return {
          studentName: `${student.first_name} ${student.last_name}`,
          departmentName: student.department || '',
          className: student.assigned_class || '',
          presenceCount,
          percentage
        };
      });

      // Ordenar por porcentaje/asistencias de mayor a menor
      reportData.sort((a, b) => b.percentage - a.percentage);

      // Generar PDF
      await exportAttendanceReport(
        reportData,
        totalActivityDays,
        "CCDT"
      );

      toast({
        title: "Reporte generado",
        description: "El reporte de asistencia se ha descargado correctamente.",
      });
    } catch (error) {
      console.error("Error generating attendance report:", error);
      toast({
        title: "Error",
        description: "Hubo un problema al generar el reporte de asistencia.",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingReport(false);
    }
  };

  // NUEVA FUNCIÓN DE EXPORTAR
  const exportToExcel = () => {
    if (!filteredStudents || filteredStudents.length === 0) {
      toast({
        title: "Sin datos",
        description: "No hay miembros para exportar.",
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
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Miembros');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const fileName = `alumnos_${dateStr}.xlsx`;

      XLSX.writeFile(workbook, fileName);

      toast({
        title: "Exportación exitosa",
        description: `Se exportaron ${filteredStudents.length} miembros a ${fileName}`,
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
        title: "Miembro actualizado",
        description: "El miembro ya no está marcado como nuevo.",
        variant: "success",
      });
      queryClient.invalidateQueries({ queryKey: ["students", companyId] });
    } catch (error: any) {
      console.error("Error updating student:", error);
      toast({
        title: "Error al actualizar",
        description: error.message || "Hubo un error al actualizar el miembro.",
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
    const getBase64ImageFromURL = (url: string): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.setAttribute("crossOrigin", "anonymous");
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext("2d");
          ctx?.drawImage(img, 0, 0);
          const dataURL = canvas.toDataURL("image/jpeg");
          resolve(dataURL);
        };
        img.onerror = (error) => reject(error);
        img.src = url;
      });
    };

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

      // Add Photo if exists
      if (student.photo_url) {
        try {
          const photoBase64 = await getBase64ImageFromURL(student.photo_url);
          doc.addImage(photoBase64, 'JPEG', pageWidth - 55, 45, 35, 45);
          doc.setDrawColor(200, 200, 200);
          doc.rect(pageWidth - 55, 45, 35, 45);
        } catch (e) {
          console.error("No se pudo cargar la imagen para el PDF", e);
        }
      }

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
        doc.text("No hay observaciones registradas para este miembro.", 25, currentY);
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
    setIsUpdating(true);
    try {
      console.log("Raw form values:", values);

      await updateStudent(studentToEdit.id, values);
      toast({
        title: "Miembro actualizado",
        description: "El miembro ha sido actualizado correctamente.",
        variant: "success",
      });
      setIsEditModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["students", companyId] });
    } catch (error: any) {
      toast({
        title: "Error al actualizar",
        description: error.message || "Hubo un error al actualizar el miembro.",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
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
        title: "Miembro eliminado",
        description: "El miembro ha sido eliminado correctamente.",
        variant: "success",
      });
      setDeleteAlertOpen(false);
      setStudentToDelete(null);
      queryClient.invalidateQueries({ queryKey: ["students", companyId] });
    } catch (error: any) {
      toast({
        title: "Error al eliminar",
        description: error.message || "Hubo un error al eliminar el miembro.",
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
        description: "Por favor, seleccione al menos un miembro y un departamento.",
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
        title: "Miembros promovidos",
        description: "Los miembros han sido promovidos correctamente.",
        variant: "success",
      });
      setIsPromoteModalOpen(false);
      setStudentsToPromote([]);
      setSelectedDepartment(null);
      queryClient.invalidateQueries({ queryKey: ["students", companyId] });
    } catch (error: any) {
      toast({
        title: "Error al promover",
        description: error.message || "Hubo un error al promover los miembros.",
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
        description: `${result.successful || 0} miembros importados correctamente. ${result.failed || 0} miembros fallaron.`,
        variant: "success",
      });

      if (result.errors && result.errors.length > 0) {
        console.error("Errores de importación:", result.errors);
      }

      queryClient.invalidateQueries({ queryKey: ["students", companyId] });
    }
  };

  const handleStudentClick = (studentId: string) => {
    setExpandedStudentId(expandedStudentId === studentId ? null : studentId);
  };

  const handleWhatsAppClick = (phoneNumber: string | null) => {
    if (!phoneNumber) {
      toast({
        title: "Error",
        description: "El miembro no tiene un número de teléfono registrado.",
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

  const renderStudentRow = (student: Student) => (
    <React.Fragment key={student.id}>
      <TableRow
        className={`group cursor-pointer transition-all duration-200 border-b border-slate-100/60 hover:bg-slate-50/80 ${student.isAuthorized ? 'bg-emerald-50/30 dark:bg-emerald-900/5' : ''} ${student.nuevo ? 'bg-blue-50/30 dark:bg-blue-900/5' : ''}`}
        onClick={() => handleStudentClick(student.id)}
      >
        <TableCell className="font-medium p-4">
          <div className="flex items-center gap-3 text-sm">
            <Avatar className="h-10 w-10 border border-slate-200 dark:border-slate-700 shadow-sm flex-shrink-0">
              <AvatarImage src={student.photo_url || (student.gender?.toLowerCase() === 'femenino' ? '/avatarM.png' : '/avatarH.png')} alt={`${student.first_name}`} className="object-cover" />
              <AvatarFallback className="bg-indigo-100 text-indigo-600 text-xs font-bold">
                {student.first_name.charAt(0)}{student.last_name?.charAt(0) || ""}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-slate-800 dark:text-slate-100 tracking-tight">{student.first_name} {student.last_name}</span>
                {expandedStudentId === student.id ? (
                  <CircleChevronUp className="h-3.5 w-3.5 text-primary opacity-60" />
                ) : (
                  <CircleChevronDown className="h-3.5 w-3.5 text-slate-400 opacity-40 group-hover:opacity-80 transition-opacity" />
                )}
              </div>
              <div className="flex gap-2 items-center">
                {student.isAuthorized && <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-100/50 text-[10px] font-bold h-4.5 px-2">Autorizado</Badge>}
                {student.nuevo && <Badge variant="secondary" className="bg-blue-50 text-blue-700 border-blue-100/50 text-[10px] font-bold h-4.5 px-2">Nuevo</Badge>}
                {((student as any).active_enrollments_count > 1) && (
                  <div title="Miembro en múltiples departamentos" className="bg-purple-50 p-0.5 rounded-full border border-purple-100/50">
                    <User className="h-2.5 w-2.5 text-purple-500" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </TableCell>
        {!isMobile && (
          <TableCell className="text-slate-500 dark:text-slate-400 font-medium text-sm text-center">
            <span className="bg-slate-100/50 px-3 py-1 rounded-full border border-slate-200/40">
              {student.departments?.name || student.department || 'Sin departamento'}
            </span>
          </TableCell>
        )}
        <TableCell className="text-slate-500 dark:text-slate-400 font-bold text-sm text-center">
          {calculateAge(student.birthdate) || '—'}
        </TableCell>
        <TableCell className="text-right">
          {renderActionButtons(student)}
        </TableCell>
      </TableRow>
      {expandedStudentId === student.id && (
        <TableRow>
          <TableCell colSpan={4} className="bg-slate-50/80 dark:bg-slate-900/50 p-0">
            <StudentDetails
              student={student}
              onPhotoUpdate={() => refetch()}
            />
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
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDownloadStudentPDF(student); }}>
              <FileText className="mr-2 h-4 w-4" /> Descargar Informe PDF
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    } else {
      // En desktop, mostrar botones directamente
      return (
        <div className="flex items-center gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
          {canManageStudents && !student.isAuthorized ? (
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
          ) : (
            <>
              <div className="w-8 h-8 invisible" />
              <div className="w-8 h-8 invisible" />
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

          {student.nuevo ? (
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
          ) : (
            <div className="w-8 h-8 invisible" />
          )}

        </div>
      );
    }
  };

  if (isLoading) {
    return <LoadingOverlay message="Cargando miembros..." />;
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto animate-fade-in space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Directorio de Miembros</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Gestión general e información detallada</p>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
              <User className="h-3 w-3 text-slate-400" />
              {(regularStudents.length + newStudents.length)} miembros
            </span>
            {canFilter && (
              <CustomTooltip title="Filtrar miembros">
                <Button variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm h-10 transition-all active:scale-95" onClick={() => setIsFilterOpen(!isFilterOpen)}>
                  <Filter className="h-4 w-4" />
                </Button>
              </CustomTooltip>
            )}
            {(profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'director' || profile?.role === 'director_general' || profile?.role === 'lider' || profile?.role === 'maestro') && (
              <CustomTooltip title="Reporte de Asistencia (PDF)">
                <Button
                  variant="outline"
                  className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm h-10 transition-all active:scale-95"
                  onClick={handleDownloadAttendanceReport}
                  disabled={isGeneratingReport}
                >
                  {isGeneratingReport ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4" />
                  )}
                </Button>
              </CustomTooltip>
            )}

            {(profile?.role === 'admin' || profile?.role === 'secretaria' || profile?.role === 'director' || profile?.role === 'director_general') && (
              <CustomTooltip title="Exportar a Excel">
                <Button variant="outline" className="rounded-xl border-slate-200 bg-white hover:bg-slate-100 hover:border-slate-300 hover:text-slate-900 shadow-sm h-10 transition-all active:scale-95" onClick={exportToExcel}>
                  <FileDown className="h-4 w-4" />
                </Button>
              </CustomTooltip>
            )}
            <Button onClick={() => setIsAddModalOpen(true)} className="button-gradient rounded-xl font-black h-10 px-5 shadow-lg shadow-primary/20">
              <UserPlus className="h-4 w-4 mr-2" />
              Nuevo Miembro
            </Button>
          </div>
        </div>

        <CustomTabs
          value={activeTab}
          onChange={(v) => setActiveTab(v as "miembros" | "cumpleanos")}
          options={[
            { value: "miembros", label: "Lista de Miembros", icon: User },
            { value: "cumpleanos", label: "Cumpleaños", icon: Calendar }
          ]}
          className="w-full sm:w-fit"
        />

        {activeTab === "miembros" && (
          <div className="space-y-6 animate-in slide-in-from-left-4 fade-in duration-300">
            {canFilter && (
              <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <CollapsibleTrigger asChild></CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="bg-white border border-slate-200/60 rounded-2xl p-5 shadow-sm">
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-400 mb-4 flex items-center gap-2">
                      <Filter className="h-3 w-3" /> Filtros de búsqueda
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</Label>
                        <Select
                          onValueChange={(value) => setFilters(prev => ({ ...prev, department: value === "all" ? "" : value, class: '' }))}
                          value={filters.department || "all"}
                          disabled={profile?.role === 'director' || profile?.role === 'vicedirector'}
                        >
                          <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
                            <SelectValue placeholder="Seleccione un departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            {profile?.role !== 'director' && profile?.role !== 'vicedirector' && <SelectItem value="all">Todos</SelectItem>}
                            {departments?.filter(dept => {
                              if (profile?.role === 'admin' || profile?.role === 'secretaria') return true;
                              if (profile?.role === 'director' || profile?.role === 'vicedirector') return profile.department_id === dept.id;
                              if (profile?.role === 'director_general') return profile.departments?.includes(dept.name);
                              return false;
                            }).map((department) => (
                              <SelectItem key={department.id} value={department.name}>
                                {department.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Anexo/Clase</Label>
                        <Select
                          onValueChange={(value) => setFilters(prev => ({ ...prev, class: value === "all" ? "" : value }))}
                          value={filters.class || "all"}
                          key={filters.department}
                        >
                          <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200">
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
                          variant="outline"
                          className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold h-10 px-6"
                          onClick={handleClearFilters}
                        >
                          Limpiar Filtros
                        </Button>
                      </div>
                    </div>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            <div className="bg-white border border-slate-200/60 rounded-2xl shadow-sm overflow-hidden">
              <Table>
                <TableBody>
                  <TableRow className="bg-slate-50 border-b border-slate-100">
                    <TableCell
                      className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-primary transition-colors group p-4"
                      onClick={() => handleSort('name')}
                    >
                      <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                        Nombre
                        <div className={`transition-opacity ${sortConfig?.key === 'name' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                          {sortConfig?.key === 'name' && sortConfig.direction === 'desc' ? <CircleChevronUp className="h-4 w-4" /> : <CircleChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </TableCell>
                    {!isMobile && (
                      <TableCell className="font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider text-[11px] p-4 text-center">Departamento</TableCell>
                    )}
                    <TableCell
                      className="font-bold text-slate-800 dark:text-slate-200 cursor-pointer hover:text-primary transition-colors group p-4"
                      onClick={() => handleSort('age')}
                    >
                      <div className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
                        Edad
                        <div className={`transition-opacity ${sortConfig?.key === 'age' ? 'opacity-100' : 'opacity-0 group-hover:opacity-40'}`}>
                          {sortConfig?.key === 'age' && sortConfig.direction === 'desc' ? <CircleChevronUp className="h-4 w-4" /> : <CircleChevronDown className="h-4 w-4" />}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={`font-bold text-slate-800 dark:text-slate-200 text-center uppercase tracking-wider text-[11px] p-4 ${isMobile ? 'w-[80px]' : 'w-[120px]'}`}>
                      {!isMobile && "Acciones"}
                    </TableCell>
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
                        Error al cargar los miembros.
                      </TableCell>
                    </TableRow>
                  ) : (regularStudents.length === 0 && newStudents.length === 0) ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-3">
                          <User className="h-10 w-10 text-slate-200" />
                          <p className="text-slate-400 font-medium tracking-tight">No hay miembros registrados.</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    <>
                      {/* Renderizar miembros regulares */}
                      {regularStudents.map((student) => renderStudentRow(student))}

                      {/* Línea separadora y miembros nuevos */}
                      {hasNewStudents && (
                        <>
                          <TableRow>
                            <TableCell colSpan={4} className="py-4">
                              <div className="flex items-center justify-center py-2 px-4">
                                <div className="flex-grow border-t border-slate-100"></div>
                                <span className="mx-4 px-4 py-1.5 bg-slate-50 text-slate-500 rounded-full text-[10px] uppercase font-black tracking-[0.2em] border border-slate-100/80">
                                  Nuevos Miembros
                                </span>
                                <div className="flex-grow border-t border-slate-100"></div>
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
          </div>
        )}

        {activeTab === "cumpleanos" && (
          <BirthdayList students={filteredStudents || []} />
        )}

        <Dialog open={isPromoteModalOpen} onOpenChange={setIsPromoteModalOpen}>
          <DialogContent className="w-[95vw] max-w-lg sm:max-w-[520px] max-h-[90vh] overflow-y-auto overflow-x-hidden p-0 gap-0 rounded-2xl border-slate-200">
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-slate-800">
              <DialogTitle className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                <div className="bg-primary/10 p-2 rounded-xl">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                Promover Miembros
              </DialogTitle>
              <DialogDescription className="text-slate-500 mt-1.5 text-sm">
                Seleccioná el departamento destino y los miembros a promover.
              </DialogDescription>
            </div>

            {/* Body */}
            <div className="px-6 py-5 space-y-5">

              {/* Departamento destino */}
              <div className="space-y-2">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Departamento destino</p>
                <Select onValueChange={setSelectedDepartment} defaultValue={selectedDepartment ?? ""}>
                  <SelectTrigger className="w-full rounded-xl bg-slate-50 border-slate-200 h-11">
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

              {/* Selección de miembros */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Miembros seleccionados</p>
                  <button
                    onClick={handlePromoteAll}
                    className="text-xs font-bold text-primary hover:text-primary/70 transition-colors"
                  >
                    {studentsToPromote.length === (students?.length || 0) ? 'Deseleccionar todos' : 'Seleccionar todos'}
                  </button>
                </div>

                {/* Lista scrolleable de miembros */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
                  <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                    {students && students.length > 0 ? students.map((student) => {
                      const isSelected = studentsToPromote.includes(student.id);
                      return (
                        <button
                          key={student.id}
                          onClick={() => handlePromote(student.id)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all ${isSelected
                            ? 'bg-primary/8 text-primary font-semibold'
                            : 'hover:bg-white text-slate-700'
                            }`}
                        >
                          <div className={`h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${isSelected
                            ? 'bg-primary border-primary'
                            : 'border-slate-300 bg-white'
                            }`}>
                            {isSelected && <Check className="h-3 w-3 text-white" strokeWidth={3} />}
                          </div>
                          <span className="text-sm">{student.first_name} {student.last_name}</span>
                          {student.departments?.name && (
                            <span className="ml-auto text-xs text-slate-400 flex-shrink-0">{student.departments.name}</span>
                          )}
                        </button>
                      );
                    }) : (
                      <p className="text-center text-slate-400 text-sm py-6">No hay miembros disponibles</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen de seleccionados */}
              {studentsToPromote.length > 0 && (
                <div className="bg-primary/5 border border-primary/15 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
                    {studentsToPromote.length} {studentsToPromote.length === 1 ? 'miembro' : 'miembros'} a promover
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {studentsToPromote.map(studentId => {
                      const student = students?.find(s => s.id === studentId);
                      return student ? (
                        <span
                          key={student.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold"
                        >
                          {student.first_name} {student.last_name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 pb-6 flex justify-end gap-3">
              <Button
                variant="outline"
                className="rounded-xl border-slate-200 bg-white hover:bg-slate-50 font-bold px-5"
                onClick={() => setIsPromoteModalOpen(false)}
              >
                Cancelar
              </Button>
              <Button
                onClick={promoteStudents}
                disabled={isPromoting || studentsToPromote.length === 0 || !selectedDepartment}
                className="button-gradient rounded-xl font-black px-6 shadow-lg shadow-primary/20 disabled:opacity-50"
              >
                {isPromoting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Promover {studentsToPromote.length > 0 ? `(${studentsToPromote.length})` : ''}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
          <DialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <DialogHeader>
              <DialogTitle>Importar Miembros desde Excel</DialogTitle>
              <DialogDescription>
                Seleccione un archivo .xlsx para importar los miembros.
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
              <DialogTitle>Editar Miembro</DialogTitle>
              <DialogDescription>
                Realice los cambios necesarios en la información del miembro.
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
                            {editModalClasses?.map((className) => (
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
                  <Button type="submit" disabled={isUpdating}>
                    {isUpdating ? (
                      <>
                        <span className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        Guardando...
                      </>
                    ) : (
                      "Guardar"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-primary">Agregar Nuevo Miembro</DialogTitle>
              <DialogDescription>
                Complete el formulario para registrar un nuevo miembro en la congregación.
              </DialogDescription>
            </DialogHeader>
            <AgregarAlumno
              isModal={true}
              onSuccess={() => {
                setIsAddModalOpen(false);
                queryClient.invalidateQueries({ queryKey: ["students", companyId] });
              }}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog open={deleteAlertOpen} onOpenChange={setDeleteAlertOpen}>
          <AlertDialogContent className="w-[95vw] max-w-md sm:max-w-[425px] max-h-[90vh] overflow-y-auto overflow-x-hidden">
            <AlertDialogHeader>
              <AlertDialogTitle>¿Está seguro?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción eliminará al miembro de forma permanente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete}>Eliminar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default ListarAlumnos;