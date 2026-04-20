
import { Outlet, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PhoneCollectionModal } from "./PhoneCollectionModal";
import { CompleteProfileModal } from "./CompleteProfileModal";
import { LoadingOverlay } from "./LoadingOverlay";
import { CompanyProvider } from "@/contexts/CompanyContext";

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
            <main className={`flex-1 overflow-x-hidden ${isMobile ? 'pt-20' : 'p-4'}`}>
              <Outlet />
            </main>
            <PhoneCollectionModal />
            <CompleteProfileModal />
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

  // Si no hay usuario y no estamos en el login (/), redirigir
  if (!loading && !user && window.location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  return content;
}
