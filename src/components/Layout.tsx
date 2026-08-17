
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { CompleteProfileModal } from "./CompleteProfileModal";
import { LoadingOverlay } from "./LoadingOverlay";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { isDemoMode } from "@/lib/demo";
import { PlanLimitBanner } from "./PlanLimitBanner";
import { SuspendedBanner } from "./SuspendedBanner";
import { AppNavbar } from "./AppNavbar";

// Rutas que sigue viendo una cuenta suspendida. El resto redirige a /calendario.
const SUSPENDED_ALLOWED_PATHS = ["/", "/login", "/calendario"];

export function Layout() {
  const { user, profile, loading } = useAuth();
  const isMobile = useIsMobile();
  const location = useLocation();

  // Contenido de la app envuelto en CompanyProvider (necesita estar dentro del Router)
  const content = (
    <CompanyProvider>
      {user && profile ? (
        <SidebarProvider>
          <div className="flex min-h-screen w-full bg-background">
            <AppSidebar />
            <div className="flex-1 min-w-0 flex flex-col">
              {!isMobile && <AppNavbar />}
              <main className={`flex-1 min-w-0 overflow-x-hidden bg-[#f8fafc] dark:bg-slate-900/50 ${isMobile ? 'pt-20' : 'p-4'}`}>
                <PlanLimitBanner />
                {profile.suspended && <SuspendedBanner />}
                <Outlet />
              </main>
            </div>
            {!isDemoMode() && profile.role !== 'system_admin' && <CompleteProfileModal />}
          </div>
        </SidebarProvider>
      ) : (
        <>
          {loading && <LoadingOverlay message="Cargando sesión..." />}
          <Outlet />
        </>
      )}
    </CompanyProvider>
  );

  // Si no hay usuario y no estamos en una pantalla de login (/ o /login), redirigir
  if (!loading && !user && !["/", "/login"].includes(window.location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // Cuenta suspendida: único guard de rutas de la app, cubre todas las pantallas de una vez.
  if (profile?.suspended && !SUSPENDED_ALLOWED_PATHS.includes(location.pathname)) {
    return <Navigate to="/calendario" replace />;
  }

  return content;
}
