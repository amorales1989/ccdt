
import React, { Suspense } from "react";
import { Outlet, Navigate, Link } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { Bell, LogOut, Settings, Sun, Moon } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import { useTheme } from "@/contexts/ThemeContext";

const Layout = () => {
  const { user, profile, loading, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useIsMobile();

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="flex h-screen">
      <AppSidebar />
      <div className="flex-1 flex flex-col min-h-0">
        {/* Header for desktop */}
        {!isMobile && (
          <header className="h-16 border-b flex items-center justify-end px-6 bg-background">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="mr-2"
                title={theme === "dark" ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
              >
                {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
              </Button>
              <NotificationBell />
              <Link to="/configuracion">
                <Button variant="ghost" size="icon" className="mr-2" title="Configuración">
                  <Settings className="h-5 w-5" />
                </Button>
              </Link>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="mr-2"
                title="Cerrar sesión"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          </header>
        )}
        
        {/* Main content area */}
        <main className="flex-1 overflow-auto p-6 pt-4">
          <Suspense fallback={<div>Cargando...</div>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
};

export default Layout;
