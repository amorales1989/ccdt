import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays } from "date-fns";
import { getAttendance, getDepartmentByName } from "@/lib/api";
import { Download, Search, UserCheck, UserX, Calendar as CalendarIcon, PenSquare, Check, X } from "lucide-react";
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Attendance } from "@/types/database";
import { useToast } from "@/hooks/use-toast";
import { markAttendance } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

const dateRangeOptions = [
  { label: "Hoy", value: "today" },
  { label: "Últimos 7 días", value: "7days" },
  { label: "Últimos 30 días", value: "30days" },
  { label: "Rango personalizado", value: "custom" }
];

const departments = [
  { value: "escuelita_central", label: "Escuelita Central" },
  { value: "pre_adolescentes", label: "Pre-adolescentes" },
  { value: "adolescentes", label: "Adolescentes" },
  { value: "jovenes", label: "Jóvenes" },
  { value: "jovenes_adultos", label: "Jóvenes Adultos" },
  { value: "adultos", label: "Adultos" }
];

const getFullName = (student: any): string => {
  if (!student) return ""; 
  
  return student.last_name 
    ? `${student.first_name} ${student.last_name}` 
    : student.first_name;
};

const HistorialAsistencia = () => {
  const [selectedRange, setSelectedRange] = useState("today");
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { profile } = useAuth();
  const isMobile = useIsMobile();
  const { toast } = useToast();
  
  const [startDateOpen, setStartDateOpen] = useState(false);
  const [endDateOpen, setEndDateOpen] = useState(false);
  const [singleDateOpen, setSingleDateOpen] = useState(false);
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [editDateOpen, setEditDateOpen] = useState(false);
  const [editRecords, setEditRecords] = useState<Attendance[]>([]);
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [allStudents, setAllStudents] = useState<any[]>([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const userDepartment = profile?.departments?.[0];
  const userDepartmentId = profile?.department_id;
  const userClass = profile?.assigned_class;

  const { data: departmentData } = useQuery({
    queryKey: ['department', selectedDepartment],
    queryFn: async () => {
      if (selectedDepartment !== "all") {
        return await getDepartmentByName(selectedDepartment as DepartmentType);
      }
      return null;
    },
    enabled: selectedDepartment !== "all"
  });

  const availableClasses = departmentData?.classes || [];

  useEffect(() => {
    if (!isAdminOrSecretaria && userDepartment) {
      setSelectedDepartment(userDepartment);
      if (userClass) {
        setSelectedClass(userClass);
      }
    }
  }, [isAdminOrSecretaria, userDepartment, userClass]);

  const handleDateRangeChange = (value: string) => {
    setSelectedRange(value);
    const today = new Date();
    
    switch (value) {
      case "today":
        setStartDate(today);
        setEndDate(today);
        setSelectedDate(today);
        break;
      case "7days":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        setSelectedDate(today);
        break;
      case "30days":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        setSelectedDate(today);
        break;
      case "custom":
        // For non-admin/secretaria users, we'll use a single date
        if (!isAdminOrSecretaria) {
          setStartDate(today);
          setEndDate(today);
        }
        break;
    }
  };

  const handleStartDateSelect = (date: Date | undefined) => {
    if (date) {
      setStartDate(date);
      
      if (date > endDate) {
        setEndDate(date);
      }
      
      setStartDateOpen(false);
      
      setTimeout(() => {
        setEndDateOpen(true);
      }, 100);
    }
  };

  const handleEndDateSelect = (date: Date | undefined) => {
    if (date) {
      setEndDate(date);
      
      if (date < startDate) {
        setStartDate(date);
      }
      
      setEndDateOpen(false);
    }
  };

  const handleSingleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setStartDate(date);
      setEndDate(date);
      setSingleDateOpen(false);
    }
  };

  const { data: attendance = [], isLoading: attendanceLoading, refetch: refetchAttendance } = useQuery({
    queryKey: ["attendance", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), selectedDepartment, selectedClass, userDepartmentId, refreshTrigger],
    queryFn: async () => {
      const actualStartDate = startDate > endDate ? endDate : startDate;
      const actualEndDate = endDate < startDate ? startDate : endDate;

      const formattedStartDate = format(actualStartDate, "yyyy-MM-dd");
      const formattedEndDate = format(actualEndDate, "yyyy-MM-dd");
            
      let departmentToUse = "";
      let departmentIdToUse = null;
      
      if (isAdminOrSecretaria) {
        if (selectedDepartment !== "all") {
          const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
          if (departmentData && departmentData.id) {
            departmentIdToUse = departmentData.id;
          }
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      
      console.log("Fetching attendance with params:", {
        formattedStartDate,
        formattedEndDate,
        departmentIdToUse,
        selectedClass
      });
      
      const attendanceData = await getAttendance(
        formattedStartDate, 
        formattedEndDate, 
        "", 
        departmentIdToUse
      );
      
      console.log("Received attendance data:", attendanceData);
      
      if (selectedClass !== "all") {
        return attendanceData.filter(record => record.assigned_class === selectedClass);
      }
      
      return attendanceData;
    },
  });

  const { data: dateAttendance = [], isLoading: dateAttendanceLoading, refetch: refetchDateAttendance } = useQuery({
    queryKey: ["date-attendance", editDate ? format(editDate, "yyyy-MM-dd") : "", userDepartmentId, userClass, selectedDepartment, selectedClass],
    queryFn: async () => {
      if (!editDate) return [];
      
      const formattedDate = format(editDate, "yyyy-MM-dd");
      
      let departmentIdToUse = null;
      
      if (isAdminOrSecretaria && selectedDepartment !== "all") {
        const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
        if (departmentData && departmentData.id) {
          departmentIdToUse = departmentData.id;
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      
      const attendanceData = await getAttendance(formattedDate, formattedDate, "", departmentIdToUse);
      
      if (isAdminOrSecretaria && selectedClass !== "all") {
        return attendanceData.filter(record => record.assigned_class === selectedClass);
      } else if (!isAdminOrSecretaria && userClass) {
        return attendanceData.filter(record => record.assigned_class === userClass);
      }
      
      return attendanceData;
    },
    enabled: isEditMode && !!editDate
  });

  const { data: departmentStudents = [], isLoading: isLoadingDepartmentStudents } = useQuery({
    queryKey: ["students-for-attendance", userDepartmentId, selectedDepartment, selectedClass],
    queryFn: async () => {
      let departmentIdToUse = null;
      
      if (isAdminOrSecretaria && selectedDepartment !== "all") {
        const departmentData = await getDepartmentByName(selectedDepartment as DepartmentType);
        if (departmentData && departmentData.id) {
          departmentIdToUse = departmentData.id;
        }
      } else if (userDepartmentId) {
        departmentIdToUse = userDepartmentId;
      }
      
      if (!departmentIdToUse) return [];
      
      let query = supabase
        .from('students')
        .select('*, departments:department_id(name)')
        .eq('department_id', departmentIdToUse);
      
      if ((isAdminOrSecretaria && selectedClass !== "all") || (!isAdminOrSecretaria && userClass)) {
        const classFilter = (isAdminOrSecretaria && selectedClass !== "all") ? selectedClass : userClass;
        query = query.eq('assigned_class', classFilter);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error("Error fetching students:", error);
        return [];
      }
      
      return data || [];
    },
    enabled: isEditMode && Boolean(userDepartmentId || (isAdminOrSecretaria && selectedDepartment !== "all"))
  });

  useEffect(() => {
    if (isEditMode && departmentStudents.length > 0) {
      setAllStudents(departmentStudents);
    }
  }, [departmentStudents, isEditMode]);

  useEffect(() => {
    if (isEditMode && dateAttendance.length > 0 && allStudents.length > 0) {
      const attendanceMap = new Map();
      dateAttendance.forEach(record => {
        attendanceMap.set(record.student_id, record);
      });
      
      const fullAttendanceRecords = [...dateAttendance];
      
      allStudents.forEach(student => {
        if (!attendanceMap.has(student.id)) {
          const newRecord: Attendance = {
            id: `new-${student.id}`,
            student_id: student.id,
            status: false,
            date: format(editDate, "yyyy-MM-dd"),
            department_id: student.department_id,
            assigned_class: student.assigned_class,
            students: student
          };
          fullAttendanceRecords.push(newRecord);
        }
      });
      
      setEditRecords(fullAttendanceRecords);
    }
  }, [dateAttendance, allStudents, isEditMode, editDate]);

  const handleEditDateSelect = (date: Date | undefined) => {
    if (date) {
      setEditDate(date);
      setEditDateOpen(false);
      refetchDateAttendance();
    }
  };

  const toggleAttendanceStatus = (id: string) => {
    setEditRecords(prev => 
      prev.map(record => 
        record.id === id 
          ? { ...record, status: !record.status } 
          : record
      )
    );
  };

  const saveAttendanceChanges = async () => {
    setSavingAttendance(true);
    try {
      const promises = editRecords.map(record => {
        const isNewRecord = record.id.toString().startsWith('new-');
        
        return markAttendance({
          student_id: record.student_id,
          date: record.date,
          status: record.status,
          department_id: record.department_id || userDepartmentId,
          assigned_class: record.assigned_class,
          ...(record.event_id && { event_id: record.event_id })
        });
      });
      
      await Promise.all(promises);
      
      toast({
        title: "Asistencia actualizada",
        description: "Los cambios han sido guardados exitosamente.",
      });
      
      setIsEditMode(false);
      setRefreshTrigger(prev => prev + 1);
      
      await refetchDateAttendance();
      await refetchAttendance();
    } catch (error) {
      console.error("Error saving attendance changes:", error);
      toast({
        title: "Error",
        description: "No se pudieron guardar los cambios. Por favor, inténtelo nuevamente.",
        variant: "destructive"
      });
    } finally {
      setSavingAttendance(false);
    }
  };

  const filteredAttendance = attendance.filter(record => {
    if (!record.students) return false;

    const matchesSearch = searchQuery === "" || 
      record.students.name?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesSearch;
  });

  const attendanceStats = {
    present: filteredAttendance.filter(record => record.status).length,
    absent: filteredAttendance.filter(record => !record.status).length
  };

  const handleExportToExcel = () => {
    const data = filteredAttendance.map(record => ({
      Nombre: record.students?.name,
      Estado: record.status ? "Presente" : "Ausente",
      Fecha: adjustDateForDisplay(record.date),
      Departamento: record.students?.departments?.name || 'Sin departamento',
      Clase: record.assigned_class || 'Sin asignar'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `asistencia_${format(startDate, "dd-MM-yyyy")}_${format(endDate, "dd-MM-yyyy")}.xlsx`);
  };

  const adjustDateForDisplay = (dateString: string) => {
    const date = new Date(dateString);
    date.setDate(date.getDate() + 1);
    return format(date, "dd/MM/yyyy");
  };

  const enterEditMode = () => {
    setIsEditMode(true);
    setEditDate(new Date());
    setEditDateOpen(true);
  };

  const exitEditMode = () => {
    setIsEditMode(false);
    setEditRecords([]);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          {isEditMode ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Editar Asistencia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Seleccionar Fecha</label>
                  <Popover open={editDateOpen} onOpenChange={setEditDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !editDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {editDate ? format(editDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={editDate}
                        onSelect={handleEditDateSelect}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 pt-4">
                  <Button 
                    variant="outline" 
                    className="w-full" 
                    onClick={exitEditMode}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    className="w-full"
                    onClick={saveAttendanceChanges}
                    disabled={savingAttendance || editRecords.length === 0}
                  >
                    {savingAttendance ? "Guardando..." : "Guardar Cambios"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg md:text-xl">Filtros</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {isAdminOrSecretaria && (
                    <>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Departamento</label>
                        <Select value={selectedDepartment} onValueChange={(value) => {
                          setSelectedDepartment(value);
                          setSelectedClass("all");
                        }}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar departamento" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            {departments.map((dept) => (
                              <SelectItem key={dept.value} value={dept.value}>
                                {dept.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Clase</label>
                        <Select 
                          value={selectedClass} 
                          onValueChange={setSelectedClass}
                          disabled={selectedDepartment === "all"}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Seleccionar clase" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            {availableClasses.map((className) => (
                              <SelectItem key={className} value={className}>
                                {className}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}

                  <div>
                    <label className="text-sm font-medium mb-2 block">Período</label>
                    <Select value={selectedRange} onValueChange={handleDateRangeChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Seleccionar período" />
                      </SelectTrigger>
                      <SelectContent>
                        {dateRangeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedRange === "custom" && (
                    isAdminOrSecretaria ? (
                      <>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
                          <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !startDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {startDate ? format(startDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={startDate}
                                onSelect={handleStartDateSelect}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
                          <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                            <PopoverTrigger asChild>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full justify-start text-left font-normal",
                                  !endDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {endDate ? format(endDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar
                                mode="single"
                                selected={endDate}
                                onSelect={handleEndDateSelect}
                                initialFocus
                                className={cn("p-3 pointer-events-auto")}
                              />
                            </PopoverContent>
                          </Popover>
                        </div>
                      </>
                    ) : (
                      <div>
                        <label className="text-sm font-medium mb-2 block">Fecha</label>
                        <Popover open={singleDateOpen} onOpenChange={setSingleDateOpen}>
                          <PopoverTrigger asChild>
                            <Button
                              variant={"outline"}
                              className={cn(
                                "w-full justify-start text-left font-normal",
                                !selectedDate && "text-muted-foreground"
                              )}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Seleccionar fecha"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={handleSingleDateSelect}
                              initialFocus
                              className={cn("p-3 pointer-events-auto")}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    )
                  )}

                  <div>
                    <label className="text-sm font-medium mb-2 block">Buscar por nombre</label>
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Nombre del alumno"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8"
                        disabled={attendance.length === 0}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="p-4">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <span>Presentes: {isEditMode ? editRecords.filter(r => r.status).length : attendanceStats.present}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-500" />
                <span>Ausentes: {isEditMode ? editRecords.filter(r => !r.status).length : attendanceStats.absent}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg md:text-xl">
              {isEditMode 
                ? `Editar Asistencia del ${format(editDate, "dd/MM/yyyy")}` 
                : isAdminOrSecretaria 
                  ? `Asistencia del ${format(startDate, "dd/MM/yyyy")} al ${format(endDate, "dd/MM/yyyy")}`
                  : selectedRange === "custom"
                    ? `Asistencia del ${format(selectedDate, "dd/MM/yyyy")}`
                    : `Asistencia del ${format(startDate, "dd/MM/yyyy")} al ${format(endDate, "dd/MM/yyyy")}`
              }
            </CardTitle>
            <div className="flex flex-col sm:flex-row w-full sm:w-auto gap-2">
              {!isEditMode && (
                <Button onClick={enterEditMode} className="w-full sm:w-auto">
                  <PenSquare className="mr-2 h-4 w-4" />
                  Editar Asistencia
                </Button>
              )}
              {isAdminOrSecretaria && !isEditMode && (
                <Button onClick={handleExportToExcel} disabled={!filteredAttendance.length} className="w-full sm:w-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Excel
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isEditMode ? (
              isLoadingDepartmentStudents || dateAttendanceLoading ? (
                <p className="text-muted-foreground">Cargando...</p>
              ) : !editRecords?.length ? (
                <p className="text-muted-foreground">No hay registros de asistencia para esta fecha.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {editRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{getFullName(record.students)}</TableCell>
                          <TableCell>
                            <span className={`flex items-center gap-2 ${record.status ? "text-green-500" : "text-red-500"}`}>
                              {record.status ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                              {!isMobile && (record.status ? "Presente" : "Ausente")}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant={record.status ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleAttendanceStatus(record.id)}
                              className="whitespace-nowrap"
                            >
                              {record.status ? (
                                <>
                                  <X className="h-4 w-4" />
                                  {!isMobile && <span className="ml-1">Marcar Ausente</span>}
                                </>
                              ) : (
                                <>
                                  <Check className="h-4 w-4" />
                                  {!isMobile && <span className="ml-1">Marcar Presente</span>}
                                </>
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            ) : (
              attendanceLoading ? (
                <p className="text-muted-foreground">Cargando...</p>
              ) : !filteredAttendance?.length ? (
                <p className="text-muted-foreground">No hay registros de asistencia para este período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Fecha</TableHead>
                        {!isMobile && (
                          <>
                            <TableHead>Departamento</TableHead>
                            <TableHead>Clase</TableHead>
                          </>
                        )}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{getFullName(record.students)}</TableCell>
                          <TableCell>
                            <span className={`flex items-center gap-2 ${record.status ? "text-green-500" : "text-red-500"}`}>
                              {record.status ? (
                                <UserCheck className="h-4 w-4" />
                              ) : (
                                <UserX className="h-4 w-4" />
                              )}
                              {!isMobile && (record.status ? "Presente" : "Ausente")}
                            </span>
                          </TableCell>
                          <TableCell>{adjustDateForDisplay(record.date)}</TableCell>
                          {!isMobile && (
                            <>
                              <TableCell className="capitalize">
                                {record.students?.departments?.name?.replace(/_/g, ' ') || 'Sin departamento'}
                              </TableCell>
                              <TableCell>
                                {record.assigned_class || 'Sin asignar'}
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistorialAsistencia;
