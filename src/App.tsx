import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Register from "./pages/Register";
import AgregarAlumno from "./pages/AgregarAlumno";
import TomarAsistencia from "./pages/TomarAsistencia";
import HistorialAsistencia from "./pages/HistorialAsistencia";
import ListarAlumnos from "./pages/ListarAlumnos";
import Secretaria from "./pages/Secretaria";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedRoute = ({ children, allowedRoles }: { children: React.ReactNode; allowedRoles?: string[] }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <div>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

const AppContent = () => {
  const isMobile = useIsMobile();
  const { user } = useAuth();
  
  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background to-accent/20">
      <AppSidebar />
      <main className={`flex-1 ${isMobile ? "pt-16" : ""} p-4`}>
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route 
              path="/" 
              element={user ? <Navigate to="/dashboard" replace /> : <Navigate to="/auth" replace />} 
            />
            <Route 
              path="/auth" 
              element={user ? <Navigate to="/dashboard" replace /> : <Auth />} 
            />
            <Route
              path="/register"
              element={
                <ProtectedRoute allowedRoles={["admin", "secretaria"]}>
                  <Register />
                </ProtectedRoute>
              }
            />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Index />
                </ProtectedRoute>
              }
            />
            <Route
              path="/agregar"
              element={
                <ProtectedRoute>
                  <AgregarAlumno />
                </ProtectedRoute>
              }
            />
            <Route
              path="/asistencia"
              element={
                <ProtectedRoute>
                  <TomarAsistencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/historial"
              element={
                <ProtectedRoute>
                  <HistorialAsistencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/listar"
              element={
                <ProtectedRoute>
                  <ListarAlumnos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/secretaria"
              element={
                <ProtectedRoute allowedRoles={["admin", "secretaria"]}>
                  <Secretaria />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </main>
    </div>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <div className="min-h-screen bg-background">
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <SidebarProvider>
              <AppContent />
            </SidebarProvider>
          </BrowserRouter>
        </div>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;