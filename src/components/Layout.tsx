
import { Outlet, Navigate } from "react-router-dom";
import { AppSidebar } from "./AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { PhoneCollectionModal } from "./PhoneCollectionModal";
import { LoadingOverlay } from "./LoadingOverlay";

export function Layout() {
  const { user, loading } = useAuth();
  const isMobile = useIsMobile();

  // Si no hay usuario y no estamos en el login (/), redirigir
  if (!loading && !user && window.location.pathname !== "/") {
    return <Navigate to="/" replace />;
  }

  // Si no hay usuario, mostramos el contenido (Index.tsx es el login) pero sin sidebar
  if (!user) {
    return <Outlet />;
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        {loading && <LoadingOverlay message="Cargando sesión..." />}
        <AppSidebar />
        <main className={`flex-1 overflow-x-hidden ${isMobile ? 'pt-20' : 'p-4'}`}>
          <Outlet />
        </main>
        <PhoneCollectionModal />
      </div>
    </SidebarProvider>
  );
}
