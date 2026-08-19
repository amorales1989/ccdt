import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createStudent, getDepartments, checkDniExists, getCompany, restoreStudent, updateStudent } from "@/lib/api";
import { hasPermission, type SavedPermissions } from "@/lib/rolePermissions";
import { SIN_DEPARTAMENTO } from "@/lib/departments";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Student, Department, DepartmentType } from "@/types/database";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { UserPlus, Check, History } from "lucide-react";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { DniIdentityInput, textoBajaPrevia, type ArchivedPerson } from "@/components/DniIdentityInput";
import { NameSearchInput } from "@/components/NameSearchInput";
import type { PersonSearchResult } from "@/components/PersonSearchInput";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { useBaptizedEnabled } from "@/hooks/useBaptizedEnabled";
import { LabeledSwitch } from "@/components/LabeledSwitch";

interface AgregarAlumnoProps {
  onSuccess?: () => void;
  isModal?: boolean;
}

const AgregarAlumno = ({ onSuccess, isModal = false }: AgregarAlumnoProps = {}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);
  const [isValidatingDni, setIsValidatingDni] = useState(false);
  const [birthdateOpen, setBirthdateOpen] = useState(false);
  // Persona que ya estuvo en la congregación y está archivada (detectada por DNI).
  const [archivedPerson, setArchivedPerson] = useState<ArchivedPerson | null>(null);
  // Con esto seteado, el formulario deja de dar de alta y pasa a reactivar esa ficha:
  // los datos ya están cargados y lo único que falta definir es el departamento.
  const [restoreId, setRestoreId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    phoneCode: "54",
    address: "",
    gender: "masculino",
    birthdate: format(new Date(), 'yyyy-MM-dd'),
    document_number: "",
    department: null as DepartmentType | null,
    department_id: "",
    assigned_class: "",
    nuevo: true, // Por defecto marcado como nuevo
    baptized: false,
    profile_id: null as string | null,
    person_source: null as 'profile' | 'student' | null,
    existing_student_id: null as string | null,
  });

  const companyId = getPersistentCompanyId();
  const baptizedEnabled = useBaptizedEnabled();
  const { data: departments = [] } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: getDepartments,
  });

  const { data: company } = useQuery({
    queryKey: ["company", companyId],
    queryFn: () => getCompany(companyId),
    staleTime: 5 * 60 * 1000,
  });

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const isMaestro = profile?.role === 'maestro' || profile?.role === 'auxiliar_maestro';
  const isDirector = profile?.role === 'director';

  // Quien puede registrar miembros de la congregacion sin asignarlos a un departamento.
  const puedeSinDepto = hasPermission(
    profile,
    'puede_agregar_miembros_sin_depto',
    (company as { role_permissions?: SavedPermissions } | undefined)?.role_permissions,
  );

  const availableDepartments = isAdminOrSecretaria
    ? departments
    : departments.filter(dept => profile?.departments?.includes(dept.name as DepartmentType));

  const availableClasses = formData.department
    ? departments.find(d => d.name === formData.department)?.classes || []
    : [];

  const departmentHasClasses = availableClasses.length > 0;

  useEffect(() => {
    if (profile) {
      let department = null;
      let departmentId = "";
      let assignedClass = "";

      if (profile.departments?.[0]) {
        department = profile.departments[0] as DepartmentType;
        departmentId = profile.department_id || "";
      }

      if (profile.assigned_class) {
        assignedClass = profile.assigned_class;
      }

      setFormData(prev => ({
        ...prev,
        department,
        department_id: departmentId,
        assigned_class: assignedClass
      }));

      if (department && !departmentId) {
        const fetchDepartmentId = async () => {
          try {
            const { data, error } = await supabase
              .from("departments")
              .select("id")
              .eq("name", department)
              .eq("company_id", companyId)
              .single();

            if (error) {
              console.error("Error fetching department ID:", error);
              return;
            }

            if (data) {
              console.log("Found department ID:", data.id, "for department:", department);
              setFormData(prev => ({ ...prev, department_id: data.id }));
            }
          } catch (error) {
            console.error("Error in fetchDepartmentId:", error);
          }
        };

        fetchDepartmentId();
      }
    }
  }, [profile, departments]);

  const validateDni = async (dni: string) => {
    if (!dni || dni.trim() === '') {
      setDniError(null);
      return true;
    }

    setIsValidatingDni(true);
    try {
      const exists = await checkDniExists(dni);
      if (exists) {
        setDniError(`El DNI ${dni} ya está registrado en el sistema`);
        return false;
      } else {
        setDniError(null);
        return true;
      }
    } catch (error) {
      console.error("Error validating DNI:", error);
      return true;
    } finally {
      setIsValidatingDni(false);
    }
  };

  const handleDniFound = (person: any, source: 'student' | 'profile') => {
    setFormData(prev => ({
      ...prev,
      first_name: person.first_name || prev.first_name,
      last_name: person.last_name || prev.last_name,
      phone: person.phone ? extractLocalPhone(person.phone, prev.phoneCode) : prev.phone,
      address: person.address || prev.address,
      gender: person.gender || prev.gender,
      birthdate: person.birthdate || prev.birthdate,
      document_number: person.document_number,
      profile_id: person.profile_id || (source === 'profile' ? person.id : (prev.profile_id)),
      person_source: source,
      existing_student_id: source === 'student' ? person.id : prev.existing_student_id,
      baptized: source === 'student' ? !!person.baptized : prev.baptized,
    }));

    toast({
      title: "Persona encontrada",
      description: `Se han cargado los datos de ${person.first_name} ${person.last_name}.`,
    });

    // Limpiar errores de DNI ya que acabamos de encontrar a la persona y la vincularemos
    setDniError(null);
  };

  const handleDniBlur = async () => {
    // IMPORTANTE: Usar el valor actual de document_number
    // Si ya seleccionamos una persona de la búsqueda o del lookup, no validamos
    if (formData.profile_id || formData.person_source || restoreId) {
      setDniError(null);
      return;
    }

    if (formData.document_number && formData.document_number.trim() !== '') {
      await validateDni(formData.document_number);
    } else {
      setDniError(null);
    }
  };

  // Inverso de formatPhoneNumber: los teléfonos guardados ya vienen con código de país + "9"
  // (ver formatPhoneNumber más abajo). Al autocompletar desde una persona existente hay que
  // sacarle ese prefijo, porque el campo "Teléfono" solo debe mostrar el número local
  // (el código de país se muestra aparte, en el input de al lado).
  const extractLocalPhone = (fullPhone: string | null | undefined, phoneCode: string) => {
    if (!fullPhone) return "";
    let digits = fullPhone.replace(/\D/g, "");
    if (digits.startsWith(phoneCode)) {
      digits = digits.slice(phoneCode.length);
      if (phoneCode === "54" && digits.startsWith("9")) digits = digits.slice(1);
    }
    return digits;
  };

  const formatPhoneNumber = (phoneCode: string, phoneNumber: string) => {
    if (!phoneNumber) return null;

    let cleanNumber = phoneNumber.replace(/\D/g, "");

    if (cleanNumber.startsWith("0")) {
      cleanNumber = cleanNumber.substring(1);
    }

    if (cleanNumber.startsWith("15")) {
      cleanNumber = cleanNumber.substring(2);
    }

    if (phoneCode === "54") {
      return phoneCode + "9" + cleanNumber;
    }

    return phoneCode + cleanNumber;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Solo validamos DNI si NO es una persona seleccionada del buscador ni una ficha a reactivar
    if (formData.document_number && formData.document_number.trim() !== '' && !formData.profile_id && !formData.person_source && !restoreId) {
      const isValid = await validateDni(formData.document_number);
      if (!isValid) {
        toast({
          title: "Miembro ya registrado",
          description: "Esta persona ya existe con ese DNI. Por favor, búscala en el campo superior 'Buscar persona existente' para vincularla a este nuevo departamento.",
          variant: "destructive",
        });
        return;
      }
    }

    if (!formData.first_name) {
      toast({
        title: "Error",
        description: "Por favor ingrese el nombre del miembro",
        variant: "destructive",
      });
      return;
    }

    const formattedPhone = formatPhoneNumber(formData.phoneCode, formData.phone);
    const birthdate = formData.birthdate || format(new Date(), 'yyyy-MM-dd');

    // Modo reactivación: la persona ya tiene ficha archivada, así que no se crea nada nuevo.
    // Vuelve al departamento elegido en el formulario (para un maestro, el suyo, que ya viene
    // preseleccionado) y si le corrigieron algún dato se guarda sobre su ficha de siempre.
    if (restoreId) {
      setIsLoading(true);
      try {
        await restoreStudent(restoreId, {
          department_id: formData.department_id || null,
          assigned_class: formData.assigned_class || null,
        });

        const cambios: Record<string, unknown> = {};
        const original = archivedPerson as Record<string, string | boolean | null | undefined> | null;
        if (original) {
          if (formData.first_name !== original.first_name) cambios.first_name = formData.first_name;
          if ((formData.last_name || "") !== (original.last_name || "")) cambios.last_name = formData.last_name || "";
          if ((formattedPhone || null) !== (original.phone || null)) cambios.phone = formattedPhone;
          if ((formData.address || null) !== (original.address || null)) cambios.address = formData.address || null;
          if (formData.gender !== original.gender) cambios.gender = formData.gender;
          if (birthdate !== (original.birthdate || null)) cambios.birthdate = birthdate;
          if (formData.baptized !== !!original.baptized) cambios.baptized = formData.baptized;
        }
        if (Object.keys(cambios).length > 0) {
          await updateStudent(restoreId, cambios);
        }

        toast({
          title: "Miembro reactivado",
          description: `${formData.first_name} ${formData.last_name}`.trim() +
            " volvió a la lista con todo su historial.",
          variant: "success",
        });

        queryClient.invalidateQueries({ queryKey: ["member-count"] });
        queryClient.invalidateQueries({ queryKey: ["students"] });
        queryClient.invalidateQueries({ queryKey: ["all-students"] });
        queryClient.invalidateQueries({ queryKey: ["archived-students"] });

        if (onSuccess) onSuccess();
        else navigate("/listar");
      } catch (error) {
        toast({
          title: "No se pudo reactivar",
          description: (error as Error).message || "Intentá nuevamente.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    try {
      await createStudent({
        first_name: formData.first_name,
        last_name: formData.last_name || "",
        phone: formattedPhone,
        address: formData.address || null,
        gender: formData.gender || "masculino",
        birthdate: birthdate,
        document_number: formData.document_number || null,
        department: formData.department || null,
        department_id: formData.department_id || undefined,
        assigned_class: formData.assigned_class || null,
        nuevo: formData.nuevo,
        baptized: formData.baptized,
        profile_id: formData.profile_id || undefined,
        person_source: formData.person_source || undefined,
        existing_student_id: formData.existing_student_id || undefined,
      } as any);

      toast({
        title: "Miembro agregado",
        description: `El miembro ha sido agregado exitosamente${formData.nuevo ? ' y marcado como nuevo' : ''}`,
        variant: "success",
      });

      // Contador de miembros (Configuración › Plan, PlanLimitBanner): nadie más lo invalida.
      queryClient.invalidateQueries({ queryKey: ["member-count"] });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error al crear miembro:", error);

      // El DNI es de alguien que ya estuvo: en vez del error genérico, se ofrece reactivar
      // su ficha para no partir el historial en dos.
      if (error?.code === 'ARCHIVED_DNI' && error?.body?.archived_student) {
        setArchivedPerson(error.body.archived_student);
        return;
      }

      toast({
        title: "Error",
        description: error.message || "Hubo un error al agregar el miembro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // "Es la misma persona": carga sus datos guardados en el formulario y lo pasa a modo
  // reactivación. No reactiva todavía: el departamento se elige acá abajo como en cualquier
  // alta (a un maestro ya le viene preseleccionado el suyo) y se confirma con el botón final.
  const activarReactivacion = () => {
    if (!archivedPerson) return;
    const p = archivedPerson as Record<string, string | boolean | null | undefined>;
    setRestoreId(archivedPerson.id);

    // Departamento: si el formulario ya trae uno (a un maestro se le preselecciona el suyo),
    // manda ese. Si no, se propone el que tenía antes de irse, siempre que este usuario pueda
    // asignarlo. Igual queda editable abajo.
    const deptPrevio = availableDepartments.find(d => d.id === p.department_id);
    const clasePrevia = deptPrevio?.classes?.includes(p.assigned_class) ? p.assigned_class : "";

    setFormData(prev => ({
      ...prev,
      ...(!prev.department_id && deptPrevio
        ? {
            department: deptPrevio.name as DepartmentType,
            department_id: deptPrevio.id,
            assigned_class: clasePrevia,
          }
        : {}),
      first_name: p.first_name ?? prev.first_name,
      last_name: p.last_name !== undefined ? (p.last_name || "") : prev.last_name,
      phone: p.phone !== undefined ? (p.phone ? extractLocalPhone(p.phone, prev.phoneCode) : "") : prev.phone,
      address: p.address !== undefined ? (p.address || "") : prev.address,
      gender: p.gender ?? prev.gender,
      birthdate: p.birthdate ?? prev.birthdate,
      document_number: p.document_number ?? prev.document_number,
      baptized: p.baptized !== undefined ? !!p.baptized : prev.baptized,
      nuevo: false, // vuelve, no es un miembro nuevo
    }));
    setDniError(null);
  };

  // "No es la misma persona": el DNI no puede quedar, porque ya pertenece a esa ficha.
  const descartarReactivacion = () => {
    setArchivedPerson(null);
    setRestoreId(null);
    setFormData(prev => ({ ...prev, document_number: "" }));
    toast({
      title: "Revisá el documento",
      description: "Ese DNI ya está en la ficha archivada de otra persona. Cargá el correcto para poder continuar.",
    });
  };

  // Con permiso para dar de alta sin departamento no hace falta tener uno asignado.
  if (!isAdminOrSecretaria && !puedeSinDepto && (!profile?.departments?.length)) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No tiene departamentos asignados. Contacte al administrador.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const content = (
    <div className="relative z-10">
      {!isModal && (
        <div className="flex items-center gap-4 mb-8 pb-6 border-b border-purple-200/60 dark:border-slate-700/60">
          <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-purple-500/30 text-white">
            <UserPlus className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-3xl font-black text-foreground tracking-tight">Agregar Miembro</h2>
            <p className="text-muted-foreground text-sm mt-1">Complete los datos para inscribir un nuevo miembro</p>
          </div>
        </div>
      )}

      <div className={`${!isModal ? 'bg-white/60 dark:bg-slate-900/60 backdrop-blur-md rounded-2xl p-6 border border-white/40 dark:border-slate-700/50 shadow-sm' : ''}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <NameSearchInput
                id="first_name"
                value={formData.first_name}
                onChange={(v) =>
                  setFormData(prev => ({
                    ...prev,
                    first_name: v,
                    ...((prev.profile_id || prev.person_source || prev.existing_student_id)
                      ? { profile_id: null, person_source: null, existing_student_id: null }
                      : {}),
                  }))
                }
                onSelect={(person: PersonSearchResult) => {
                  setFormData(prev => ({
                    ...prev,
                    first_name: person.first_name || prev.first_name,
                    last_name: person.last_name || prev.last_name,
                    phone: person.phone ? extractLocalPhone(person.phone, prev.phoneCode) : prev.phone,
                    address: person.address || prev.address,
                    gender: person.gender || prev.gender,
                    birthdate: person.birthdate || prev.birthdate,
                    document_number: person.document_number || prev.document_number,
                    profile_id: person.profile_id || (person.source === 'profile' ? person.id : prev.profile_id),
                    person_source: person.source,
                    existing_student_id: person.source === 'student' ? person.id : prev.existing_student_id,
                    baptized: person.source === 'student' ? !!person.baptized : prev.baptized,
                  }));
                  setDniError(null);
                  toast({
                    title: "Persona seleccionada",
                    description: `Se han cargado los datos de ${person.first_name} ${person.last_name}.`,
                  });
                }}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
              />
            </div>
          </div>

          {(formData.profile_id || formData.person_source) && (
            <div className="p-3 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl flex items-center gap-3">
              <div className="bg-blue-500 p-2 rounded-lg text-white">
                <Check className="h-4 w-4" />
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-300">
                Persona vinculada correctamente. Se creará una nueva inscripción en este departamento manteniendo su historial previo.
              </p>
            </div>
          )}

          <DniIdentityInput
            value={formData.document_number}
            onChange={(value) => setFormData({ ...formData, document_number: value })}
            onFound={handleDniFound}
            onArchivedFound={setArchivedPerson}
            onBlur={handleDniBlur}
            error={!!dniError}
            disabled={!!formData.profile_id || !!formData.person_source || !!restoreId}
          />

          {archivedPerson && !restoreId && (
            <div className="p-4 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-amber-500 p-2 rounded-lg text-white shrink-0">
                  <History className="h-4 w-4" />
                </div>
                <div className="text-xs text-amber-900 dark:text-amber-200 space-y-1">
                  <p className="font-bold">
                    {`${archivedPerson.first_name} ${archivedPerson.last_name || ""}`.trim()} ya estuvo en la congregación
                  </p>
                  <p>
                    Estuvo {textoBajaPrevia(archivedPerson)}
                    {archivedPerson.department ? ` en ${archivedPerson.department}` : ""}. Si es la misma persona,
                    reactivá su ficha: vuelve con su asistencia, observaciones e historial. Cargarla de nuevo
                    crearía un duplicado y ese historial quedaría suelto.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={activarReactivacion}
                  className="bg-amber-600 hover:bg-amber-700 text-white"
                >
                  Es la misma persona, reactivarla
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={descartarReactivacion}
                  className="text-amber-800 dark:text-amber-300"
                >
                  No es la misma persona
                </Button>
              </div>
            </div>
          )}

          {restoreId && archivedPerson && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30 rounded-xl space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-600 p-2 rounded-lg text-white shrink-0">
                  <History className="h-4 w-4" />
                </div>
                <div className="text-xs text-emerald-900 dark:text-emerald-200 space-y-1">
                  <p className="font-bold">
                    Reactivando a {`${archivedPerson.first_name} ${archivedPerson.last_name || ""}`.trim()}
                  </p>
                  <p>
                    Cargamos sus datos de la ficha archivada. Corregí lo que haga falta, elegí el departamento
                    y la clase, y confirmá abajo: vuelve con toda su asistencia e historial.
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={descartarReactivacion}
                className="text-emerald-800 dark:text-emerald-300"
              >
                Cancelar reactivación
              </Button>
            </div>
          )}
          {dniError && !formData.profile_id && !formData.person_source && (
            <p className="text-sm font-medium text-destructive mt-1">{dniError}</p>
          )}
          {(formData.profile_id || formData.person_source) && (
            <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 italic">
              El DNI está bloqueado porque se está usando una persona existente.
            </p>
          )}
          <div className="space-y-2">
            <Label htmlFor="birthdate">Fecha de Nacimiento</Label>
            <MuiDatePickerField
              value={formData.birthdate ? parseISO(formData.birthdate) : undefined}
              onChange={(date) =>
                setFormData({ ...formData, birthdate: date ? format(date, 'yyyy-MM-dd') : '' })
              }
              open={birthdateOpen}
              onOpenChange={setBirthdateOpen}
              placeholder="Seleccionar fecha de nacimiento"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gender">Género</Label>
            <Select
              value={formData.gender}
              onValueChange={(value) =>
                setFormData({ ...formData, gender: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar género" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="masculino">Masculino</SelectItem>
                <SelectItem value="femenino">Femenino</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="department">
              Departamento{puedeSinDepto && <span className="text-muted-foreground font-normal"> (opcional)</span>}
            </Label>
            <Select
              value={formData.department || SIN_DEPARTAMENTO}
              onValueChange={(value) => {
                if (value === SIN_DEPARTAMENTO) {
                  setFormData({ ...formData, department: null, department_id: "", assigned_class: "" });
                  return;
                }
                const selectedDept = departments.find(d => d.name === value);
                setFormData({
                  ...formData,
                  department: value as DepartmentType,
                  department_id: selectedDept?.id || "",
                  assigned_class: ""
                });
              }}
              disabled={(isMaestro || isDirector) && !puedeSinDepto}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar departamento" />
              </SelectTrigger>
              <SelectContent>
                {puedeSinDepto && (
                  <SelectItem value={SIN_DEPARTAMENTO}>
                    <span className="text-muted-foreground italic">Sin departamento</span>
                  </SelectItem>
                )}
                {availableDepartments.map((dept) => (
                  <SelectItem key={dept.name} value={dept.name}>
                    {dept.name.charAt(0).toUpperCase() + dept.name.slice(1).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {puedeSinDepto && !formData.department && (
              <p className="text-[11px] text-muted-foreground">
                Podés registrar miembros de la congregación sin asignarlos a ningún departamento.
              </p>
            )}
          </div>
          {formData.department && departmentHasClasses && (
            <div className="space-y-2">
              <Label htmlFor="assigned_class">Clase</Label>
              <Select
                value={formData.assigned_class}
                onValueChange={(value) =>
                  setFormData({ ...formData, assigned_class: value })
                }
                disabled={isMaestro}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar clase" />
                </SelectTrigger>
                <SelectContent>
                  {availableClasses.map((className) => (
                    <SelectItem key={className} value={className}>
                      {className}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono</Label>
            <div className="grid grid-cols-[100px_1fr] gap-2">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">+</span>
                <Input
                  id="phoneCode"
                  value="54"
                  onChange={(e) =>
                    setFormData({ ...formData, phoneCode: e.target.value })
                  }
                  placeholder="54"
                  disabled
                />
              </div>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '') })
                }
                placeholder="Sin 0 ni 15 al inicio, ej: 11xxxxxxxx"
              />
            </div>
            <span className="text-xs text-muted-foreground">No incluir el 0 ni el 15 al inicio del número. Ejemplo correcto: 11xxxxxxxx</span>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Dirección</Label>
            <Input
              id="address"
              value={formData.address}
              onChange={(e) =>
                setFormData({ ...formData, address: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 pb-4 border-b">
            <LabeledSwitch
              label="Marcar como nuevo"
              checked={formData.nuevo}
              onCheckedChange={(checked) => setFormData({ ...formData, nuevo: checked })}
            />
            {baptizedEnabled && (
              <LabeledSwitch
                label="Bautizado"
                checked={formData.baptized}
                onCheckedChange={(checked) => setFormData({ ...formData, baptized: checked })}
              />
            )}
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xl shadow-purple-500/30 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>{restoreId ? "Reactivando miembro..." : "Registrando miembro..."}</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {restoreId ? <History className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                <span>{restoreId ? "Reactivar Miembro" : "Completar Registro"}</span>
              </div>
            )}
          </Button>
        </form>
      </div>
    </div>
  );

  if (isModal) {
    return content;
  }

  return (
    <div className="animate-fade-in space-y-8 pb-8">
      <section className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-white to-pink-100 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800 p-6 sm:p-10 rounded-3xl border-2 border-purple-200 dark:border-slate-700 shadow-xl mx-auto max-w-4xl mt-4">
        {/* Decorative background blur */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-indigo-500/20 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-pink-500/20 blur-3xl pointer-events-none"></div>
        {content}
      </section>
    </div>
  );
};

export default AgregarAlumno;