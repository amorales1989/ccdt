import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Edit, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { StudentSearch } from "@/components/StudentSearch";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const ListarAlumnos = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedClass, setSelectedClass] = useState<string>("all");
  const [departmentId, setDepartmentId] = useState<string | null>(null);
  const [authorizedStudents, setAuthorizedStudents] = useState<Record<string, boolean>>({});
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);

  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";
  const currentDepartment = profile?.departments?.[0];
  const userClass = profile?.assigned_class;

  useEffect(() => {
    const fetchDepartmentId = async () => {
      if (currentDepartment) {
        try {
          const { data, error } = await supabase
            .from("departments")
            .select("id")
            .eq("name", currentDepartment)
            .single();
          
          if (error) {
            console.error("Error fetching department ID:", error);
            return;
          }
          
          if (data) {
            console.log("Found department ID:", data.id, "for department:", currentDepartment);
            setDepartmentId(data.id);
          }
        } catch (error) {
          console.error("Error in fetchDepartmentId:", error);
        }
      }
    };
    
    fetchDepartmentId();
  }, [currentDepartment]);

  useEffect(() => {
    const fetchAuthorizedStudents = async () => {
      if (departmentId) {
        try {
          const { data, error } = await supabase
            .from("student_authorizations")
            .select("student_id")
            .eq("department_id", departmentId);
          
          if (error) {
            console.error("Error fetching authorized students:", error);
            return;
          }
          
          const authStudents: Record<string, boolean> = {};
          if (data) {
            data.forEach((auth: any) => {
              if (auth.student_id) {
                authStudents[auth.student_id] = true;
              }
            });
          }
          
          setAuthorizedStudents(authStudents);
        } catch (error) {
          console.error("Error in fetchAuthorizedStudents:", error);
        }
      }
    };
    
    fetchAuthorizedStudents();
  }, [departmentId]);

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) throw error;
      return data;
    }
  });

  useEffect(() => {
    if (selectedDepartment && selectedDepartment !== "all") {
      const department = departments.find(d => d.id === selectedDepartment);
      setAvailableClasses(department?.classes || []);
      setSelectedClass("all");
    } else {
      setAvailableClasses([]);
      setSelectedClass("all");
    }
  }, [selectedDepartment, departments]);

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["students", selectedDepartment, selectedClass, departmentId, userClass],
    queryFn: async () => {
      console.log("Fetching students for listing...", { departmentId, userClass, selectedDepartment, selectedClass });
      
      let departmentQuery = supabase
        .from("students")
        .select("*, departments:department_id(name, id)")
        .is("deleted_at", null);

      if (!isAdminOrSecretaria) {
        if (!departmentId) {
          console.log("No department ID available");
          return [];
        }
        
        departmentQuery = departmentQuery.eq("department_id", departmentId);
        
        if (userClass) {
          console.log("Filtering by class:", userClass);
          departmentQuery = departmentQuery.eq("assigned_class", userClass);
        }
      } else {
        // Admin/Secretaria logic with department and class filters
        if (selectedDepartment !== "all") {
          departmentQuery = departmentQuery.eq("department_id", selectedDepartment);
        }
        if (selectedClass !== "all") {
          departmentQuery = departmentQuery.eq("assigned_class", selectedClass);
        }
      }

      const { data: departmentStudents, error } = await departmentQuery;
      if (error) {
        console.error("Error fetching students:", error);
        throw error;
      }
      
      let allStudents = [...departmentStudents];
      
      // Add authorized students from other departments (similar to TomarAsistencia)
      if (!isAdminOrSecretaria && departmentId) {
        const { data: authorizedData, error: authError } = await supabase
          .from("student_authorizations")
          .select("*, student:student_id(*)")
          .eq("department_id", departmentId);
        
        if (authError) {
          console.error("Error fetching authorized students:", authError);
        } else if (authorizedData) {
          const existingIds = new Set(departmentStudents.map(s => s.id));
          const authorizedStudents = authorizedData
            .filter((a: any) => a.student && !existingIds.has(a.student.id))
            .map((a: any) => ({
              ...a.student,
              is_authorized: true
            }));
            
          allStudents = [...departmentStudents, ...authorizedStudents];
        }
      }
      
      allStudents.sort((a, b) => {
        const genderA = (a.gender || '').toLowerCase();
        const genderB = (b.gender || '').toLowerCase();
        
        if (genderA !== genderB) {
          if (genderA === "femenino") return -1;
          if (genderB === "femenino") return 1;
          return genderA.localeCompare(genderB);
        }
        
        const firstNameA = (a.first_name || '').toLowerCase();
        const firstNameB = (b.first_name || '').toLowerCase();
        
        if (firstNameA !== firstNameB) {
          return firstNameA.localeCompare(firstNameB);
        }
        
        const lastNameA = (a.last_name || '').toLowerCase();
        const lastNameB = (b.last_name || '').toLowerCase();
        return lastNameA.localeCompare(lastNameB);
      });

      console.log("Fetched students for listing:", allStudents);
      return allStudents;
    },
    enabled: Boolean(profile) && (!isAdminOrSecretaria || Boolean(departmentId)),
  });

  const formatDepartment = (dept: string) => {
    return dept.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const formatBirthdate = (birthdate: string | null) => {
    if (!birthdate) return "";
    
    const parsedDate = parseISO(birthdate);
    
    return format(parsedDate, "dd MMMM yyyy", { locale: es });
  };

  const getFullName = (student: any): string => {
    if (student.last_name) {
      return `${student.first_name} ${student.last_name}`;
    } else {
      return student.first_name;
    }
  };

  const isAuthorizedStudent = (student: any) => {
    return student.is_authorized || authorizedStudents[student.id];
  };

  const filteredStudents = students.filter((student) => {
    const searchLower = searchTerm.toLowerCase();
    const fullName = `${student.first_name} ${student.last_name || ''}`.toLowerCase();
    
    return (
      fullName.includes(searchLower) ||
      (student.phone && student.phone.includes(searchTerm)) ||
      (student.document_number && student.document_number.includes(searchTerm))
    );
  });

  return (
    <div className="p-6 space-y-6">
      <StudentSearch students={students} />
      
      <Card>
        <CardHeader>
          <CardTitle>Lista de Alumnos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre, DNI o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {isAdminOrSecretaria && (
                <>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Departamento" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los departamentos</SelectItem>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id}>
                          {dept.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="w-full sm:w-[200px]">
                      <SelectValue placeholder="Clase" />
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
                </>
              )}
            </div>

            <div className="grid gap-4">
              {isLoading ? (
                <div className="text-center py-8">Cargando alumnos...</div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No se encontraron alumnos
                </div>
              ) : (
                filteredStudents.map((student) => (
                  <Card key={student.id} className={`p-4 ${isAuthorizedStudent(student) ? "bg-green-50" : ""}`}>
                    <div className="flex justify-between items-start">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">
                            {getFullName(student)}
                          </h3>
                          {isAuthorizedStudent(student) && (
                            <Badge variant="outline" className="bg-green-50 text-green-700 flex items-center gap-1">
                              <UserCheck className="h-3 w-3" />
                              Autorizado
                            </Badge>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                          <div>DNI: {student.document_number || "No registrado"}</div>
                          <div>Teléfono: {student.phone || "No registrado"}</div>
                          <div>
                            Departamento: {formatDepartment(student.departments?.name || student.department || "No asignado")}
                          </div>
                          <div>Clase: {student.assigned_class || "No asignada"}</div>
                          <div>Género: {student.gender === "masculino" ? "Masculino" : "Femenino"}</div>
                          {student.birthdate && (
                            <div>Fecha de nacimiento: {formatBirthdate(student.birthdate)}</div>
                          )}
                        </div>
                        {student.address && (
                          <div className="text-sm text-muted-foreground">
                            Dirección: {student.address}
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => navigate(`/editar-alumno/${student.id}`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </Card>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ListarAlumnos;
