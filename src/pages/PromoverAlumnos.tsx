import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderUp, ListChecks } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Department, Student } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";

const PromoverAlumnos = () => {
  const { profile } = useAuth();
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | "">("");
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [targetDepartment, setTargetDepartment] = useState<DepartmentType | "">("");
  const [targetDepartmentId, setTargetDepartmentId] = useState<string | null>(null);
  const [targetClass, setTargetClass] = useState<string | null>(null);
  const [selectAll, setSelectAll] = useState(false);
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";

  const userDepartment = profile?.departments?.[0] || null;
  const userClass = profile?.assigned_class || null;

  useEffect(() => {
    if (!isAdminOrSecretaria && userDepartment) {
      setSelectedDepartment(userDepartment);
      
      const fetchDepartmentId = async () => {
        try {
          const { data, error } = await supabase
            .from("departments")
            .select("id")
            .eq("name", userDepartment)
            .single();
          
          if (error) {
            console.error("Error fetching department ID:", error);
            return;
          }
          
          if (data) {
            console.log("Found department ID:", data.id, "for department:", userDepartment);
            setSelectedDepartmentId(data.id);
          }
        } catch (error) {
          console.error("Error in fetchDepartmentId:", error);
        }
      };
      
      fetchDepartmentId();
      
      if (userClass) {
        setSelectedClass(userClass);
      }
    }
  }, [isAdminOrSecretaria, userDepartment, userClass]);

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

  const availableClasses = selectedDepartment 
    ? departments.find(d => d.name === selectedDepartment)?.classes || []
    : [];

  const targetAvailableClasses = targetDepartment 
    ? departments.find(d => d.name === targetDepartment)?.classes || []
    : [];

  const targetDepartmentHasClasses = targetAvailableClasses.length > 0;

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["students", selectedDepartmentId, selectedClass],
    queryFn: async () => {
      if (isAdminOrSecretaria && !selectedDepartmentId) {
        return [];
      }

      let query = supabase.from("students").select("*, departments:department_id(name, id)");
      
      if (selectedDepartmentId) {
        query = query.eq("department_id", selectedDepartmentId);
        
        if (selectedClass) {
          query = query.eq("assigned_class", selectedClass);
        }
      }
      
      const { data, error } = await query;
      if (error) throw error;
      
      console.log("Fetched students:", data);
      
      const processedData = (data || [])
        .map(student => ({
          ...student,
          department: student.departments?.name
        }))
        .sort((a, b) => {
          const nameA = `${a.first_name} ${a.last_name || ''}`;
          const nameB = `${b.first_name} ${b.last_name || ''}`;
          return nameA.localeCompare(nameB);
        }) as Student[];
      
      return processedData;
    },
    enabled: Boolean(profile) && (!isAdminOrSecretaria || Boolean(selectedDepartmentId)),
  });

  useEffect(() => {
    if (selectAll) {
      setSelectedStudents(students.map(student => student.id));
    } else {
      setSelectedStudents([]);
    }
  }, [selectAll, students]);

  const calculateAge = (birthdate: string | null) => {
    if (!birthdate) return "N/A";
    return `${differenceInYears(new Date(), new Date(birthdate))} años`;
  };

  const formatDepartment = (dept?: string) => {
    if (!dept) return "No asignado";
    return dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getFullName = (student: any): string => {
    return student.last_name 
      ? `${student.first_name} ${student.last_name}` 
      : student.first_name;
  };

  const handleDepartmentChange = async (value: string) => {
    const departmentName = value as DepartmentType;
    setSelectedDepartment(departmentName);
    setSelectAll(false);
    setSelectedStudents([]);
    
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id")
        .eq("name", departmentName)
        .single();
      
      if (error) {
        console.error("Error fetching department ID:", error);
        return;
      }
      
      if (data) {
        console.log("Found department ID:", data.id, "for department:", departmentName);
        setSelectedDepartmentId(data.id);
      }
    } catch (error) {
      console.error("Error in handleDepartmentChange:", error);
    }
    
    setSelectedClass(null);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectAll(false);
    setSelectedStudents([]);
  };

  const handleTargetDepartmentChange = async (value: string) => {
    const departmentName = value as DepartmentType;
    setTargetDepartment(departmentName);
    
    try {
      const { data, error } = await supabase
        .from("departments")
        .select("id")
        .eq("name", departmentName)
        .single();
      
      if (error) {
        console.error("Error fetching target department ID:", error);
        return;
      }
      
      if (data) {
        console.log("Found target department ID:", data.id, "for department:", departmentName);
        setTargetDepartmentId(data.id);
      }
    } catch (error) {
      console.error("Error in handleTargetDepartmentChange:", error);
    }
    
    setTargetClass(null);
  };

  const handleTargetClassChange = (value: string) => {
    setTargetClass(value);
  };

  const handleStudentCheckboxChange = (studentId: string) => {
    setSelectedStudents(prev => {
      const isSelected = prev.includes(studentId);
      if (isSelected) {
        return prev.filter(id => id !== studentId);
      } else {
        return [...prev, studentId];
      }
    });
  };

  const handleSelectAllChange = () => {
    setSelectAll(!selectAll);
  };

  const handlePromote = async () => {
    if (!targetDepartmentId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un departamento destino",
        variant: "destructive",
      });
      return;
    }

    if (targetDepartmentHasClasses && !targetClass) {
      toast({
        title: "Error",
        description: "Debes seleccionar una clase destino",
        variant: "destructive",
      });
      return;
    }

    if (selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un alumno",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("students")
        .update({
          department_id: targetDepartmentId,
          department: targetDepartment,
          assigned_class: targetClass || null
        })
        .in("id", selectedStudents);

      if (error) {
        console.error("Error al promover alumnos:", error);
        toast({
          title: "Error",
          description: "No se pudieron promover los alumnos. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: `${selectedStudents.length} alumnos promovidos exitosamente`,
      });

      queryClient.invalidateQueries({ queryKey: ["students"] });
      setSelectedStudents([]);
      setSelectAll(false);
      refetch();
      
    } catch (error) {
      console.error("Error al promover alumnos:", error);
      toast({
        title: "Error",
        description: "No se pudieron promover los alumnos. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const renderFilters = () => {
    if (!isAdminOrSecretaria) return null;

    return (
      <Card className="p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="department-filter">Departamento</Label>
            <Select
              value={selectedDepartment}
              onValueChange={handleDepartmentChange}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona un departamento" />
              </SelectTrigger>
              <SelectContent>
                {departments.map((dept) => (
                  <SelectItem key={dept.id} value={dept.name}>
                    {formatDepartment(dept.name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedDepartment && availableClasses.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="class-filter">Clase</Label>
              <Select
                value={selectedClass || undefined}
                onValueChange={handleClassChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas las clases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las clases</SelectItem>
                  {availableClasses.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="container mx-auto py-6 px-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h2 className="text-xl md:text-2xl font-bold">Promover Alumnos</h2>
      </div>

      {renderFilters()}

      {isAdminOrSecretaria && !selectedDepartmentId ? (
        <Card className="p-6 text-center">
          <FolderUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Selecciona un departamento</h3>
          <p className="text-muted-foreground">
            Por favor, selecciona un departamento para ver los alumnos que puedes promover.
          </p>
        </Card>
      ) : (
        <>
          {!isAdminOrSecretaria && userDepartment && (
            <div className="bg-muted/30 p-4 rounded-lg mb-6">
              <p className="text-sm text-muted-foreground">
                Mostrando alumnos de: <span className="font-medium capitalize">{formatDepartment(userDepartment)}</span>
                {userClass && (
                  <> - Clase: <span className="font-medium">{userClass}</span></>
                )}
              </p>
            </div>
          )}
          
          {isAdminOrSecretaria && selectedDepartment && (
            <div className="bg-muted/30 p-4 rounded-lg mb-6">
              <p className="text-sm text-muted-foreground">
                Mostrando alumnos de: <span className="font-medium capitalize">{formatDepartment(selectedDepartment)}</span>
                {selectedClass && (
                  <> - Clase: <span className="font-medium">{selectedClass}</span></>
                )}
              </p>
            </div>
          )}
          
          <Card className="p-4 md:p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="select-all"
                  checked={selectAll}
                  onCheckedChange={handleSelectAllChange}
                />
                <Label htmlFor="select-all" className="flex items-center gap-1 cursor-pointer">
                  <ListChecks className="h-4 w-4" />
                  Seleccionar todos
                </Label>
              </div>
              <div className="text-sm text-muted-foreground">
                {selectedStudents.length} alumnos seleccionados
              </div>
            </div>

            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Edad</TableHead>
                    <TableHead>Departamento</TableHead>
                    <TableHead>Clase</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        Cargando...
                      </TableCell>
                    </TableRow>
                  ) : students.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4">
                        No hay alumnos para mostrar
                      </TableCell>
                    </TableRow>
                  ) : (
                    students.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStudents.includes(student.id)}
                            onCheckedChange={() => handleStudentCheckboxChange(student.id)}
                          />
                        </TableCell>
                        <TableCell>{getFullName(student)}</TableCell>
                        <TableCell>{calculateAge(student.birthdate)}</TableCell>
                        <TableCell>{formatDepartment(student.department)}</TableCell>
                        <TableCell>{student.assigned_class || "Sin asignar"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <Card className="p-4 md:p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Opciones de Promoción</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Departamento actual</Label>
                  <div className="p-2 border rounded-md bg-muted/30">
                    {formatDepartment(selectedDepartment)}
                  </div>
                </div>
                
                {selectedClass && (
                  <div className="space-y-2">
                    <Label>Clase actual</Label>
                    <div className="p-2 border rounded-md bg-muted/30">
                      {selectedClass}
                    </div>
                  </div>
                )}
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Promover a departamento</Label>
                  <Select
                    value={targetDepartment}
                    onValueChange={handleTargetDepartmentChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona departamento destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.name}>
                          {formatDepartment(dept.name)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {targetDepartmentHasClasses && (
                  <div className="space-y-2">
                    <Label>Promover a clase</Label>
                    <Select
                      value={targetClass || undefined}
                      onValueChange={handleTargetClassChange}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecciona clase destino" />
                      </SelectTrigger>
                      <SelectContent>
                        {targetAvailableClasses.map((className) => (
                          <SelectItem key={className} value={className}>
                            {className}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={handlePromote}
                disabled={
                  selectedStudents.length === 0 || 
                  !targetDepartment || 
                  (targetDepartmentHasClasses && !targetClass)
                }
              >
                <FolderUp className="h-4 w-4 mr-2" />
                Promover {selectedStudents.length} alumnos
              </Button>
            </div>
          </Card>
        </>
      )}
    </div>
  );
};

export default PromoverAlumnos;
