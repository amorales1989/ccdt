import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { getAttendance } from "@/lib/api";
import { Download } from "lucide-react";
import * as XLSX from 'xlsx';

const HistorialAsistencia = () => {
  const [startDate, setStartDate] = useState<Date | undefined>(new Date());
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");

  // Fetch attendance for the selected date range
  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ["attendance", startDate ? format(startDate, "yyyy-MM-dd") : null, endDate ? format(endDate, "yyyy-MM-dd") : null, selectedDepartment],
    queryFn: async () => {
      if (!startDate || !endDate) return [];
      const formattedStartDate = format(startDate, "yyyy-MM-dd");
      const formattedEndDate = format(endDate, "yyyy-MM-dd");
      console.log("Fetching attendance for date range:", formattedStartDate, "to", formattedEndDate, "department:", selectedDepartment);
      return getAttendance(formattedStartDate, formattedEndDate, selectedDepartment === "all" ? "" : selectedDepartment);
    },
    enabled: !!startDate && !!endDate,
  });

  const handleExportToExcel = () => {
    const data = attendance.map(record => ({
      Nombre: record.students?.name,
      Estado: record.status ? "Presente" : "Ausente",
      Fecha: new Date(record.date).toLocaleDateString(),
      Departamento: record.students?.department
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Asistencia");
    XLSX.writeFile(wb, `asistencia_${format(startDate || new Date(), "dd-MM-yyyy")}_${format(endDate || new Date(), "dd-MM-yyyy")}.xlsx`);
  };

  return (
    <div className="p-6">
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Filtros</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Departamento</label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar departamento" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="niños">Niños</SelectItem>
                    <SelectItem value="adolescentes">Adolescentes</SelectItem>
                    <SelectItem value="jovenes">Jóvenes</SelectItem>
                    <SelectItem value="adultos">Adultos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fecha Inicio</label>
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  className="rounded-md border"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Fecha Fin</label>
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  className="rounded-md border"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              Asistencia del {startDate ? format(startDate, "dd/MM/yyyy") : ""} al {endDate ? format(endDate, "dd/MM/yyyy") : ""}
            </CardTitle>
            <Button onClick={handleExportToExcel} disabled={!attendance.length}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </CardHeader>
          <CardContent>
            {attendanceLoading ? (
              <p className="text-muted-foreground">Cargando...</p>
            ) : !attendance?.length ? (
              <p className="text-muted-foreground">No hay registros de asistencia para este período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Departamento</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendance.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{record.students?.name}</TableCell>
                      <TableCell>{record.status ? "Presente" : "Ausente"}</TableCell>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell className="capitalize">{record.students?.department}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default HistorialAsistencia;