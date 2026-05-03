import { useState, useEffect } from "react";
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
import { UserPlus, Eye, EyeOff, Plus, X, Pencil } from "lucide-react";
import { PersonSearchInput, PersonSearchResult } from "./PersonSearchInput";
import { DniIdentityInput } from "./DniIdentityInput";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

type AppRole = Database["public"]["Enums"]["app_role"];

type DeptAssignment = {
    role: AppRole;
    department: string;
    assigned_class: string;
};

type EditableUser = {
    id: string;
    first_name: string;
    last_name: string;
    role: AppRole;
    roles?: AppRole[];
    departments: DepartmentType[];
    assigned_class?: string;
    department_id?: string;
    phone?: string;
    email?: string;
    birthdate?: string;
    document_number?: string;
    gender?: string;
    assignments?: any[];
};

interface RegisterUserModalProps {
    children: React.ReactNode;
    onSuccess?: () => void;
    user?: EditableUser;
}

// Roles that have per-department assignments
const ASSIGNABLE_ROLES: AppRole[] = [
    'maestro', 'lider', 'director', 'vicedirector',
    'colaborador', 'ayudante', 'secretaria',
];

const ROLE_LABELS: Record<string, string> = {
    maestro: 'Maestro',
    lider: 'Líder',
    director: 'Director',
    vicedirector: 'Vicedirector',
    director_general: 'Director General',
    colaborador: 'Colaborador',
    ayudante: 'Ayudante',
    secretaria: 'Secretaria',
    'secr.-calendario': 'Secr. Calendario',
    conserje: 'Conserje',
    admin: 'Admin',
};

export function RegisterUserModal({ children, onSuccess, user }: RegisterUserModalProps) {
    const [open, setOpen] = useState(false);
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");

    // For director_general role: multi-dept checkboxes only
    const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

    // For conserje/secretaria/admin/etc that don't need dept: just roles
    const [standaloneRoles, setStandaloneRoles] = useState<AppRole[]>([]);

    // Main: list of {role, department, class} assignments
    const [assignments, setAssignments] = useState<DeptAssignment[]>([]);

    // Add-assignment form state
    const [tempRole, setTempRole] = useState<AppRole>("maestro");
    const [tempDept, setTempDept] = useState<string>("");
    const [tempClass, setTempClass] = useState<string>("none");
    const [tempClasses, setTempClasses] = useState<string[]>([]);

    // For director/vicedirector (locked dept, role radio)
    const [lockedRole, setLockedRole] = useState<AppRole>("maestro");
    const [lockedClass, setLockedClass] = useState<string>("none");
    const [lockedClasses, setLockedClasses] = useState<string[]>([]);

    const [phone, setPhone] = useState("");
    const [birthdate, setBirthdate] = useState("");
    const [gender, setGender] = useState("masculino");
    const [address, setAddress] = useState("");
    const [documentNumber, setDocumentNumber] = useState("");
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [profileId, setProfileId] = useState<string | null>(null);
    const [personSource, setPersonSource] = useState<'profile' | 'student' | null>(null);
    const [loading, setLoading] = useState(false);

    const { profile } = useAuth();
    const { toast } = useToast();

    const isEditMode = !!user;
    const isLoggedInDirector = profile?.role === 'director';
    const isLoggedInVicedirector = profile?.role === 'vicedirector';
    const isLoggedInDirectorGeneral = profile?.role === 'director_general';
    const isLockedToSingleDept = isLoggedInDirector || isLoggedInVicedirector;

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

    // Determine "mode" from current assignments + standaloneRoles
    // A user is "director_general mode" if standaloneRoles includes director_general
    const isDirectorGeneralMode = standaloneRoles.includes('director_general' as AppRole);
    const isConserjeOnlyMode = standaloneRoles.length > 0 && assignments.length === 0 && selectedDepartments.length === 0;

    // Locked dept classes
    useEffect(() => {
        if (isLockedToSingleDept && profile?.departments?.[0]) {
            const dept = departments.find(d => d.name === profile.departments[0]);
            setLockedClasses(dept?.classes || []);
        }
    }, [isLockedToSingleDept, profile, departments]);

    // tempClasses when tempDept changes
    useEffect(() => {
        if (tempDept) {
            const dept = departments.find(d => d.name === tempDept);
            setTempClasses(dept?.classes || []);
            setTempClass("none");
        } else {
            setTempClasses([]);
            setTempClass("none");
        }
    }, [tempDept, departments]);

    // Pre-fill on edit mode
    useEffect(() => {
        if (user && open) {
            setFirstName(user.first_name || "");
            setLastName(user.last_name || "");
            setEmail(user.email || "");
            setPassword("");
            setPhone(user.phone || "");
            setBirthdate(user.birthdate || "");
            setGender(user.gender || "masculino");
            setDocumentNumber(user.document_number || "");

            const userRoles = user.roles && user.roles.length > 0
                ? user.roles
                : (user.role ? [user.role] : []);

            if (userRoles.includes('director_general' as AppRole)) {
                setStandaloneRoles(['director_general' as AppRole]);
                setSelectedDepartments(user.departments || []);
                setAssignments([]);
            } else if (userRoles.includes('conserje' as AppRole) || userRoles.includes('admin' as AppRole) || userRoles.includes('secr.-calendario' as AppRole)) {
                setStandaloneRoles(userRoles);
                setAssignments([]);
                setSelectedDepartments([]);
            } else {
                setStandaloneRoles([]);
                if (user.assignments && user.assignments.length > 0) {
                    setAssignments(user.assignments.map((a: any) => ({
                        role: (a.role || userRoles[0] || 'maestro') as AppRole,
                        department: a.department || '',
                        assigned_class: a.assigned_class || '',
                    })));
                } else if (user.departments && user.departments.length > 0) {
                    setAssignments(user.departments.map((dept) => ({
                        role: (userRoles[0] || 'maestro') as AppRole,
                        department: dept,
                        assigned_class: dept === user.departments[0] ? (user.assigned_class || '') : '',
                    })));
                } else {
                    setAssignments([]);
                }
                setSelectedDepartments([]);
            }
        }
    }, [user, open]);

    // Init for director/vicedirector in create mode
    useEffect(() => {
        if (!isEditMode && isLockedToSingleDept && profile?.departments?.[0]) {
            setLockedRole("maestro");
            setLockedClass("none");
        }
    }, [isLockedToSingleDept, profile, isEditMode]);

    const clearForm = () => {
        setFirstName(""); setLastName(""); setEmail(""); setPassword("");
        setPhone(""); setBirthdate(""); setGender("masculino");
        setAddress(""); setDocumentNumber("");
        setAssignments([]); setSelectedDepartments([]);
        setStandaloneRoles([]);
        setTempRole("maestro"); setTempDept(""); setTempClass("none"); setTempClasses([]);
        setLockedRole("maestro"); setLockedClass("none");
        setSelectedPersonId(null); setPersonSource(null); setProfileId(null);
    };

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen);
        if (!newOpen) clearForm();
    };

    const addAssignment = () => {
        if (!tempDept) {
            toast({ title: "Error", description: "Selecciona un departamento", variant: "destructive" });
            return;
        }
        if (assignments.some(a => a.department === tempDept && a.role === tempRole)) {
            toast({ title: "Error", description: "Ya existe esa combinación de rol y departamento", variant: "destructive" });
            return;
        }
        setAssignments([...assignments, {
            role: tempRole,
            department: tempDept,
            assigned_class: tempClass === 'none' ? '' : tempClass,
        }]);
        setTempDept("");
        setTempClass("none");
        setTempClasses([]);
    };

    const removeAssignment = (idx: number) => {
        setAssignments(assignments.filter((_, i) => i !== idx));
    };

    const handleDniFound = (person: any) => {
        if (!person) return;
        if (!firstName) setFirstName(person.first_name || "");
        if (!lastName) setLastName(person.last_name || "");
        if (!phone) setPhone(person.phone || "");
        if (!birthdate) setBirthdate(person.birthdate || "");
        if (!address) setAddress(person.address || "");
        if (person.gender) setGender(person.gender);
        if (person.departments?.length > 0 && assignments.length === 0) {
            setAssignments([{ role: 'maestro', department: person.departments[0], assigned_class: person.assigned_class || '' }]);
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
        setLoading(true);

        try {
            let finalDepts: string[];
            let finalDeptId: string | undefined;
            let finalClass: string | undefined;
            let finalRoles: AppRole[];
            let finalRole: AppRole;
            let finalAssignments: any[];

            if (isLockedToSingleDept && profile?.departments?.[0]) {
                // Director/vicedirector: single locked dept
                const deptObj = departments.find(d => d.name === profile.departments[0]);
                finalDepts = [profile.departments[0]];
                finalDeptId = deptObj?.id;
                finalClass = lockedClass === 'none' ? undefined : lockedClass;
                finalRole = lockedRole;
                finalRoles = [lockedRole];
                finalAssignments = [{
                    id: 'assign_0',
                    role: lockedRole,
                    department: profile.departments[0],
                    department_id: deptObj?.id || '',
                    assigned_class: finalClass || '',
                }];
            } else if (isDirectorGeneralMode) {
                if (selectedDepartments.length === 0) {
                    toast({ title: "Error", description: "Seleccione al menos un departamento", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                finalDepts = selectedDepartments;
                finalDeptId = departments.find(d => d.name === selectedDepartments[0])?.id;
                finalClass = undefined;
                finalRole = 'director_general' as AppRole;
                finalRoles = ['director_general' as AppRole];
                finalAssignments = selectedDepartments.map((deptName, i) => ({
                    id: `assign_${i}`,
                    role: 'director_general',
                    department: deptName,
                    department_id: departments.find(d => d.name === deptName)?.id || '',
                    assigned_class: '',
                }));
            } else if (standaloneRoles.length > 0 && assignments.length === 0) {
                // conserje / admin / secr-calendario: no dept required
                const isOnlyConserje = standaloneRoles.length === 1 && standaloneRoles.includes('conserje' as AppRole);
                if (!isOnlyConserje && standaloneRoles.length === 0) {
                    toast({ title: "Error", description: "Seleccione al menos un rol", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                finalDepts = [];
                finalDeptId = undefined;
                finalClass = undefined;
                finalRole = standaloneRoles[0];
                finalRoles = standaloneRoles;
                finalAssignments = [];
            } else {
                if (assignments.length === 0) {
                    toast({ title: "Error", description: "Agregue al menos un rol con departamento", variant: "destructive" });
                    setLoading(false);
                    return;
                }
                finalDepts = [...new Set(assignments.map(a => a.department))];
                finalDeptId = departments.find(d => d.name === assignments[0].department)?.id;
                finalClass = assignments[0].assigned_class || undefined;
                finalRole = assignments[0].role;
                finalRoles = [...new Set(assignments.map(a => a.role))] as AppRole[];
                finalAssignments = assignments.map((a, i) => ({
                    id: `assign_${i}`,
                    role: a.role,
                    department: a.department,
                    department_id: departments.find(d => d.name === a.department)?.id || '',
                    assigned_class: a.assigned_class || '',
                }));
            }

            const hasColaboradorRole = finalRoles.includes('colaborador' as AppRole) || finalRoles.includes('ayudante' as AppRole);
            let finalEmail = email;
            let finalPassword = password;

            if (!isEditMode) {
                if (hasColaboradorRole && !email) {
                    finalEmail = `colab_${crypto.randomUUID().substring(0, 8)}@ccdt.internal`;
                }
                if (hasColaboradorRole && !password) {
                    finalPassword = Math.random().toString(36).slice(-10);
                }
                if (!finalEmail || !finalPassword) {
                    toast({ title: "Error", description: "El email y la contraseña son requeridos.", variant: "destructive" });
                    setLoading(false);
                    return;
                }
            }

            const profileData = {
                first_name: firstName,
                last_name: lastName,
                role: finalRole,
                roles: finalRoles,
                departments: finalDepts,
                department_id: finalDeptId || undefined,
                assigned_class: finalClass || undefined,
                phone: phone || undefined,
                birthdate: birthdate || undefined,
                gender: gender || undefined,
                address: address || undefined,
                document_number: documentNumber || undefined,
                is_member: finalRoles.some(r => (r as string) === 'miembro') || personSource === 'student',
                profile_id: profileId || undefined,
                person_source: personSource || undefined,
                company_id: getPersistentCompanyId(),
                assignments: finalAssignments,
            };

            if (isEditMode) {
                const updatePayload: any = { ...profileData };
                if (email) updatePayload.email = email;
                if (password) updatePayload.password = password;

                const { error } = await supabase.functions.invoke('manage-users', {
                    body: { action: 'update', userId: user!.id, userData: updatePayload }
                });
                if (error) throw error;
            } else {
                const { data: registerData, error: registerError } = await supabase.functions.invoke('manage-users', {
                    body: { action: 'create', userData: { email: finalEmail, password: finalPassword, ...profileData } }
                });
                if (registerError) throw registerError;

                const newUser = registerData?.user;
                if (newUser?.id) {
                    await supabase.from('profiles').update({
                        birthdate: birthdate || undefined,
                        document_number: documentNumber || undefined,
                        gender: gender || undefined,
                    }).eq('id', newUser.id);

                    // Lógica Obreros
                    const hasMaestroRoles = finalRoles.some(r => ['maestro', 'colaborador', 'ayudante', 'lider'].includes(r as string));
                    if (hasMaestroRoles && finalDeptId) {
                        const firstDeptObj = departments.find(d => d.id === finalDeptId);
                        if (firstDeptObj?.classes?.includes("Obreros")) {
                            const { data: existingStudent } = await supabase
                                .from('students').select('id').eq('profile_id', newUser.id).maybeSingle();
                            if (existingStudent) {
                                await supabase.from('students').update({ assigned_class: 'Obreros' }).eq('id', existingStudent.id);
                            } else {
                                await supabase.from('students').insert({
                                    first_name: firstName, last_name: lastName || "",
                                    phone: phone || null, department: firstDeptObj?.name || null,
                                    department_id: finalDeptId, assigned_class: 'Obreros',
                                    gender: gender || "masculino", birthdate: birthdate || null,
                                    document_number: documentNumber || null,
                                    profile_id: newUser.id, company_id: getPersistentCompanyId()
                                });
                            }
                        }
                    }
                }
            }

            toast({
                title: isEditMode ? "Usuario actualizado" : "Registro exitoso",
                description: isEditMode ? "Los datos del usuario han sido actualizados." : "El usuario ha sido registrado exitosamente.",
            });

            clearForm();
            setOpen(false);
            if (onSuccess) onSuccess();

        } catch (error: any) {
            console.error("Error:", error);
            let msg = error.message || "Ha ocurrido un error";
            if (msg.includes("User already registered")) msg = "Este correo electrónico ya está registrado";
            toast({ title: "Error", description: msg, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    // Departments available for the logged-in user to assign
    const availableDepts = departments.filter(d =>
        (!isLoggedInDirector && !isLoggedInVicedirector && !isLoggedInDirectorGeneral)
        || profile?.departments?.includes(d.name)
    );

    // Depts not yet used in assignments (for add-form)
    const usedDeptRolePairs = assignments.map(a => `${a.role}__${a.department}`);
    const unassignedDepts = availableDepts.filter(
        d => !assignments.some(a => a.department === d.name && a.role === tempRole)
    );

    // Roles available for the logged-in user to assign
    const rolesForLoggedIn: AppRole[] = isLoggedInDirector || isLoggedInVicedirector
        ? ['maestro', 'colaborador', 'ayudante'] as AppRole[]
        : isLoggedInDirectorGeneral
            ? ['maestro', 'colaborador', 'ayudante', 'director', 'vicedirector'] as AppRole[]
            : [...ASSIGNABLE_ROLES, 'director_general' as AppRole, 'secr.-calendario' as AppRole, 'conserje' as AppRole, 'admin' as AppRole];

    // Whether the current set of roles needs departments
    const needsDepartment = !standaloneRoles.some(r =>
        ['conserje', 'admin', 'secr.-calendario'].includes(r as string)
    ) || assignments.length > 0;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="w-[95vw] max-w-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-purple-200/50 dark:border-slate-700/50 rounded-3xl shadow-2xl p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl flex items-center gap-2">
                        <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-xl text-purple-600 dark:text-purple-400">
                            {isEditMode ? <Pencil className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
                        </div>
                        {isEditMode ? "Editar Usuario" : "Registrar Usuario"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditMode
                            ? "Modificá los datos del usuario y sus asignaciones de rol, departamento y clase."
                            : "Registrá un nuevo usuario asignándole uno o más roles por departamento."}
                    </DialogDescription>
                </DialogHeader>

                {!isEditMode && (
                    <div className="mt-4 mb-6">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1 mb-2 block">
                            Buscar persona existente (Opcional)
                        </Label>
                        <PersonSearchInput
                            selectedName={selectedPersonId ? `${firstName} ${lastName}` : undefined}
                            onSelect={(person: PersonSearchResult) => {
                                setFirstName(person.first_name); setLastName(person.last_name);
                                setPhone(person.phone || ""); setBirthdate(person.birthdate || "");
                                setGender(person.gender || "masculino"); setAddress(person.address || "");
                                setDocumentNumber(person.document_number || "");
                                setProfileId(person.profile_id || (person.source === 'profile' ? person.id : null));
                                setPersonSource(person.source); setSelectedPersonId(person.id);
                                toast({ title: "Persona seleccionada", description: `Datos cargados de ${person.first_name} ${person.last_name}.` });
                            }}
                        />
                        <p className="text-[10px] text-muted-foreground mt-2 px-1 italic">
                            Si la persona ya existe como miembro o líder, selecciónala para evitar duplicados.
                        </p>
                    </div>
                )}

                <form onSubmit={handleSubmit} className="relative z-10 mt-4">
                    <div className="space-y-6">
                        {/* Personal data */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Nombre</Label>
                                <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Ej. Juan" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Apellido</Label>
                                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Ej. Pérez" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="documentNumber" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">DNI / Documento</Label>
                                <DniIdentityInput id="documentNumber" value={documentNumber} onChange={setDocumentNumber} onFound={handleDniFound} placeholder="Ej. 12345678" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="birthdate" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Fecha de Nacimiento</Label>
                                <Input id="birthdate" type="date" value={birthdate} onChange={(e) => setBirthdate(e.target.value)} className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="gender" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Género</Label>
                                <Select value={gender} onValueChange={setGender}>
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
                                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))} placeholder="Ej. 1122334455" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Correo Electrónico{isEditMode ? " (vacío = sin cambios)" : ""}
                            </Label>
                            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required={!isEditMode} placeholder={isEditMode ? "Dejar vacío para no cambiar" : "ejemplo@correo.com"} autoComplete="off" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all" />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                {isEditMode ? "Nueva Contraseña (vacío = sin cambios)" : "Contraseña Temporal"}
                            </Label>
                            <div className="relative">
                                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required={!isEditMode} placeholder={isEditMode ? "Dejar vacío para no cambiar" : "••••••••"} autoComplete="new-password" className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all pr-12" />
                                <Button type="button" onClick={() => setShowPassword(!showPassword)} variant="ghost" size="icon" className="absolute right-1 top-1 h-10 w-10 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700">
                                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                                </Button>
                            </div>
                        </div>

                        {/* ── ASSIGNMENTS SECTION ── */}
                        <div className="space-y-3 pt-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">
                                Roles y Departamentos
                            </Label>

                            {/* ── CASE 1: logged-in is director/vicedirector → locked dept, choose role + class ── */}
                            {isLockedToSingleDept && profile?.departments?.[0] && (
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 space-y-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200">{profile.departments[0]}</Badge>
                                        <span className="text-xs text-muted-foreground">(departamento fijo)</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Rol</Label>
                                            <Select value={lockedRole} onValueChange={(v) => setLockedRole(v as AppRole)}>
                                                <SelectTrigger className="h-10 rounded-lg text-sm">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {(['maestro', 'colaborador', 'ayudante'] as AppRole[]).map(r => (
                                                        <SelectItem key={r} value={r}>{ROLE_LABELS[r] || r}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Clase (opcional)</Label>
                                            <Select value={lockedClass} onValueChange={setLockedClass} disabled={lockedClasses.length === 0}>
                                                <SelectTrigger className="h-10 rounded-lg text-sm">
                                                    <SelectValue placeholder="Sin clase" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="none" className="text-slate-400 italic text-sm">Sin clase</SelectItem>
                                                    {lockedClasses.map(c => (
                                                        <SelectItem key={c} value={c} className="text-sm">{c}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── CASE 2: standalone roles (no dept needed) — admin, conserje, etc. ── */}
                            {!isLockedToSingleDept && (
                                <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800/50 dark:border-slate-700 space-y-4">

                                    {/* Standalone roles (director_general, conserje, admin, etc.) */}
                                    <div className="space-y-2">
                                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Roles sin departamento</p>
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {(['director_general', 'conserje', 'admin', 'secr.-calendario'] as AppRole[])
                                                .filter(r => rolesForLoggedIn.includes(r))
                                                .map(r => (
                                                    <label key={r} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={standaloneRoles.includes(r)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setStandaloneRoles([...standaloneRoles, r]);
                                                                    if (r === 'director_general') {
                                                                        setAssignments([]);
                                                                    }
                                                                } else {
                                                                    setStandaloneRoles(standaloneRoles.filter(x => x !== r));
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                        />
                                                        <span className="text-sm font-medium capitalize">{ROLE_LABELS[r] || r}</span>
                                                    </label>
                                                ))}
                                        </div>
                                    </div>

                                    {/* Director general: dept checkboxes */}
                                    {isDirectorGeneralMode && (
                                        <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Departamentos del Director General</p>
                                            <div className="grid grid-cols-2 gap-2">
                                                {availableDepts.map(dept => (
                                                    <label key={dept.id} className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDepartments.includes(dept.name)}
                                                            onChange={(e) => {
                                                                if (e.target.checked) setSelectedDepartments([...selectedDepartments, dept.name]);
                                                                else setSelectedDepartments(selectedDepartments.filter(n => n !== dept.name));
                                                            }}
                                                            className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500"
                                                        />
                                                        <span className="text-sm">{dept.name}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Per-dept assignments (role + dept + class) */}
                                    {!isDirectorGeneralMode && (
                                        <div className="space-y-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Asignaciones (rol + departamento + clase)</p>

                                            {/* Existing assignments */}
                                            {assignments.length > 0 && (
                                                <div className="space-y-2">
                                                    {assignments.map((a, idx) => (
                                                        <div key={idx} className="flex items-center justify-between gap-2 bg-white dark:bg-slate-800 rounded-lg px-3 py-2 border border-slate-200 dark:border-slate-700">
                                                            <div className="flex items-center gap-2 flex-wrap min-w-0">
                                                                <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 text-[10px] shrink-0">
                                                                    {ROLE_LABELS[a.role] || a.role}
                                                                </Badge>
                                                                <span className="text-sm font-medium truncate">{a.department}</span>
                                                                {a.assigned_class && (
                                                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px] shrink-0">
                                                                        {a.assigned_class}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0" onClick={() => removeAssignment(idx)}>
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Add new assignment */}
                                            <div className="space-y-2 rounded-lg bg-white dark:bg-slate-800 border border-dashed border-slate-300 dark:border-slate-600 p-3">
                                                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Agregar asignación</p>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {/* Role */}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">Rol</Label>
                                                        <Select value={tempRole} onValueChange={(v) => setTempRole(v as AppRole)}>
                                                            <SelectTrigger className="h-9 rounded-lg text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {rolesForLoggedIn
                                                                    .filter(r => !['director_general', 'conserje', 'admin', 'secr.-calendario'].includes(r as string))
                                                                    .map(r => (
                                                                        <SelectItem key={r} value={r} className="text-xs">{ROLE_LABELS[r] || r}</SelectItem>
                                                                    ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {/* Department */}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">Departamento</Label>
                                                        <Select value={tempDept || "none"} onValueChange={(v) => setTempDept(v === 'none' ? '' : v)}>
                                                            <SelectTrigger className="h-9 rounded-lg text-xs">
                                                                <SelectValue placeholder="Seleccionar" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none" className="text-slate-400 italic text-xs">Seleccionar</SelectItem>
                                                                {availableDepts.map(d => (
                                                                    <SelectItem key={d.id} value={d.name} className="text-xs">{d.name}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                    {/* Class */}
                                                    <div className="space-y-1">
                                                        <Label className="text-[10px] text-muted-foreground">Clase</Label>
                                                        <Select value={tempClass} onValueChange={setTempClass} disabled={tempClasses.length === 0}>
                                                            <SelectTrigger className="h-9 rounded-lg text-xs">
                                                                <SelectValue placeholder="Opcional" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                <SelectItem value="none" className="text-slate-400 italic text-xs">Sin clase</SelectItem>
                                                                {tempClasses.map(c => (
                                                                    <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full h-8 mt-1 border-purple-200 text-purple-700 hover:bg-purple-50 rounded-lg text-xs font-medium"
                                                    onClick={addAssignment}
                                                    disabled={!tempDept}
                                                >
                                                    <Plus className="h-3 w-3 mr-1" />
                                                    Agregar asignación
                                                </Button>
                                            </div>

                                            {assignments.length === 0 && standaloneRoles.length === 0 && (
                                                <p className="text-xs text-amber-600 dark:text-amber-400 italic text-center py-1">
                                                    Agregá al menos una asignación o un rol sin departamento
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-6 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-md shadow-purple-500/20 rounded-xl text-base font-medium transition-all hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-70 disabled:cursor-not-allowed"
                    >
                        {loading ? (
                            <div className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                {isEditMode ? "Guardando..." : "Registrando..."}
                            </div>
                        ) : (
                            isEditMode ? "Guardar Cambios" : "Crear Cuenta de Usuario"
                        )}
                    </Button>
                </form>
            </DialogContent>
        </Dialog>
    );
}
