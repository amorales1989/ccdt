
import { Outlet, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PhoneCollectionModal } from "./PhoneCollectionModal";
import { CompleteProfileModal } from "./CompleteProfileModal";
import { LoadingOverlay } from "./LoadingOverlay";
import { CompanyProvider } from "@/contexts/CompanyContext";
import { isDemoMode } from "@/lib/demo";
import { PlanLimitBanner } from "./PlanLimitBanner";
import { AppNavbar } from "./AppNavbar";

export function Layout() {
  const { user, profile, loading } = useAuth();
  const isMobile = useIsMobile();

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
                <Outlet />
              </main>
            </div>
            {!isDemoMode() && profile.role !== 'system_admin' && <PhoneCollectionModal />}
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

  return content;
}
