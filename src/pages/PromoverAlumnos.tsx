
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { FolderUp, ListChecks, UserCheck, HelpCircle } from "lucide-react";
import { TourGuide } from "@/components/TourGuide";
import type { Step } from "react-joyride";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInYears } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { DepartmentType, Department, Student, StudentAuthorization } from "@/types/database";
import { toast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { CustomTabs } from "@/components/CustomTabs";
import { Badge } from "@/components/ui/badge";
import { getCompany, getStudents } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { useDepartments } from "@/hooks/useDepartments";
import { DepartmentSelect } from "@/components/DepartmentSelect";
import { ALL_VALUE } from "@/lib/departments";
import { ClassSelect } from "@/components/ClassSelect";
import { DEFAULT_PERMISSIONS } from "@/lib/rolePermissions";

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
  const [runTour, setRunTour] = useState<boolean | undefined>(undefined);
  const tourSteps: Step[] = [
    { target: '[data-tour="prom-header"]', content: "Acá podés promover miembros a otro departamento o autorizarlos para visitar otra clase.", disableBeacon: true },
    { target: '[data-tour="prom-tabs"]', content: "Cambiá entre Promover (cambio definitivo de departamento) y Autorizar (permiso temporal)." },
    { target: '[data-tour="prom-content"]', content: "Seleccioná los miembros y luego elegí el departamento/clase destino. Confirmás al final." },
  ];
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const isAdminOrSecretaria = profile?.role === "admin" || profile?.role === "secretaria";
  const isDirectorOrVice = profile?.role === "director" || profile?.role === "vicedirector";
  const isDirectorGeneral = profile?.role === "director_general";
  const canFilterOrigin = isAdminOrSecretaria || isDirectorOrVice || isDirectorGeneral;

  const { data: company } = useQuery({
    queryKey: ["company", getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId()),
    staleTime: 5 * 60 * 1000,
  });
  const role = profile?.role || '';
  const savedPerms = (company as any)?.role_permissions?.[role];
  // Misma clave que oculta "Promover Miembros" del menú (Configuración › Permisos):
  // si está oculta, tampoco debe poder accederse por URL directa.
  const canPromote = savedPerms && 'menu_promover' in savedPerms
    ? savedPerms.menu_promover !== false
    : DEFAULT_PERMISSIONS[role]?.menu_promover !== false;

  const userDepartment = profile?.departments?.[0] || null;
  const userClass = profile?.assigned_class || null;

  const { getByName } = useDepartments({ scoped: true });
  const userDepartmentId = getByName(userDepartment)?.id ?? null;

  useEffect(() => {
    if (!isAdminOrSecretaria && userDepartment) {
      setSelectedDepartment(userDepartment);
      setSelectedDepartmentId(userDepartmentId);

      if (userClass) {
        setSelectedClass(userClass);
      } else if (isDirectorOrVice) {
        setSelectedClass(ALL_VALUE);
      }
    }
  }, [isAdminOrSecretaria, userDepartment, userDepartmentId, userClass, isDirectorOrVice]);

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

  const availableClasses = selectedDepartment ? getByName(selectedDepartment)?.classes || [] : [];

  const targetAvailableClasses = targetDepartment ? getByName(targetDepartment)?.classes || [] : [];

  const targetDepartmentHasClasses = targetAvailableClasses.length > 0;

  const { data: students = [], isLoading, refetch } = useQuery({
    queryKey: ["students", selectedDepartmentId, selectedClass],
    queryFn: async () => {
      if (!selectedDepartmentId) {
        return [];
      }

      // GET /api/students -> SP get_students (filtra y arma el listado en la DB)
      const data = await getStudents({
        department_id: selectedDepartmentId,
        assigned_class: selectedClass || ALL_VALUE,
      });

      return ([...(data || [])] as Student[]).sort((a, b) => {
        const nameA = `${a.first_name} ${a.last_name || ''}`;
        const nameB = `${b.first_name} ${b.last_name || ''}`;
        return nameA.localeCompare(nameB);
      });
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
            deleted_at,
            departments:department_id(name)
          )
        `)
        .eq("department_id", profile.department_id);

      if (error) throw error;

      return (data || [])
        .filter((auth: any) => auth.student && !auth.student.deleted_at)
        .map((auth: any) => ({
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

  const handleDepartmentChange = (value: string, department?: Department) => {
    setSelectedDepartment(value as DepartmentType);
    setSelectedDepartmentId(department?.id ?? null);
    setSelectAll(false);
    setSelectedStudents([]);
    setSelectedClass(ALL_VALUE);
  };

  const handleClassChange = (value: string) => {
    setSelectedClass(value);
    setSelectAll(false);
    setSelectedStudents([]);
  };

  const handleTargetDepartmentChange = (value: string, department?: Department) => {
    setTargetDepartment(value as DepartmentType);
    setTargetDepartmentId(department?.id ?? null);
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


  const getStudentAuthorizedDepartments = (studentId: string) => {
    return authorizedStudents[studentId] || [];
  };

  if (!canPromote) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="glass-card p-8 text-center max-w-sm animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-4">
            <UserCheck className="h-8 w-8 text-primary" />
          </div>
          <h3 className="font-bold text-foreground mb-2">Acceso restringido</h3>
          <p className="text-sm text-muted-foreground">No tenés permisos para promover miembros. Contactá al administrador.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto animate-fade-in space-y-6">

        <TourGuide tourKey="promover_alumnos" steps={tourSteps} run={runTour} onClose={() => setRunTour(false)} />
        {/* Header */}
        <div data-tour="prom-header" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Gestión de Miembros</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
              Promové o autorizá a los miembros a diferentes departamentos.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="w-full" data-tour="prom-content">
          <div data-tour="prom-tabs"><CustomTabs
            value={activeTab}
            onChange={(value) => setActiveTab(value as "promote" | "authorize")}
            options={[
              { value: "promote", label: "Promover", icon: FolderUp },
              { value: "authorize", label: "Autorizar", icon: UserCheck }
            ]}
            className="mb-6 w-full sm:w-fit mx-0"
          /></div>

          {/* ============ TAB PROMOVER ============ */}
          {activeTab === "promote" && (
            <div className="space-y-5">

              {/* Filtros de origen */}
              {canFilterOrigin && (
                <div className="glass-card p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-4 flex items-center gap-2">
                    <ListChecks className="h-3.5 w-3.5" /> Departamento de origen
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</label>
                      <DepartmentSelect
                        value={selectedDepartment}
                        onChange={handleDepartmentChange}
                        scoped
                        disabled={!isAdminOrSecretaria && !isDirectorGeneral}
                        className="rounded-xl bg-slate-50 border-slate-200 h-11"
                        contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    {selectedDepartment && availableClasses.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clase</label>
                        <ClassSelect
                          classes={availableClasses}
                          value={selectedClass}
                          onChange={handleClassChange}
                          includeAll
                          placeholder="Todas las clases"
                          className="rounded-xl bg-slate-50 border-slate-200 h-11"
                          contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canFilterOrigin && !selectedDepartmentId ? (
                <div className="glass-card p-12 text-center">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <FolderUp className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-1">Seleccioná un departamento</h3>
                  <p className="text-slate-400 text-sm">Elegí el departamento de origen para ver los miembros disponibles.</p>
                </div>
              ) : (
                <>
                  {/* Contexto del filtro activo */}
                  {((!canFilterOrigin && userDepartment) || (canFilterOrigin && selectedDepartment)) && (
                    <div className="flex items-center gap-2 px-1">
                      <span className="text-xs text-slate-500 font-medium">Mostrando miembros de:</span>
                      <span className="px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-black">
                        {formatDepartment(canFilterOrigin ? selectedDepartment : userDepartment)}
                      </span>
                      {(canFilterOrigin ? selectedClass : userClass) && (
                        <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                          Clase: {(canFilterOrigin ? selectedClass : userClass) === ALL_VALUE ? "Todas las clases" : (canFilterOrigin ? selectedClass : userClass)}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Tabla de miembros */}
                  <div className="glass-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all"
                          checked={selectAll}
                          onCheckedChange={handleSelectAllChange}
                          className="rounded-md"
                        />
                        <Label htmlFor="select-all" className="text-xs font-black uppercase tracking-[0.15em] text-slate-500 cursor-pointer flex items-center gap-1.5">
                          <ListChecks className="h-3.5 w-3.5 text-primary" />
                          Seleccionar todos
                        </Label>
                        <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-500 border-slate-200 font-bold px-2 py-0.5 text-[10px]">
                          {students.length} miembros
                        </Badge>
                      </div>
                      {selectedStudents.length > 0 && (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {selectedStudents.length} seleccionados
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="font-bold text-slate-600 dark:text-slate-400">Nombre</TableHead>
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Edad</TableHead>}
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Departamento</TableHead>}
                            <TableHead className="font-bold text-slate-600 dark:text-slate-400">Clase</TableHead>
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Autorizado en</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-20">
                                <LoadingOverlay message="Cargando miembros..." />
                              </TableCell>
                            </TableRow>
                          ) : students.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-400">No hay miembros para mostrar</TableCell>
                            </TableRow>
                          ) : (
                            students.map((student) => (
                              <TableRow
                                key={student.id}
                                className={`transition-colors hover:bg-primary/5 cursor-pointer ${selectedStudents.includes(student.id) ? 'bg-primary/5' : ''}`}
                                onClick={() => handleStudentCheckboxChange(student.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedStudents.includes(student.id)}
                                    onCheckedChange={() => handleStudentCheckboxChange(student.id)}
                                    className="rounded-md"
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-slate-800 dark:text-slate-200">{getFullName(student)}</TableCell>
                                {!isMobile && <TableCell className="text-slate-500">{calculateAge(student.birthdate)}</TableCell>}
                                {!isMobile && <TableCell className="text-slate-500">{formatDepartment(student.department)}</TableCell>}
                                <TableCell className="text-slate-500">{student.assigned_class || <span className="text-slate-300 italic text-xs">Sin asignar</span>}</TableCell>
                                {!isMobile && (
                                  <TableCell>
                                    {getStudentAuthorizedDepartments(student.id).length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {getStudentAuthorizedDepartments(student.id).map(dept => (
                                          <Badge key={dept} className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                            {formatDepartment(dept)}
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 italic text-xs">Ninguno</span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Panel de promoción */}
                  <div className="glass-card p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-4 flex items-center gap-2">
                      <FolderUp className="h-3.5 w-3.5" /> Opciones de Promoción
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Origen */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Departamento actual</label>
                          <div className="h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-slate-600 text-sm font-medium">
                            {formatDepartment(selectedDepartment) || <span className="italic text-slate-300">Sin seleccionar</span>}
                          </div>
                        </div>
                        {selectedClass && (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Clase actual</label>
                            <div className="h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 flex items-center text-slate-600 text-sm font-medium">
                              {selectedClass}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Destino */}
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promover a departamento</label>
                          <DepartmentSelect
                            value={targetDepartment}
                            onChange={handleTargetDepartmentChange}
                            scoped
                            placeholder="Selecciona departamento destino"
                            className="rounded-xl bg-slate-50 border-slate-200 h-11"
                            contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                          />
                        </div>
                        {targetDepartmentHasClasses && (
                          <div className="space-y-1">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promover a clase</label>
                            <ClassSelect
                              classes={targetAvailableClasses}
                              value={targetClass}
                              onChange={handleTargetClassChange}
                              placeholder="Selecciona clase destino"
                              className="rounded-xl bg-slate-50 border-slate-200 h-11"
                              contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handlePromote}
                        disabled={selectedStudents.length === 0 || !targetDepartment || (targetDepartmentHasClasses && !targetClass)}
                        className="button-gradient rounded-xl font-black px-6 h-11 shadow-lg shadow-primary/20 disabled:opacity-50"
                      >
                        <FolderUp className="h-4 w-4 mr-2" />
                        Promover {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ============ TAB AUTORIZAR ============ */}
          {activeTab === "authorize" && (
            <div className="space-y-5">

              {/* Filtros de origen */}
              {canFilterOrigin && (
                <div className="glass-card p-5">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-4 flex items-center gap-2">
                    <ListChecks className="h-3.5 w-3.5" /> Departamento de origen
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Departamento</label>
                      <DepartmentSelect
                        value={selectedDepartment}
                        onChange={handleDepartmentChange}
                        scoped
                        disabled={!isAdminOrSecretaria && !isDirectorGeneral}
                        className="rounded-xl bg-slate-50 border-slate-200 h-11"
                        contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                      />
                    </div>
                    {selectedDepartment && availableClasses.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clase</label>
                        <ClassSelect
                          classes={availableClasses}
                          value={selectedClass}
                          onChange={handleClassChange}
                          includeAll
                          placeholder="Todas las clases"
                          className="rounded-xl bg-slate-50 border-slate-200 h-11"
                          contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {canFilterOrigin && !selectedDepartmentId ? (
                <div className="glass-card p-12 text-center">
                  <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl p-4 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                    <UserCheck className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-black text-slate-700 dark:text-slate-300 mb-1">Seleccioná un departamento</h3>
                  <p className="text-slate-400 text-sm">Elegí el departamento de origen para ver los miembros disponibles.</p>
                </div>
              ) : (
                <>
                  {/* Tabla de miembros para autorizar */}
                  <div className="glass-card overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="select-all-auth"
                          checked={selectAll}
                          onCheckedChange={handleSelectAllChange}
                          className="rounded-md"
                        />
                        <Label htmlFor="select-all-auth" className="text-xs font-black uppercase tracking-[0.15em] text-slate-500 cursor-pointer flex items-center gap-1.5">
                          <ListChecks className="h-3.5 w-3.5 text-primary" />
                          Seleccionar todos
                        </Label>
                        <Badge variant="outline" className="ml-2 bg-slate-50 text-slate-500 border-slate-200 font-bold px-2 py-0.5 text-[10px]">
                          {students.length} miembros
                        </Badge>
                      </div>
                      {selectedStudents.length > 0 && (
                        <span className="text-xs font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-full">
                          {selectedStudents.length} seleccionados
                        </span>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-slate-50/50 dark:bg-slate-800/50 hover:bg-slate-50/50">
                            <TableHead className="w-12"></TableHead>
                            <TableHead className="font-bold text-slate-600 dark:text-slate-400">Nombre</TableHead>
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Edad</TableHead>}
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Departamento</TableHead>}
                            <TableHead className="font-bold text-slate-600 dark:text-slate-400">Clase</TableHead>
                            {!isMobile && <TableHead className="font-bold text-slate-600 dark:text-slate-400">Autorizado en</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {isLoading ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-400">Cargando miembros...</TableCell>
                            </TableRow>
                          ) : students.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-slate-400">No hay miembros para mostrar</TableCell>
                            </TableRow>
                          ) : (
                            students.map((student) => (
                              <TableRow
                                key={student.id}
                                className={`transition-colors hover:bg-primary/5 cursor-pointer ${selectedStudents.includes(student.id) ? 'bg-primary/5' : ''}`}
                                onClick={() => handleStudentCheckboxChange(student.id)}
                              >
                                <TableCell onClick={(e) => e.stopPropagation()}>
                                  <Checkbox
                                    checked={selectedStudents.includes(student.id)}
                                    onCheckedChange={() => handleStudentCheckboxChange(student.id)}
                                    className="rounded-md"
                                  />
                                </TableCell>
                                <TableCell className="font-medium text-slate-800 dark:text-slate-200">{getFullName(student)}</TableCell>
                                {!isMobile && <TableCell className="text-slate-500">{calculateAge(student.birthdate)}</TableCell>}
                                {!isMobile && <TableCell className="text-slate-500">{formatDepartment(student.department)}</TableCell>}
                                <TableCell className="text-slate-500">{student.assigned_class || <span className="text-slate-300 italic text-xs">Sin asignar</span>}</TableCell>
                                {!isMobile && (
                                  <TableCell>
                                    {getStudentAuthorizedDepartments(student.id).length > 0 ? (
                                      <div className="flex flex-wrap gap-1">
                                        {getStudentAuthorizedDepartments(student.id).map(dept => (
                                          <Badge
                                            key={dept}
                                            className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold flex items-center gap-1 pr-1"
                                          >
                                            {formatDepartment(dept)}
                                            <button
                                              className="ml-0.5 hover:text-red-500 transition-colors"
                                              onClick={async (e) => {
                                                e.stopPropagation();
                                                const deptObj = departments.find(d => d.name === dept);
                                                if (deptObj) await handleRemoveAuthorization(student.id, deptObj.id);
                                              }}
                                            >
                                              ×
                                            </button>
                                          </Badge>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="text-slate-300 italic text-xs">Ninguno</span>
                                    )}
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Panel de autorización */}
                  <div className="glass-card p-5">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-primary mb-4 flex items-center gap-2">
                      <UserCheck className="h-3.5 w-3.5" /> Opciones de Autorización
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Autorizar para departamento</label>
                        <DepartmentSelect
                          value={targetDepartment}
                          onChange={handleTargetDepartmentChange}
                          scoped
                          placeholder="Selecciona departamento destino"
                          className="rounded-xl bg-slate-50 border-slate-200 h-11"
                          contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                        />
                      </div>
                      {targetDepartmentHasClasses && (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clase específica (opcional)</label>
                          <ClassSelect
                            classes={targetAvailableClasses}
                            value={targetClass}
                            onChange={handleTargetClassChange}
                            placeholder="Todas las clases"
                            className="rounded-xl bg-slate-50 border-slate-200 h-11"
                            contentClassName="rounded-xl border-slate-200 dark:border-slate-800"
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-6 flex justify-end">
                      <Button
                        onClick={handleAuthorize}
                        disabled={selectedStudents.length === 0 || !targetDepartment}
                        className="button-gradient rounded-xl font-black px-6 h-11 shadow-lg shadow-primary/20 disabled:opacity-50"
                      >
                        <UserCheck className="h-4 w-4 mr-2" />
                        Autorizar {selectedStudents.length > 0 ? `(${selectedStudents.length})` : ''}
                      </Button>
                    </div>
                  </div>

                  {/* Tabla de miembros ya autorizados (solo no admin) */}
                  {!isAdminOrSecretaria && (
                    <div className="glass-card overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-primary flex items-center gap-2">
                          <UserCheck className="h-3.5 w-3.5" /> Miembros autorizados en tu departamento
                        </p>
                        <Badge variant="outline" className="bg-slate-50 text-slate-500 border-slate-200 font-bold px-2 py-0.5 text-[10px]">
                          {authorizedStudentsList.length} miembros
                        </Badge>
                      </div>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                              <TableHead className="font-bold text-slate-600">Nombre</TableHead>
                              <TableHead className="font-bold text-slate-600">Edad</TableHead>
                              <TableHead className="font-bold text-slate-600">Departamento Original</TableHead>
                              <TableHead className="font-bold text-slate-600">Clase Original</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {authorizedStudentsList.length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center py-8 text-slate-400">
                                  No hay miembros autorizados en tu departamento
                                </TableCell>
                              </TableRow>
                            ) : (
                              authorizedStudentsList.map((student: any) => (
                                <TableRow key={student.id} className="hover:bg-primary/5 transition-colors">
                                  <TableCell className="font-medium text-slate-800 dark:text-slate-200 flex items-center gap-2">
                                    <UserCheck className="h-4 w-4 text-emerald-500" />
                                    {getFullName(student)}
                                  </TableCell>
                                  <TableCell className="text-slate-500">{calculateAge(student.birthdate)}</TableCell>
                                  <TableCell className="text-slate-500">{formatDepartment(student.department)}</TableCell>
                                  <TableCell className="text-slate-500">{student.assigned_class || <span className="italic text-slate-300 text-xs">Sin asignar</span>}</TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PromoverAlumnos;
