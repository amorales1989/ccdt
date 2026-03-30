import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { createStudent, getDepartments, checkDniExists } from "@/lib/api";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Student, Department, DepartmentType } from "@/types/database";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { UserPlus, User, MapPin, Phone, Hash, CalendarDays, KeyRound, Building2, Search, Check } from "lucide-react";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { PersonSearchInput, PersonSearchResult } from "@/components/PersonSearchInput";

interface AgregarAlumnoProps {
  onSuccess?: () => void;
  isModal?: boolean;
}

const AgregarAlumno = ({ onSuccess, isModal = false }: AgregarAlumnoProps = {}) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [dniError, setDniError] = useState<string | null>(null);
  const [isValidatingDni, setIsValidatingDni] = useState(false);
  const [birthdateOpen, setBirthdateOpen] = useState(false);

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
    profile_id: null as string | null,
    person_source: null as 'profile' | 'student' | null,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ["departments"],
    queryFn: getDepartments,
  });

  const isAdminOrSecretaria = profile?.role === 'admin' || profile?.role === 'secretaria';
  const isMaestro = profile?.role === 'maestro';
  const isDirector = profile?.role === 'director';

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

  const handleDniBlur = async () => {
    // Si ya seleccionamos una persona de la búsqueda, no validamos el DNI como "nuevo"
    if (formData.profile_id || formData.person_source) {
      setDniError(null);
      return;
    }

    if (formData.document_number && formData.document_number.trim() !== '') {
      await validateDni(formData.document_number);
    } else {
      setDniError(null);
    }
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

    // Solo validamos DNI si NO es una persona seleccionada del buscador
    if (formData.document_number && formData.document_number.trim() !== '' && !formData.profile_id && !formData.person_source) {
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
        profile_id: formData.profile_id || undefined,
        person_source: formData.person_source || undefined,
      } as any);

      toast({
        title: "Miembro agregado",
        description: `El miembro ha sido agregado exitosamente${formData.nuevo ? ' y marcado como nuevo' : ''}`,
        variant: "success",
      });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Error al crear miembro:", error);
      toast({
        title: "Error",
        description: error.message || "Hubo un error al agregar el miembro",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAdminOrSecretaria && (!profile?.departments?.length)) {
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
        <div className="mb-8 p-4 bg-purple-50 dark:bg-purple-900/10 rounded-xl border border-purple-100 dark:border-purple-900/20">
          <Label className="text-xs font-semibold uppercase tracking-wider text-purple-700 dark:text-purple-400 ml-1 mb-2 block">
            Buscar persona existente (Opcional)
          </Label>
          <PersonSearchInput
            onSelect={(person: PersonSearchResult) => {
              setFormData(prev => ({
                ...prev,
                first_name: person.first_name,
                last_name: person.last_name,
                phone: person.phone || "",
                address: person.address || "",
                gender: person.gender || "masculino",
                birthdate: person.birthdate || format(new Date(), 'yyyy-MM-dd'),
                document_number: person.document_number || "",
                profile_id: person.profile_id || (person.source === 'profile' ? person.id : (prev.profile_id)),
                person_source: person.source
              }));

              toast({
                title: "Persona seleccionada",
                description: `Se han cargado los datos de ${person.first_name} ${person.last_name}.`,
              });
            }}
          />
          <p className="text-[10px] text-muted-foreground mt-2 px-1 italic">
            Evita duplicados buscando si la persona ya es líder o miembro de otro departamento.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
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

          <div className="space-y-2">
            <Label htmlFor="document_number" error={!!dniError}>DNI</Label>
            <Input
              id="document_number"
              value={formData.document_number}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  document_number: e.target.value.replace(/\D/g, '')
                })
              }
              onBlur={handleDniBlur}
              placeholder="Ingrese el DNI sin puntos"
              error={!!dniError}
              inputMode="numeric"
              pattern="[0-9]*"
              disabled={!!formData.profile_id || !!formData.person_source}
            />
            {(formData.profile_id || formData.person_source) && (
              <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1 italic">
                El DNI está bloqueado porque se está usando una persona existente.
              </p>
            )}
            {dniError && (
              <p className="text-sm font-medium text-destructive mt-1">{dniError}</p>
            )}
          </div>
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
            <Label htmlFor="department">Departamento</Label>
            <Select
              value={formData.department || undefined}
              onValueChange={(value) => {
                const selectedDept = departments.find(d => d.name === value);
                setFormData({
                  ...formData,
                  department: value as DepartmentType,
                  department_id: selectedDept?.id || "",
                  assigned_class: ""
                });
              }}
              disabled={isMaestro || isDirector}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar departamento" />
              </SelectTrigger>
              <SelectContent>
                {availableDepartments.map((dept) => (
                  <SelectItem key={dept.name} value={dept.name}>
                    {dept.name.charAt(0).toUpperCase() + dept.name.slice(1).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                  setFormData({ ...formData, phone: e.target.value })
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

          <div className="flex items-center space-x-2 pt-4 pb-4 border-b">
            <Checkbox
              id="nuevo"
              checked={formData.nuevo}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, nuevo: checked as boolean })
              }
            />
            <Label
              htmlFor="nuevo"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              Marcar miembro como nuevo
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xl shadow-purple-500/30 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] mt-4"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Registrando miembro...</span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                <span>Completar Registro</span>
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