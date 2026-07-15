import { HelpCircle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "./NotificationBell";
import { StudentSearch } from "./StudentSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { getStudents } from "@/lib/api";

const PAGE_TITLES: Record<string, string> = {
  "/": "Inicio",
  "/home": "Inicio",
  "/todos-los-miembros": "Todos los Miembros",
  "/listar": "Lista de Miembros",
  "/agregar": "Agregar Miembro",
  "/calendario": "Calendario",
  "/material": "Material Didáctico",
  "/informes": "Informes de Personal",
  "/asistencia": "Tomar Asistencia",
  "/autorizaciones": "Autorizaciones",
  "/autorizaciones/campamento": "Autorizaciones",
  "/autorizaciones/simple": "Autorizaciones",
  "/promover": "Promover Miembros",
  "/historial": "Historial",
  "/estadisticas": "Estadísticas",
  "/registro-temas": "Registro de Temas",
  "/departamentos": "Departamentos",
  "/grupos": "Grupos Pequeños",
  "/contabilidad": "Contabilidad",
  "/gestion-usuarios": "Gestión de Usuarios",
  "/notificaciones": "Notificaciones",
  "/configuracion": "Configuración",
  "/mantenimiento": "Mantenimiento",
  "/guia": "Guía de Uso",
  "/secretaria": "Secretaría",
  "/admin-sistema": "Empresas",
};

export function AppNavbar() {
  const location = useLocation();
  const { profile } = useAuth();
  const { companyId } = useCompany();

  const title = PAGE_TITLES[location.pathname] || "";
  const isAdminOrSecretary = profile?.role === 'admin' || profile?.role === 'secretaria';

  const { data: students = [] } = useQuery({
    queryKey: ['navbar-search-students', companyId],
    queryFn: async () => await getStudents({}) || [],
    enabled: isAdminOrSecretary,
    staleTime: 5 * 60 * 1000,
  });

  return (
    <header className="sticky top-0 z-40 flex items-center gap-4 h-16 px-4 sm:px-6 border-b border-border bg-background/80 backdrop-blur-xl">
      <h1 className="text-lg font-black text-slate-800 dark:text-white tracking-tight truncate shrink-0 max-w-[40%]">
        {title}
      </h1>

      <div className="flex-1 flex justify-center">
        {isAdminOrSecretary && (
          <div className="w-full max-w-md">
            <StudentSearch students={students} compact />
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <NotificationBell />
        <Button asChild variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-slate-500 hover:text-primary hover:bg-purple-50 dark:hover:bg-purple-900/20">
          <Link to="/guia" aria-label="Guía de uso">
            <HelpCircle className="h-5 w-5" />
          </Link>
        </Button>
      </div>
    </header>
  );
}
