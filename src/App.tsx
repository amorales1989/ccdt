
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { Toaster } from "@/components/ui/toaster";
import Layout from "@/components/Layout";
import Index from "@/pages/Index";
import Auth from "@/pages/Auth";
import ListarAlumnos from "@/pages/ListarAlumnos";
import AgregarAlumno from "@/pages/AgregarAlumno";
import TomarAsistencia from "@/pages/TomarAsistencia";
import HistorialAsistencia from "@/pages/HistorialAsistencia";
import NotFound from "@/pages/NotFound";
import Register from "@/pages/Register";
import Configuration from "@/pages/Configuration";
import Departamentos from "@/pages/Departamentos";
import GestionUsuarios from "@/pages/GestionUsuarios";
import Calendario from "@/pages/Calendario";
import PromoverAlumnos from "@/pages/PromoverAlumnos";
import Secretaria from "@/pages/Secretaria";
import Notificaciones from "@/pages/Notificaciones";

function App() {
  const queryClient = new QueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Layout />}>
                <Route index element={<Index />} />
                <Route path="listar" element={<ListarAlumnos />} />
                <Route path="agregar" element={<AgregarAlumno />} />
                <Route path="asistencia" element={<TomarAsistencia />} />
                <Route path="historial" element={<HistorialAsistencia />} />
                <Route path="register" element={<Register />} />
                <Route path="configuracion" element={<Configuration />} />
                <Route path="departamentos" element={<Departamentos />} />
                <Route path="gestion-usuarios" element={<GestionUsuarios />} />
                <Route path="calendario" element={<Calendario />} />
                <Route path="promover" element={<PromoverAlumnos />} />
                <Route path="secretaria" element={<Secretaria />} />
                <Route path="notificaciones" element={<Notificaciones />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
