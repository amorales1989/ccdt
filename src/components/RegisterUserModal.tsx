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
    const [role, setRole] = useState<AppRole>("maestro");
    const [selectedDepartment, setSelectedDepartment] = useState<DepartmentType | null>(null);
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

    useEffect(() => {
        if (isDirector && profile.departments?.[0]) {
            setSelectedDepartment(profile.departments[0]);
            setRole("maestro");
        }
    }, [isDirector, profile]);

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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedDepartment) {
            toast({
                title: "Error",
                description: "Por favor seleccione un departamento",
                variant: "destructive",
            });
            return;
        }

        try {
            const { data: currentSessionData } = await supabase.auth.getSession();
            const adminSession = currentSessionData.session;
            const departmentObj = departments.find(d => d.name === selectedDepartment);
            const department_id = departmentObj?.id || "";

            const profileData = {
                first_name: firstName,
                last_name: lastName,
                role,
                departments: [selectedDepartment],
                department_id,
                assigned_class: selectedClass || undefined,
                phone: phone || undefined,
                birthdate: birthdate || undefined,
                gender: gender || undefined,
                address: address || undefined,
                document_number: documentNumber || undefined,
                is_member: (role as string) === 'miembro' || personSource === 'student',
                profile_id: profileId || undefined,
                person_source: personSource || undefined
            };

            await signUp(email, password, profileData);
            await supabase.auth.signOut();

            if (adminSession) {
                await supabase.auth.setSession({
                    access_token: adminSession.access_token,
                    refresh_token: adminSession.refresh_token
                });
            }

            toast({
                title: "Registro exitoso",
                description: "El usuario ha sido registrado exitosamente.",
            });

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
            setSelectedDepartment(null);
            setSelectedClass("");
            setAvailableClasses([]);
            setSelectedPersonId(null);
            setPersonSource(null);

            setOpen(false); // Close Modal

            if (onSuccess) {
                onSuccess();
            }

        } catch (error: any) {
            console.error("Register error:", error);

            let errorMessage = "Ha ocurrido un error";

            if (error.message.includes("User already registered")) {
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
        <Dialog open={open} onOpenChange={setOpen}>
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
                                <Input
                                    id="documentNumber"
                                    value={documentNumber}
                                    onChange={(e) => setDocumentNumber(e.target.value)}
                                    placeholder="Ej. 12345678"
                                    className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                                />
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
                            <Label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Correo Electrónico</Label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                placeholder="ejemplo@correo.com"
                                autoComplete="off"
                                className="h-12 rounded-xl bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Contraseña Temporal</Label>
                            <div className="relative">
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
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
                                <Select value={role} onValueChange={(value: AppRole) => setRole(value)} disabled={isDirector}>
                                    <SelectTrigger className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isDirector ? "bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed" : "bg-slate-50"}`}>
                                        <SelectValue placeholder="Selecciona un rol" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-xl">
                                        <SelectItem value="maestro">Maestro</SelectItem>
                                        <SelectItem value="lider">Líder</SelectItem>
                                        <SelectItem value="director">Director</SelectItem>
                                        <SelectItem value="secretaria">Secretaria</SelectItem>
                                        <SelectItem value="secr.-calendario">Secr.-calendario</SelectItem>
                                        <SelectItem value="admin">Administrador</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="department" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Departamento</Label>
                                <Select
                                    value={selectedDepartment || undefined}
                                    onValueChange={(value: DepartmentType) => setSelectedDepartment(value)}
                                    disabled={isDirector}
                                >
                                    <SelectTrigger className={`h-12 rounded-xl border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all ${isDirector ? "bg-slate-100 dark:bg-slate-800 opacity-80 cursor-not-allowed" : "bg-slate-50"}`}>
                                        <SelectValue placeholder="Selecciona un departamento" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-xl">
                                        {departments.map((dept) => (
                                            <SelectItem key={dept.id} value={dept.name}>
                                                {dept.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        {selectedDepartment && availableClasses.length > 0 && (
                            <div className="space-y-2 pt-2 animate-fade-in">
                                <Label htmlFor="class" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground ml-1">Clase Asignada (Opcional)</Label>
                                <Select value={selectedClass} onValueChange={setSelectedClass}>
                                    <SelectTrigger className="h-12 rounded-xl bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800/30 text-purple-800 dark:text-purple-300 focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all">
                                        <SelectValue placeholder="Selecciona una clase" />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl shadow-xl">
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
