import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { MessageSquare, Pencil, Trash2, MoreVertical, Download, Upload, FileDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/components/ui/use-toast";
import * as XLSX from 'xlsx';
import { createStudent } from "@/lib/api";
import { Student } from "@/types/database";

const ListarAlumnos = () => {
  const { profile } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(
    profile?.departments?.[0] || null
  );
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

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
      return (data || []).sort((a, b) => a.name.localeCompare(b.name));
    },
  });

  const importMutation = useMutation({
    mutationFn: async (students: Omit<Student, "id" | "created_at" | "updated_at">[]) => {
      const results = await Promise.all(
        students.map(student => createStudent(student))
      );
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      toast({
        title: "Éxito",
        description: "Los alumnos han sido importados correctamente",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Hubo un error al importar los alumnos. Por favor verifica el formato del archivo.",
        variant: "destructive",
      });
      console.error("Error importing students:", error);
    },
  });

  const handleDownloadTemplate = () => {
    const template = [{
      Nombre: '',
      Departamento: 'escuelita_central',
      Teléfono: '',
      Dirección: '',
      Género: 'masculino',
      'Fecha de Nacimiento': 'DD/MM/YYYY',
      Clase: ''
    }];

    const worksheet = XLSX.utils.json_to_sheet(template);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
    XLSX.writeFile(workbook, "plantilla_alumnos.xlsx");
  };

  const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(firstSheet) as any[];

        const students = jsonData.map(row => ({
          name: row.Nombre,
          department: row.Departamento,
          phone: row.Teléfono,
          address: row.Dirección,
          gender: row.Género.toLowerCase(),
          birthdate: row['Fecha de Nacimiento'] ? format(new Date(row['Fecha de Nacimiento']), 'yyyy-MM-dd') : undefined,
          assigned_class: row.Clase || undefined
        }));

        await importMutation.mutateAsync(students);
      } catch (error) {
        toast({
          title: "Error",
          description: "Error al procesar el archivo. Asegúrate de usar la plantilla correcta.",
          variant: "destructive",
        });
        console.error("Error processing Excel:", error);
      }
    };
    reader.readAsArrayBuffer(file);
  };

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
      'Fecha de Nacimiento': student.birthdate ? format(new Date(student.birthdate), "dd/MM/yyyy") : '',
      Clase: student.assigned_class || ''
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
    <Card className="p-4 md:p-6 mb-6 w-full">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {isAdminOrSecretaria && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2"
            >
              <FileDown className="h-4 w-4" />
              {!isMobile && "Descargar Plantilla"}
            </Button>
            <label className="cursor-pointer">
              <Button
                variant="outline"
                className="flex items-center gap-2"
                asChild
              >
                <div>
                  <Upload className="h-4 w-4" />
                  {!isMobile && "Importar Excel"}
                </div>
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
              />
            </label>
            <Button
              variant="outline"
              onClick={handleExport}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {!isMobile && "Exportar Lista"}
            </Button>
          </div>
        )}
      </div>
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
                <TableRow>
                  <TableCell className="p-0 w-full">
                    <div className="grid grid-cols-[1fr,auto,auto] items-center gap-4 p-4 w-full">
                      <div className="min-w-[150px]">
                        <CollapsibleTrigger asChild>
                          <button className="font-medium hover:underline text-left w-full">
                            {student.name}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                      <div className="text-muted-foreground text-right whitespace-nowrap">
                        {calculateAge(student.birthdate)}
                      </div>
                      <div className="flex items-center justify-end gap-2 shrink-0">
                        <span className="text-muted-foreground text-right hidden md:block whitespace-nowrap">
                          {student.phone || "No especificado"}
                        </span>
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
              onValueChange={(value: string) => setSelectedDepartment(value)}
            >
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="Filtrar por departamento" />
              </SelectTrigger>
              <SelectContent>
                {isAdminOrSecretaria ? (
                  <>
                    <SelectItem value="escuelita_central">Escuelita Central</SelectItem>
                    <SelectItem value="pre_adolescentes">Pre Adolescentes</SelectItem>
                    <SelectItem value="adolescentes">Adolescentes</SelectItem>
                    <SelectItem value="jovenes">Jóvenes</SelectItem>
                    <SelectItem value="jovenes_adultos">Jóvenes Adultos</SelectItem>
                    <SelectItem value="adultos">Adultos</SelectItem>
                  </>
                ) : (
                  profile?.departments?.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
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
