
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { MessageSquare, Pencil, Trash2, MoreVertical, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';

type Department = "niños" | "adolescentes" | "jovenes" | "adultos";

const ListarAlumnos = () => {
  const { profile } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(
    profile?.departments?.[0] || null
  );
  const isMobile = useIsMobile();

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", selectedDepartment],
    queryFn: async () => {
      console.log("Fetching students with department filter:", selectedDepartment);
      let query = supabase.from("students").select("*");
      
      if (isAdminOrSecretaria) {
        if (selectedDepartment) {
          query = query.eq("department", selectedDepartment);
        }
      } else {
        if (!profile?.departments?.length) {
          console.log("Usuario sin departamentos asignados");
          return [];
        }
        query = query.eq("department", selectedDepartment || profile.departments[0]);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error("Error fetching students:", error);
        throw error;
      }
      console.log("Fetched students:", data);
      // Ordenar alumnos alfabéticamente por nombre
      return (data || []).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const handleWhatsAppClick = (phone: string) => {
    if (!phone) return;
    const formattedPhone = phone.replace(/\D/g, "");
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "N/A";
    return `${differenceInYears(new Date(), new Date(birthdate))} años`;
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
      Nombre: student.name,
      Departamento: student.department,
      Teléfono: student.phone || '',
      Dirección: student.address || '',
      Género: student.gender,
      'Fecha de Nacimiento': student.birthdate ? format(new Date(student.birthdate), "dd/MM/yyyy") : ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");

    const fileName = `alumnos_${selectedDepartment || 'todos'}_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
    XLSX.writeFile(workbook, fileName);
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
          <span className="ml-2 capitalize">{student.department}</span>
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
          onClick={() => handleWhatsAppClick(student.phone)}
          title="Enviar mensaje de WhatsApp"
        >
          <MessageSquare className="h-4 w-4" />
          {isMobile && <span className="ml-2">WhatsApp</span>}
        </Button>
        {isAdminOrSecretaria && (
          <>
            <Button
              variant="ghost"
              size="icon"
              title="Editar alumno"
            >
              <Pencil className="h-4 w-4" />
              {isMobile && <span className="ml-2">Editar</span>}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="Eliminar alumno"
            >
              <Trash2 className="h-4 w-4" />
              {isMobile && <span className="ml-2">Eliminar</span>}
            </Button>
          </>
        )}
      </>
    );

    if (isMobile) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white">
            <DropdownMenuItem onClick={() => handleWhatsAppClick(student.phone)}>
              <MessageSquare className="h-4 w-4 mr-2" />
              WhatsApp
            </DropdownMenuItem>
            {isAdminOrSecretaria && (
              <>
                <DropdownMenuItem>
                  <Pencil className="h-4 w-4 mr-2" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem className="text-red-600">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return <div className="flex gap-2">{actions}</div>;
  };

  const renderStudentList = (students: any[], title: string) => (
    <Card className="p-4 md:p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto w-full">
      <Table className="w-full">
  <TableBody>
    {students.map((student) => (
      <Collapsible
        key={student.id}
        open={selectedStudent?.id === student.id}
        onOpenChange={() => {
          setSelectedStudent(selectedStudent?.id === student.id ? null : student);
        }}
      >
        <TableRow className="border-b">
          <TableCell className="p-4 text-left min-w-[200px] font-medium">
            <CollapsibleTrigger asChild>
              <button className="hover:underline">{student.name}</button>
            </CollapsibleTrigger>
          </TableCell>
          <TableCell className="p-4 text-center min-w-[80px]">
            {calculateAge(student.birthdate)}
          </TableCell>
          <TableCell className="p-4 text-right min-w-[100px]">
            {student.phone || "No especificado"}
          </TableCell>
          <TableCell className="p-4 text-right">{renderActions(student)}</TableCell>
        </TableRow>
        <CollapsibleContent>
          <TableRow>
            <TableCell colSpan={4} className="p-4">
              {renderStudentDetails(student)}
            </TableCell>
          </TableRow>
        </CollapsibleContent>
      </Collapsible>
    ))}
  </TableBody>
</Table>

      </div>
    </Card>
  );

  const maleStudents = students.filter(student => student.gender === "masculino");
  const femaleStudents = students.filter(student => student.gender === "femenino");

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Lista de Alumnos</h2>
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          {(isAdminOrSecretaria || (profile?.departments && profile.departments.length > 1)) && (
            <Select
              value={selectedDepartment || undefined}
              onValueChange={(value: Department) => setSelectedDepartment(value)}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por departamento" />
              </SelectTrigger>
              <SelectContent>
                {isAdminOrSecretaria ? (
                  <>
                    <SelectItem value="niños">Niños</SelectItem>
                    <SelectItem value="adolescentes">Adolescentes</SelectItem>
                    <SelectItem value="jovenes">Jóvenes</SelectItem>
                    <SelectItem value="adultos">Adultos</SelectItem>
                  </>
                ) : (
                  profile?.departments?.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept.charAt(0).toUpperCase() + dept.slice(1)}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          )}
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
      </div>

      {isLoading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : (
        <>
          {renderStudentList(maleStudents, "Varones")}
          {renderStudentList(femaleStudents, "Mujeres")}
        </>
      )}
    </div>
  );
};

export default ListarAlumnos;
