import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import Index from "./pages/Index";
import AgregarAlumno from "./pages/AgregarAlumno";
import TomarAsistencia from "./pages/TomarAsistencia";
import HistorialAsistencia from "./pages/HistorialAsistencia";
import ListarAlumnos from "./pages/ListarAlumnos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  const isMobile = useIsMobile();
  
  return (
    <div className="min-h-screen flex w-full bg-gradient-to-br from-background to-accent/20">
      <AppSidebar />
      <main className={`flex-1 ${isMobile ? "pt-16" : ""} p-4`}>
        <div className="max-w-7xl mx-auto">
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/agregar" element={<AgregarAlumno />} />
            <Route path="/asistencia" element={<TomarAsistencia />} />
            <Route path="/historial" element={<HistorialAsistencia />} />
            <Route path="/listar" element={<ListarAlumnos />} />
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
      <div className="min-h-screen bg-background">
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <SidebarProvider>
            <AppContent />
          </SidebarProvider>
        </BrowserRouter>
      </div>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;