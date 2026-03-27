
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderUp, ListChecks, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Department, Student, StudentAuthorization } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

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
  const [activeTab, setActiveTab] = useState<"promote" | "authorize">("promote");
  const [authorizedStudents, setAuthorizedStudents] = useState<Record<string, string[]>>({});
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

  const { data: studentAuthorizations = [], refetch: refetchAuthorizations } = useQuery({
    queryKey: ["student-authorizations"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("student_authorizations") as any)
        .select("*, student:student_id(id, first_name, last_name), department:department_id(id, name)");

      if (error) throw error;

      const authorizations: Record<string, string[]> = {};
      data?.forEach((auth: any) => {
        if (auth.student && auth.student.id) {
          if (!authorizations[auth.student.id]) {
            authorizations[auth.student.id] = [];
          }
          if (auth.department?.name) {
            authorizations[auth.student.id].push(auth.department.name);
          }
        }
      });

      setAuthorizedStudents(authorizations);
      return data || [];
    }
  });

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

  const { data: authorizedStudentsList = [], refetch: refetchAuthorizedStudents } = useQuery({
    queryKey: ["authorized-students", profile?.department_id],
    queryFn: async () => {
      if (!profile?.department_id) return [];

      const { data, error } = await (supabase
        .from("student_authorizations") as any)
        .select(`
          id, 
          class,
          student:student_id(
            id, 
            first_name, 
            last_name, 
            gender, 
            birthdate,
            department_id, 
            assigned_class,
            departments:department_id(name)
          )
        `)
        .eq("department_id", profile.department_id);

      if (error) throw error;

      return data?.map((auth: any) => ({
        ...auth.student,
        department: auth.student?.departments?.name,
        authorized: true,
        authorized_to: profile?.departments?.[0] || ""
      })) || [];
    },
    enabled: Boolean(profile?.department_id),
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
        description: "Debes seleccionar al menos un miembro",
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
        console.error("Error al promover miembros:", error);
        toast({
          title: "Error",
          description: "No se pudieron promover los miembros. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      const deletePromises = selectedStudents.map(async (studentId) => {
        try {
          const { error: deleteError } = await supabase
            .from("student_authorizations")
            .delete()
            .eq("student_id", studentId)
            .eq("department_id", targetDepartmentId);

          if (deleteError) {
            console.error("Error al eliminar autorización:", deleteError);
          } else {
            console.log(`Eliminada autorización para miembro ${studentId} en departamento ${targetDepartmentId}`);
          }
        } catch (e) {
          console.error("Error al procesar eliminación de autorización:", e);
        }
      });

      await Promise.all(deletePromises);

      toast({
        title: "Éxito",
        description: `${selectedStudents.length} miembros promovidos exitosamente`,
      });

      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["student-authorizations"] });
      setSelectedStudents([]);
      setSelectAll(false);
      refetch();
      refetchAuthorizations();

    } catch (error) {
      console.error("Error al promover miembros:", error);
      toast({
        title: "Error",
        description: "No se pudieron promover los miembros. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleAuthorize = async () => {
    if (!targetDepartmentId) {
      toast({
        title: "Error",
        description: "Debes seleccionar un departamento destino",
        variant: "destructive",
      });
      return;
    }

    if (selectedStudents.length === 0) {
      toast({
        title: "Error",
        description: "Debes seleccionar al menos un miembro",
        variant: "destructive",
      });
      return;
    }

    try {
      const authorizationRecords = selectedStudents.map(studentId => ({
        student_id: studentId,
        department_id: targetDepartmentId,
        class: targetClass || null
      }));

      const { error } = await (supabase
        .from("student_authorizations") as any)
        .upsert(authorizationRecords, {
          onConflict: 'student_id,department_id',
          ignoreDuplicates: false
        });

      if (error) {
        console.error("Error al autorizar miembros:", error);
        toast({
          title: "Error",
          description: "No se pudieron autorizar los miembros. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: `${selectedStudents.length} miembros autorizados exitosamente`,
      });

      refetchAuthorizations();
      setSelectedStudents([]);
      setSelectAll(false);

    } catch (error) {
      console.error("Error al autorizar miembros:", error);
      toast({
        title: "Error",
        description: "No se pudieron autorizar los miembros. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const handleRemoveAuthorization = async (studentId: string, departmentId: string) => {
    try {
      const { error } = await (supabase
        .from("student_authorizations") as any)
        .delete()
        .eq("student_id", studentId)
        .eq("department_id", departmentId);

      if (error) {
        console.error("Error al remover autorización:", error);
        toast({
          title: "Error",
          description: "No se pudo remover la autorización. Intenta nuevamente.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Éxito",
        description: "Autorización removida exitosamente",
      });

      refetchAuthorizations();
      refetchAuthorizedStudents();

    } catch (error) {
      console.error("Error al remover autorización:", error);
      toast({
        title: "Error",
        description: "No se pudo remover la autorización. Intenta nuevamente.",
        variant: "destructive",
      });
    }
  };

  const renderFilters = () => {
    if (!isAdminOrSecretaria) return null;

    return (
      <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-6 mb-6">
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


  const getStudentAuthorizedDepartments = (studentId: string) => {
    return authorizedStudents[studentId] || [];
  };

  return (
    <div className="animate-fade-in space-y-6 pb-8 p-4 md:p-6 max-w-[1600px] mx-auto">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-8 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mb-6">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-purple-400/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-400/20 blur-3xl pointer-events-none"></div>

        <div className="relative z-10 flex items-center gap-4">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
            <FolderUp className="h-8 w-8" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-foreground tracking-tight">Gestión de Miembros</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Promové o autorizá a los miembros a diferentes departamentos.
            </p>
          </div>
        </div>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "promote" | "authorize")} className="w-full">
        <TabsList className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-2xl p-1 h-auto flex flex-wrap sm:flex-nowrap">
          <TabsTrigger value="promote" className="rounded-xl flex-1 py-3 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/40 dark:data-[state=active]:text-purple-300 font-medium">Promover Miembros</TabsTrigger>
          <TabsTrigger value="authorize" className="rounded-xl flex-1 py-3 data-[state=active]:bg-purple-100 data-[state=active]:text-purple-700 dark:data-[state=active]:bg-purple-900/40 dark:data-[state=active]:text-purple-300 font-medium">Autorizar Miembros</TabsTrigger>
        </TabsList>

        <TabsContent value="promote">
          {renderFilters()}

          {isAdminOrSecretaria && !selectedDepartmentId ? (
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-12 text-center">
              <FolderUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecciona un departamento</h3>
              <p className="text-muted-foreground">
                Por favor, selecciona un departamento para ver los miembros que puedes promover.
              </p>
            </Card>
          ) : (
            <>
              {!isAdminOrSecretaria && userDepartment && (
                <div className="bg-muted/30 p-4 rounded-lg mb-6">
                  <p className="text-sm text-muted-foreground">
                    Mostrando miembros de: <span className="font-medium capitalize">{formatDepartment(userDepartment)}</span>
                    {userClass && (
                      <> - Clase: <span className="font-medium">{userClass}</span></>
                    )}
                  </p>
                </div>
              )}

              {isAdminOrSecretaria && selectedDepartment && (
                <div className="bg-muted/30 p-4 rounded-lg mb-6">
                  <p className="text-sm text-muted-foreground">
                    Mostrando miembros de: <span className="font-medium capitalize">{formatDepartment(selectedDepartment)}</span>
                    {selectedClass && (
                      <> - Clase: <span className="font-medium">{selectedClass}</span></>
                    )}
                  </p>
                </div>
              )}

              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-6 mb-6 overflow-hidden">
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
                    {selectedStudents.length} miembros seleccionados
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
                        <TableHead>Autorizado en</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            Cargando...
                          </TableCell>
                        </TableRow>
                      ) : students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No hay miembros para mostrar
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
                            <TableCell>
                              {getStudentAuthorizedDepartments(student.id).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {getStudentAuthorizedDepartments(student.id).map(dept => (
                                    <Badge key={dept} variant="outline" className="bg-green-50">
                                      {formatDepartment(dept)}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "Ninguno"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-6 mb-6">
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

                <div className="mt-8 flex justify-end">
                  <Button
                    onClick={handlePromote}
                    disabled={
                      selectedStudents.length === 0 ||
                      !targetDepartment ||
                      (targetDepartmentHasClasses && !targetClass)
                    }
                    className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl px-6"
                  >
                    <FolderUp className="h-5 w-5 mr-2" />
                    Promover {selectedStudents.length} {selectedStudents.length === 1 ? 'miembro' : 'miembros'}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="authorize">
          {renderFilters()}

          {isAdminOrSecretaria && !selectedDepartmentId ? (
            <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-12 text-center">
              <UserCheck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Selecciona un departamento</h3>
              <p className="text-muted-foreground">
                Por favor, selecciona un departamento para ver los miembros que puedes autorizar.
              </p>
            </Card>
          ) : (
            <>
              <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-6 mb-6 overflow-hidden">
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="select-all-auth"
                      checked={selectAll}
                      onCheckedChange={handleSelectAllChange}
                    />
                    <Label htmlFor="select-all-auth" className="flex items-center gap-1 cursor-pointer">
                      <ListChecks className="h-4 w-4" />
                      Seleccionar todos
                    </Label>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedStudents.length} miembros seleccionados
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
                        <TableHead>Autorizado en</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {isLoading ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            Cargando...
                          </TableCell>
                        </TableRow>
                      ) : students.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-4">
                            No hay miembros para mostrar
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
                            <TableCell>
                              {getStudentAuthorizedDepartments(student.id).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {getStudentAuthorizedDepartments(student.id).map(dept => (
                                    <Badge key={dept} variant="outline" className="bg-green-50 flex items-center gap-1">
                                      {formatDepartment(dept)}
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-4 w-4 rounded-full"
                                        onClick={async () => {
                                          const deptObj = departments.find(d => d.name === dept);
                                          if (deptObj) {
                                            await handleRemoveAuthorization(student.id, deptObj.id);
                                          }
                                        }}
                                      >
                                        <span className="text-xs">×</span>
                                      </Button>
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                "Ninguno"
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

              <Card className="p-4 md:p-6 mb-6">
                <h3 className="text-lg font-semibold mb-4">Opciones de Autorización</h3>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Autorizar para departamento</Label>
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
                      <Label>Clase específica (opcional)</Label>
                      <Select
                        value={targetClass || undefined}
                        onValueChange={handleTargetClassChange}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Todas las clases" />
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

                  <div className="mt-8 flex justify-end">
                    <Button
                      onClick={handleAuthorize}
                      disabled={selectedStudents.length === 0 || !targetDepartment}
                      className="w-full sm:w-auto bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl px-6"
                    >
                      <UserCheck className="h-5 w-5 mr-2" />
                      Autorizar {selectedStudents.length} {selectedStudents.length === 1 ? 'miembro' : 'miembros'}
                    </Button>
                  </div>
                </div>
              </Card>

              {!isAdminOrSecretaria && (
                <Card className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-md rounded-3xl p-6 mb-6 overflow-hidden">
                  <h3 className="text-lg font-semibold mb-4">Miembros autorizados en tu departamento</h3>

                  <div className="overflow-x-auto">
                    <Table className="w-full">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nombre</TableHead>
                          <TableHead>Edad</TableHead>
                          <TableHead>Departamento Original</TableHead>
                          <TableHead>Clase Original</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {authorizedStudentsList.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-4">
                              No hay miembros autorizados en tu departamento
                            </TableCell>
                          </TableRow>
                        ) : (
                          authorizedStudentsList.map((student: any) => (
                            <TableRow key={student.id} className="bg-green-50">
                              <TableCell className="font-medium flex items-center gap-2">
                                <UserCheck className="h-4 w-4 text-green-600" />
                                {getFullName(student)}
                              </TableCell>
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
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PromoverAlumnos;
