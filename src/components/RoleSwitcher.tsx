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
    vicedirector: "Vicedirector",
    conserje: "Conserje"
};

export function RoleSwitcher() {
    const { profile, switchRole } = useAuth();

    if (!profile || !profile.roles || profile.roles.length <= 1) {
        return null; // Don't show if user has no roles or only 1 role
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="w-full flex items-center justify-between gap-2 h-9 px-3 border-purple-200 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 hover:bg-purple-50 dark:hover:bg-slate-800">
                    <div className="flex items-center gap-2 overflow-hidden">
                        <Shield className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <span className="text-xs flex-1 truncate font-semibold text-gray-700 dark:text-gray-300 text-left">
                            Rol: {ROLE_LABELS[profile.role] || profile.role}
                        </span>
                    </div>
                    <ChevronDown className="w-3.5 h-3.5 opacity-50 text-gray-500" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[200px]">
                <DropdownMenuLabel className="text-xs text-muted-foreground">Cambiar Rol</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {profile.roles.map((r) => (
                    <DropdownMenuItem
                        key={r}
                        onClick={() => switchRole(r)}
                        className={`flex items-center justify-between cursor-pointer ${profile.role === r ? "bg-primary/10 font-medium text-primary" : ""
                            }`}
                    >
                        {ROLE_LABELS[r] || r}
                        {profile.role === r && (
                            <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
