import { useState, useEffect, useRef } from "react";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Department, DepartmentType } from "@/types/database";
import { UserPlus, Eye, EyeOff, Search } from "lucide-react";
import { PersonSearchInput, PersonSearchResult } from "./PersonSearchInput";
import { DniIdentityInput } from "./DniIdentityInput";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type AppRole = Database["public"]["Enums"]["app_role"];

interface RegisterUserModalProps {
    children: React.ReactNode;
    onSuccess?: () => void;
}

export function RegisterUserModal({ children, onSuccess }: RegisterUserModalProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [role, setRole] = useState<AppRole | "">("");
    const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
    const [selectedClass, setSelectedClass] = useState<string>("");
    const [availableClasses, setAvailableClasses] = useState<string[]>([]);
    const [phone, setPhone] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [gender, setGender] = useState("masculino");
    const [address, setAddress] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [personSource, setPersonSource] = useState<'profile' | 'student' | null>(null);

    const { profile, signUp } = useAuth();
    const { toast } = useToast();

    const isDirector = profile?.role === 'director';
    const isDirectorGeneral = profile?.role === 'director_general';
    const isVicedirector = profile?.role === 'vicedirector';

    useEffect(() => {
        if ((isDirector || isVicedirector) && profile.departments?.[0]) {
            setSelectedDepartment(profile.departments[0]);
            setRole("maestro");
        }
    }, [isDirector, isVicedirector, profile]);

    // Fetch departments
    const { data: departments = [] } = useQuery({
        queryKey: ['departments', getPersistentCompanyId()],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .eq('company_id', getPersistentCompanyId())
                .order('name');

            if (error) throw error;
            return data as Department[];
        }
    });

    const prevSelectedDeptRef = useRef<string | null>(null);

    // Update available classes when department changes
    useEffect(() => {
        if (selectedDepartment) {
            const department = departments.find(d => d.name === selectedDepartment);
            setAvailableClasses(department?.classes || []);

            // Only reset if the selected department ACTUALLY changed from one value to another
            if (prevSelectedDeptRef.current !== null && prevSelectedDeptRef.current !== selectedDepartment) {
                setSelectedClass("");
            }
            prevSelectedDeptRef.current = selectedDepartment;
        } else {
            setAvailableClasses([]);
            setSelectedClass("");
            prevSelectedDeptRef.current = null;
        }
    }, [selectedDepartment, departments]);

    const clearForm = () => {
        setFirstName("");
        setLastName("");
        setEmail("");
        setPassword("");
        setPhone("");
        setBirthdate("");
        setGender("masculino");
        setAddress("");
        setDocumentNumber("");
        setRole("maestro");
        if (!isDirector) {
            setSelectedDepartment(null);
            setSelectedDepartments([]);
        } else if (profile?.departments?.[0]) {
            setSelectedDepartment(profile.departments[0]);
            setSelectedDepartments([profile.departments[0]]);
        }
        setSelectedClass("");
        setAvailableClasses([]);
        setSelectedPersonId(null);
        setPersonSource(null);
        setProfileId(null);
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) {
            clearForm();
        }
    };

    const handleDniFound = (person: any) => {
        if (!person) return;

        if (!firstName) setFirstName(person.first_name || "");
        if (!lastName) setLastName(person.last_name || "");
        if (!phone) setPhone(person.phone || "");
        if (!birthdate) setBirthdate(person.birthdate || "");
        if (!address) setAddress(person.address || "");
        if (person.gender) setGender(person.gender);

        // Auto-completar departamento y clase
        if (person.departments && person.departments.length > 0) {
            setSelectedDepartment(person.departments[0]);
        }
        if (person.assigned_class) {
            setSelectedClass(person.assigned_class);
        }

        setProfileId(person.profile_id || (person.source === 'profile' ? person.id : null));
        setPersonSource(person.source);
        setSelectedPersonId(person.id);

        toast({
            title: person.source === 'profile' ? "Usuario encontrado" : "Miembro encontrado",
            description: `Se han vinculado los datos de ${person.first_name} ${person.last_name}.`,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!role) {
            toast({
                title: "Error",
                description: "Por favor seleccione un rol para el usuario",
                variant: "destructive",
            });
            return;
        }

        if (role !== 'director_general' && !selectedDepartment) {
            toast({
                title: "Error",
                description: "Por favor seleccione un departamento",
                variant: "destructive",
            });
            return;
        }

        if (role === 'director_general' && selectedDepartments.length === 0) {
            toast({
                title: "Error",
                description: "Por favor seleccione al menos un departamento",
                variant: "destructive",
            });
            return;
        }

        try {
            const departmentObj = role === 'director_general'
                ? departments.find(d => d.name === selectedDepartments[0])
                : departments.find(d => d.name === selectedDepartment);

            const department_id = departmentObj?.id || "";

            // Generar credenciales si es colaborador y no se proporcionaron
            let finalEmail = email;
            let finalPassword = password;

            if (role === 'colaborador' && !email) {
                finalEmail = `colab_${crypto.randomUUID().substring(0, 8)}@ccdt.internal`;
            }

            if (role === 'colaborador' && !password) {
                finalPassword = Math.random().toString(36).slice(-10);
            }

            if (!finalEmail || !finalPassword) {
                toast({
                    title: "Error",
                    description: "El email y la contraseña son requeridos para este rol.",
                    variant: "destructive",
                });
                return;
            }

            const profileData = {
                first_name: firstName,
                last_name: lastName,
                role,
                departments: role === 'director_general' ? selectedDepartments : [selectedDepartment],
                department_id,
                assigned_class: (selectedClass && selectedClass !== 'none' && role !== 'director_general') ? selectedClass : undefined,
                phone: phone || undefined,
                birthdate: birthdate || undefined,
                gender: gender || undefined,
                address: address || undefined,
                document_number: documentNumber || undefined,
                is_member: (role as string) === 'miembro' || personSource === 'student',
                profile_id: profileId || undefined,
                person_source: personSource || undefined,
                company_id: getPersistentCompanyId()
            };

            // Usamos la Edge Function para evitar que el administrador sea deslogueado
            const { data: registerData, error: registerError } = await supabase.functions.invoke('manage-users', {
                body: {
                    action: 'create',
                    userData: {
                        email: finalEmail,
                        password: finalPassword,
                        ...profileData
                    }
                }
            });

            if (registerError) throw registerError;

            // Update profile with additional fields to ensure they are saved
            const newUser = registerData?.user;
            if (newUser?.id) {
                const { error: profileUpdateError } = await supabase
                    .from('profiles')
                    .update({
                        birthdate: birthdate || undefined,
                        document_number: documentNumber || undefined,
                        gender: gender || undefined
                    })
                    .eq('id', newUser.id);

                if (profileUpdateError) {
                    console.error("Error updating profile after creation:", profileUpdateError);
                }
            }

            toast({
                title: "Registro exitoso",
                description: "El usuario ha sido registrado exitosamente.",
            });

            clearForm();
            setOpen(false); // Cerrar modal

            if (onSuccess) {
                onSuccess();
            }

        } catch (error: any) {
            console.error("Register error:", error);
            let errorMessage = error.message || "Ha ocurrido un error";
            if (errorMessage.includes("User already registered")) {
                errorMessage = "Este correo electrónico ya está registrado";
            }
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive",
            });
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                            <UserPlus className="h-5 w-5" />
                        </div>
                        Registrar Usuario
                    </DialogTitle>
                    <DialogDescription>
                        Añade nuevos miembros al sistema asignándoles roles y dándoles acceso.
                    </DialogDescription>
                </DialogHeader>

                <div className="mt-4 mb-6">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1 mb-2 block">
                        Buscar persona existente (Opcional)
                    </Label>
                    <PersonSearchInput
                        selectedName={selectedPersonId ? `${firstName} ${lastName}` : undefined}
                        onSelect={(person: PersonSearchResult) => {
                            setFirstName(person.first_name);
                            setLastName(person.last_name);
                            setPhone(person.phone || "");
                            setBirthdate(person.birthdate || "");
                            setGender(person.gender || "masculino");
                            setAddress(person.address || "");
                            setDocumentNumber(person.document_number || "");
                            setProfileId(person.profile_id || (person.source === 'profile' ? person.id : null));
                            setPersonSource(person.source);
                            setSelectedPersonId(person.id);

                            toast({
                                title: "Persona seleccionada",
                                description: `Se han cargado los datos de ${person.first_name} ${person.last_name}.`,
                            });
                        }}
                    />
                    <p className="text-[10px] text-muted-foreground mt-2 px-1 italic">
                        Si la persona ya existe como miembro o líder, selecciónala para evitar duplicados.
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="relative z-10 mt-4">
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nombre</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    required
                                    placeholder="Ej. Juan"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Apellido</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    required
                                    placeholder="Ej. Pérez"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="documentNumber" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">DNI / Documento</Label>
                                <DniIdentityInput
                                    id="documentNumber"
                                    value={documentNumber}
                                    onChange={setDocumentNumber}
                                    onFound={handleDniFound}
                                    placeholder="Ej. 12345678"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthdate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Fecha de Nacimiento</Label>
                                <Input
                                    id="birthdate"
                                    type="date"
                                    value={birthdate}
                                    onChange={(e) => setBirthdate(e.target.value)}
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Género</Label>
                                <Select value={gender} onValueChange={setGender} required>
                                    <SelectTrigger id="gender" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 transition-all">
                                        <SelectValue placeholder="Seleccionar género" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="masculino">Masculino</SelectItem>
                                        <SelectItem value="femenino">Femenino</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Teléfono</Label>
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Ej. 1122334455"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Correo Electrónico {role === 'colaborador' && "(Opcional)"}
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required={role !== 'colaborador'}
                                placeholder={role === 'colaborador' ? "Opcional para colaboradores" : "ejemplo@correo.com"}
                                autoComplete="off"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Contraseña Temporal {role === 'colaborador' && "(Opcional)"}
                            </Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required={role !== 'colaborador'}
                                    placeholder={role === 'colaborador' ? "Opcional para colaboradores" : "••••••••"}
                                    autoComplete="new-password"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12"
                                />
                                <Button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    variant="ghost"
                                    size="icon"
                                    className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                                >
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="role" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Rol en el Sistema</Label>
                                <Select value={role} onValueChange={(value: AppRole) => setRole(value)}>
                                    <SelectTrigger className="h-12 rounded-xl border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                                        <SelectValue placeholder="Seleccione rol" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-xl">
                                        {isDirector || isVicedirector ? (
                                            <>
                                                <SelectItem value="maestro">Maestro</SelectItem>
                                                <SelectItem value="colaborador">Colaborador</SelectItem>
                                            </>
                                        ) : isDirectorGeneral ? (
                                            <>
                                                <SelectItem value="maestro">Maestro</SelectItem>
                                                <SelectItem value="colaborador">Colaborador</SelectItem>
                                                <SelectItem value="director">Director</SelectItem>
                                                <SelectItem value="vicedirector">Vicedirector</SelectItem>
                                            </>
                                        ) : (
                                            <>
                                                <SelectItem value="maestro">Maestro</SelectItem>
                                                <SelectItem value="lider">Líder</SelectItem>
                                                <SelectItem value="director">Director</SelectItem>
                                                <SelectItem value="vicedirector">Vicedirector</SelectItem>
                                                <SelectItem value="director_general">Director General</SelectItem>
                                                <SelectItem value="colaborador">Colaborador</SelectItem>
                                                <SelectItem value="secretaria">Secretaria</SelectItem>
                                                <SelectItem value="secr.-calendario">Secr.-calendario</SelectItem>
                                                <SelectItem value="admin">Administrador</SelectItem>
                                            </>
                                        )}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="department" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                    {role === 'director_general' ? "Departamentos Asignados" : "Departamento"}
                                </Label>

                                {role === 'director_general' ? (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700">
                                        {departments.filter(d => !isDirector && !isDirectorGeneral && !isVicedirector || profile?.departments?.includes(d.name)).map((dept) => (
                                            <div key={dept.id} className="flex items-center space-x-2">
                                                <input
                                                    type="checkbox"
                                                    id={`dept-${dept.id}`}
                                                    checked={selectedDepartments.includes(dept.name)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedDepartments([...selectedDepartments, dept.name]);
                                                        } else {
                                                            setSelectedDepartments(selectedDepartments.filter(name => name !== dept.name));
                                                        }
                                                    }}
                                                    className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                />
                                                <label htmlFor={`dept-${dept.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                                    {dept.name}
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <Select
                                        value={selectedDepartment || undefined}
                                        onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
                                        disabled={(isDirector || isVicedirector || isDirectorGeneral) && (profile?.departments?.length || 0) <= 1}
                                    >
                                        <SelectTrigger className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${((isDirector || isVicedirector || isDirectorGeneral) && (profile?.departments?.length || 0) <= 1) ? "bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed" : "bg-slate-50"}`}>
                                            <SelectValue placeholder="Selecciona un departamento" />
                                        </SelectTrigger>
                                        <SelectContent className="rounded-xl shadow-xl">
                                            {departments.filter(d => (!isDirector && !isVicedirector && !isDirectorGeneral) || profile?.departments?.includes(d.name)).map((dept) => (
                                                <SelectItem key={dept.id} value={dept.name}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                )}
                            </div>
                        </div>

                        {selectedDepartment && role !== 'director_general' && (
                            <div className="space-y-2 pt-2 animate-fade-in">
                                <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Clase Asignada (Opcional)</Label>
                                <Select value={selectedClass || 'none'} onValueChange={setSelectedClass}>
                                    <SelectTrigger className="h-12 rounded-xl bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/30 text-purple-800 dark:text-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                                        <SelectValue placeholder="Selecciona una clase" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-xl">
                                        <SelectItem value="none" className="text-slate-500 italic">
                                            Sin Clase
                                        </SelectItem>
                                        {availableClasses.map((className) => (
                                            <SelectItem key={className} value={className} className="text-purple-700 dark:text-purple-300">
                                                {className}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </div>

                    <Button
                        type="submit"
                        className="w-full mt-6 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl text-base font-medium transition-all hover:shadow-lg hover:shadow-purple-500/30"
                    >
                        Crear Cuenta de Usuario
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
