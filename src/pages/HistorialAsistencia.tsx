import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { getAttendance, getDepartmentByName } from "@/lib/api";
import { Download, Search, UserCheck, UserX } from "lucide-react";
import * as XLSX from 'xlsx';
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType } from "@/types/database";

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

const HistorialAsistencia = () => {
  const [selectedRange, setSelectedRange] = useState("today");
  const [startDate, setStartDate] = useState<Date>(startOfDay(new Date()));
  const [endDate, setEndDate] = useState<Date>(endOfDay(new Date()));
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { profile } = useAuth();
  const isMobile = useIsMobile();

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const userDepartment = profile?.departments?.[0];

  const { data: departmentData } = useQuery({
    queryKey: ['department', selectedDepartment],
    queryFn: () => selectedDepartment !== "all" ? getDepartmentByName(selectedDepartment as DepartmentType) : null,
    enabled: selectedDepartment !== "all"
  });

  console.log('Department data:', departmentData);
  const availableClasses = departmentData?.classes || [];

  const handleDateRangeChange = (value: string) => {
    setSelectedRange(value);
    const today = new Date();
    
    switch (value) {
      case "today":
        setStartDate(startOfDay(today));
        setEndDate(endOfDay(today));
        break;
      case "7days":
        setStartDate(subDays(today, 7));
        setEndDate(today);
        break;
      case "30days":
        setStartDate(subDays(today, 30));
        setEndDate(today);
        break;
      case "custom":
        break;
    }
  };

  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendance", format(startDate, "yyyy-MM-dd"), format(endDate, "yyyy-MM-dd"), selectedDepartment, selectedClass],
    queryFn: async () => {
      const formattedStartDate = format(startDate, "yyyy-MM-dd");
      const formattedEndDate = format(endDate, "yyyy-MM-dd");
      console.log("Fetching attendance for date range:", formattedStartDate, "to", formattedEndDate);
      const departmentToUse = isAdminOrSecretaria ? (selectedDepartment === "all" ? "" : selectedDepartment) : userDepartment || "";
      return getAttendance(formattedStartDate, formattedEndDate, departmentToUse);
    },
  });

  const filteredAttendance = attendance.filter(record => {
    if (!record.students) return false;

    const matchesSearch = searchQuery === "" || 
      record.students.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDepartment = selectedDepartment === "all" || 
      record.students.department === selectedDepartment;

    const matchesClass = selectedClass === "all" || 
      (record.students.assigned_class === selectedClass && 
       record.students.department === selectedDepartment);

    return matchesSearch && matchesDepartment && matchesClass;
  });

  const attendanceStats = {
    present: filteredAttendance.filter(record => record.status).length,
    absent: filteredAttendance.filter(record => !record.status).length
  };

  const handleExportToExcel = () => {
    const data = filteredAttendance.map(record => ({
      Nombre: record.students?.name,
      Estado: record.status ? "Presente" : "Ausente",
      Fecha: format(new Date(record.date), "dd/MM/yyyy"),
      Departamento: record.students?.department,
      Clase: record.students?.assigned_class || 'Sin asignar'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `asistencia_${format(startDate, "dd-MM-yyyy")}_${format(endDate, "dd-MM-yyyy")}.xlsx`);
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <div className="grid gap-4 md:gap-6 grid-cols-1 md:grid-cols-[300px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg md:text-xl">Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdminOrSecretaria && (
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
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Clase</label>
                <Select 
                  value={selectedClass} 
                  onValueChange={setSelectedClass}
                  disabled={selectedDepartment === "all" || !availableClasses.length}
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
                <>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
                    <Popover>
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
                          onSelect={(date) => date && setStartDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
                    <Popover>
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
                          onSelect={(date) => date && setEndDate(date)}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </>
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
            </CardContent>
          </Card>

          <Card className="p-4">
            <div className="flex justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-green-500" />
                <span>Presentes: {attendanceStats.present}</span>
              </div>
              <div className="flex items-center gap-2">
                <UserX className="h-5 w-5 text-red-500" />
                <span>Ausentes: {attendanceStats.absent}</span>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <CardTitle className="text-lg md:text-xl">
              Asistencia del {format(startDate, "dd/MM/yyyy")} al {format(endDate, "dd/MM/yyyy")}
            </CardTitle>
            {isAdminOrSecretaria && (
              <Button onClick={handleExportToExcel} disabled={!filteredAttendance.length} className="w-full sm:w-auto">
                <Download className="mr-2 h-4 w-4" />
                Exportar Excel
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
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
                        <TableCell className="font-medium">{record.students?.name}</TableCell>
                        <TableCell>{record.status ? "Presente" : "Ausente"}</TableCell>
                        <TableCell>{format(new Date(record.date), "dd/MM/yyyy")}</TableCell>
                        {!isMobile && (
                          <>
                            <TableCell className="capitalize">
                              {record.students?.department?.replace(/_/g, ' ')}
                            </TableCell>
                            <TableCell>
                              {record.students?.assigned_class || 'Sin asignar'}
                            </TableCell>
                          </>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistorialAsistencia;
