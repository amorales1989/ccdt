
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, Pencil, Trash2, MoreVertical, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import * as XLSX from 'xlsx';
import { DepartmentType, Department } from "@/types/database";

const ListarAlumnos = () => {
  const { profile } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const isMobile = useIsMobile();

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  // Usar departamento y clase del perfil del usuario
  const userDepartment = profile?.departments?.[0] || null;
  const userClass = profile?.assigned_class || null;

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("departments")
        .select("*")
        .order('name');
      
      if (error) throw error;
      return data as Department[];
    },
  });

  // Obtener estudiantes filtrados por el departamento y clase del usuario
  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", userDepartment, userClass],
    queryFn: async () => {
      let query = supabase.from("students").select("*");
      
      // Si el usuario no es admin o secretaria, aplicar filtros
      if (!isAdminOrSecretaria) {
        // Filtrar por departamento del usuario
        if (userDepartment) {
          query = query.eq("department", userDepartment);
          
          // Si el usuario tiene una clase asignada, filtrar también por esa clase
          if (userClass) {
            query = query.eq("assigned_class", userClass);
          }
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      return (data || []).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: Boolean(profile), // Solo hacer la consulta cuando tengamos el perfil
  });

  const handleWhatsAppClick = (phone: string) => {
    if (!phone) return;
    
    // Eliminar todos los caracteres que no sean dígitos
    let formattedPhone = phone.replace(/\D/g, "");
    
    // Verificar si el número ya tiene el código de país
    if (!formattedPhone.startsWith("54")) {
      // Si el número comienza con 0, eliminar ese 0 inicial
      if (formattedPhone.startsWith("0")) {
        formattedPhone = formattedPhone.substring(1);
      }
      
      // Si el número comienza con 15 (prefijo de celular argentino), reacomodarlo
      if (formattedPhone.startsWith("15")) {
        formattedPhone = formattedPhone.substring(2);
        // Agregar el prefijo de Argentina y el 9 para celulares
        formattedPhone = "549" + formattedPhone;
      } else {
        // Si no comienza con 15, agregar el código de país de Argentina
        formattedPhone = "54" + formattedPhone;
      }
    }
    
    // Imprimir el número formateado en la consola para depuración
    console.log("Número de WhatsApp formateado:", formattedPhone);
    
    window.open(`https://wa.me/${formattedPhone}`, "_blank");
  };

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "N/A";
    return `${differenceInYears(new Date(), new Date(birthdate))} años`;
  };

  const handleExport = () => {
    const worksheet = XLSX.utils.json_to_sheet(students.map(student => ({
      Nombre: student.name,
      Departamento: student.department?.replace(/_/g, ' ') || '',
      Clase: student.assigned_class || '',
      Teléfono: student.phone || '',
      Dirección: student.address || '',
      Género: student.gender,
      'Fecha de Nacimiento': student.birthdate ? format(new Date(student.birthdate), "dd/MM/yyyy") : ''
    })));

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Alumnos");

    const fileName = `alumnos_${userDepartment || 'todos'}_${format(new Date(), "dd-MM-yyyy")}.xlsx`;
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
          <span className="ml-2 capitalize">{student.department?.replace(/_/g, ' ') || "No especificado"}</span>
        </div>
        <div>
          <span className="font-medium">Clase:</span>
          <span className="ml-2">{student.assigned_class || "Sin asignar"}</span>
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
        {/* Ahora todos los roles pueden editar y eliminar alumnos de su departamento */}
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
            {/* Menú actualizado para mostrar opciones de edición/eliminación para todos los roles */}
            <DropdownMenuItem>
              <Pencil className="h-4 w-4 mr-2" />
              Editar
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600">
              <Trash2 className="h-4 w-4 mr-2" />
              Eliminar
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    return <div className="flex gap-2">{actions}</div>;
  };

  const renderStudentList = (students: any[], title: string) => (
    <Card className="p-4 md:p-6 mb-6 w-full">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="overflow-x-auto w-full">
        <Table className="w-full">
          <TableBody>
            {students.length > 0 ? (
              students.map((student) => (
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
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={3} className="text-center py-6">
                  No hay alumnos para mostrar en esta categoría
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Lista de Alumnos</h2>
        
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

      {isLoading ? (
        <div className="text-center py-4">Cargando...</div>
      ) : (
        <>
          {userDepartment && !isAdminOrSecretaria && (
            <div className="bg-muted/30 p-4 rounded-lg mb-6">
              <p className="text-sm text-muted-foreground">
                Mostrando alumnos de: <span className="font-medium capitalize">{userDepartment.replace(/_/g, ' ')}</span>
                {userClass && (
                  <> - Clase: <span className="font-medium">{userClass}</span></>
                )}
              </p>
            </div>
          )}
          
          {renderStudentList(students.filter(student => student.gender === "masculino"), "Varones")}
          {renderStudentList(students.filter(student => student.gender === "femenino"), "Mujeres")}
        </>
      )}
    </div>
  );
};

export default ListarAlumnos;
