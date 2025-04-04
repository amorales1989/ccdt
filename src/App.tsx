import React, { lazy } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ui/theme-provider";
import { AuthProvider } from "@/contexts/AuthContext";
import { Layout } from "@/components/Layout";
import { Home } from "@/pages/Home";
import { Auth } from "@/pages/Auth";
import { Register } from "@/pages/Register";
import { TomarAsistencia } from "@/pages/TomarAsistencia";
import { ListarAlumnos } from "@/pages/ListarAlumnos";
import { AgregarAlumno } from "@/pages/AgregarAlumno";
import { PromoverAlumnos } from "@/pages/PromoverAlumnos";
import { HistorialAsistencia } from "@/pages/HistorialAsistencia";
import { Calendario } from "@/pages/Calendario";
import { GestionUsuarios } from "@/pages/GestionUsuarios";
import { Departamentos } from "@/pages/Departamentos";
import { Configuration } from "@/pages/Configuration";
import { NotFound } from "@/pages/NotFound";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { Secretaria } from "@/pages/Secretaria";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light" storageKey="ui-theme">
        <AuthProvider>
          <Router>
            <Layout>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/register" element={<Register />} />
                <Route path="/asistencia" element={<TomarAsistencia />} />
                <Route path="/listar" element={<ListarAlumnos />} />
                <Route path="/agregar" element={<AgregarAlumno />} />
                <Route path="/promover" element={<PromoverAlumnos />} />
                <Route path="/historial" element={<HistorialAsistencia />} />
                <Route path="/calendario" element={<Calendario />} />
                <Route path="/gestion-usuarios" element={<GestionUsuarios />} />
                <Route path="/departamentos" element={<Departamentos />} />
                <Route path="/configuracion" element={<Configuration />} />
                <Route path="/secretaria" element={<Secretaria />} />
                <Route path="/notificaciones" element={lazy(() => import("./pages/Notificaciones"))} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Layout>
          </Router>
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
