import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AppRole } from "@/types/database";
import { ChevronDown, Shield } from "lucide-react";

const ROLE_LABELS: Record<AppRole, string> = {
    admin: "Administrador",
    lider: "Líder",
    director: "Director",
    director_general: "Director General",
    maestro: "Maestro",
    secretaria: "Secretaria",
    "secr.-calendario": "Secretaria (Calendario)",
    colaborador: "Colaborador",
    ayudante: "Ayudante",
    vicedirector: "Vicedirector",
    conserje: "Conserje"
};

export function RoleSwitcher() {
    const { profile, switchAssignment } = useAuth();
    const assignments = profile?.assignments || [];

    if (!profile || assignments.length <= 1) {
        return null;
    }

    // Helper to identify if an assignment is the active one
    const isActive = (a: any) =>
        a.role === profile.role &&
        a.department_id === profile.department_id &&
        (a.assigned_class || "") === (profile.assigned_class || "");

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full flex items-center justify-between gap-2 h-10 px-3 border-purple-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm hover:bg-purple-50 dark:hover:bg-slate-800 transition-all shadow-sm rounded-xl">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                            <Shield className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div className="flex flex-col items-start overflow-hidden">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 leading-none mb-1">Activo</span>
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                {ROLE_LABELS[profile.role] || profile.role}
                            </span>
                        </div>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 text-slate-500" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[240px] p-2 rounded-2xl border-slate-200 dark:border-slate-800 shadow-xl backdrop-blur-xl bg-white/95 dark:bg-slate-900/95">
                <DropdownMenuLabel className="px-2 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                    Cambiar Perfil Activo
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="my-1 bg-slate-100 dark:bg-slate-800" />
                <div className="space-y-1">
                    {assignments.map((a) => {
                        const active = isActive(a);
                        return (
                            <DropdownMenuItem
                                key={a.id}
                                onClick={() => switchAssignment(a)}
                                className={`flex flex-col items-start gap-0.5 p-2.5 cursor-pointer rounded-xl transition-all ${active
                                        ? "bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-500"
                                        : "hover:bg-slate-100 dark:hover:bg-slate-800 border-l-4 border-transparent"
                                    }`}
                            >
                                <div className="flex items-center justify-between w-full">
                                    <span className={`text-xs font-bold ${active ? "text-purple-700 dark:text-purple-400" : "text-slate-700 dark:text-slate-200"}`}>
                                        {ROLE_LABELS[a.role] || a.role}
                                    </span>
                                    {active && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                                        {a.department}
                                    </span>
                                    {a.assigned_class && (
                                        <>
                                            <span className="text-slate-300 dark:text-slate-600">•</span>
                                            <span className="text-[10px] font-medium text-purple-600/70 dark:text-purple-400/70">
                                                {a.assigned_class}
                                            </span>
                                        </>
                                    )}
                                </div>
                            </DropdownMenuItem>
                        );
                    })}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
