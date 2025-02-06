import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { getStudents } from "@/lib/api";
import { differenceInYears } from "date-fns";
import { Download, MessageCircle, Eye, Edit2, Trash2, Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import * as XLSX from "xlsx";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

const ListarAlumnos = () => {
  const [searchDepartment, setSearchDepartment] = useState<string>("all");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const { profile } = useAuth();
  const isAuthorized = profile?.role === "admin" || profile?.role === "secretaria";

  const { data: students = [], refetch } = useQuery({
    queryKey: ["students", searchDepartment],
    queryFn: () => getStudents(),
    enabled: !!searchDepartment, 
  });

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "-";
    return differenceInYears(new Date(), new Date(birthdate));
  };

  const handleWhatsAppClick = (phone: string | null) => {
    if (!phone) return;
    const whatsappUrl = `https://wa.me/${phone.replace(/\D/g, "")}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleSearch = () => {
    setSearchDepartment(selectedDepartment);
    refetch();
  };

  const filteredStudents = searchDepartment === "all" ? students : students.filter(student => student.department === searchDepartment);

  const maleStudents = filteredStudents.filter(student => student.gender === "masculino");
  const femaleStudents = filteredStudents.filter(student => student.gender === "femenino");

  const exportToExcel = () => {
    const data = filteredStudents.map(student => ({
      Nombre: student.name,
      Edad: calculateAge(student.birthdate),
      Género: student.gender === "masculino" ? "Varón" : "Mujer",
      Departamento: student.department || "No asignado",
      Teléfono: student.phone || "No registrado",
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Alumnos");

    const filename = `alumnos${searchDepartment !== "all" ? `_${searchDepartment}` : ""}_${new Date()
      .toISOString()
      .split("T")[0]}.xlsx`;

    XLSX.writeFile(wb, filename);
  };

  const StudentDetails = ({ student }: { student: typeof students[0] }) => (
    <div className="space-y-2">
      <p><strong>Nombre:</strong> {student.name}</p>
      <p><strong>Edad:</strong> {calculateAge(student.birthdate)}</p>
      <p><strong>Género:</strong> {student.gender === "masculino" ? "Varón" : "Mujer"}</p>
      <p><strong>Departamento:</strong> {student.department || "No asignado"}</p>
      <p><strong>Teléfono:</strong> {student.phone || "No registrado"}</p>
      <p><strong>Dirección:</strong> {student.address || "No registrada"}</p>
      <p><strong>Fecha de nacimiento:</strong> {student.birthdate || "No registrada"}</p>
    </div>
  );

  const StudentTable = ({ students, title }: { students: typeof maleStudents; title: string }) => (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Edad</TableHead>
              <TableHead>Departamento</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map(student => (
              <TableRow key={student.id}>
                <TableCell>{student.name}</TableCell>
                <TableCell>{calculateAge(student.birthdate)}</TableCell>
                <TableCell>{student.department || "No asignado"}</TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleWhatsAppClick(student.phone)}
                      disabled={!student.phone}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>

                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Detalles del Alumno</DialogTitle>
                        </DialogHeader>
                        <StudentDetails student={student} />
                      </DialogContent>
                    </Dialog>

                    {isAuthorized && (
                      <>
                        <Button variant="ghost" size="icon">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );

  return (
    <div className="p-6 space-y-6">
      {isAuthorized && (
      <div className="flex justify-between items-center mb-6">
        <div className="flex gap-4">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Seleccionar departamento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los departamentos</SelectItem>
              <SelectItem value="niños">Niños</SelectItem>
              <SelectItem value="adolescentes">Adolescentes</SelectItem>
              <SelectItem value="jovenes">Jóvenes</SelectItem>
              <SelectItem value="adultos">Adultos</SelectItem>
            </SelectContent>
          </Select>

          <Button onClick={handleSearch}>
            <Search className="mr-2" />
            Buscar
          </Button>
        </div>

        <Button onClick={exportToExcel} variant="outline">
          <Download className="mr-2" />
          Exportar a Excel
        </Button>
      </div>
      )}

      <StudentTable title="Varones" students={maleStudents} />
      <StudentTable title="Mujeres" students={femaleStudents} />
    </div>
  );
};

export default ListarAlumnos;