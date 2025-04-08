
import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";

import Index from "./pages/Index";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Departamentos from "./pages/Departamentos";
import PromoverAlumnos from "./pages/PromoverAlumnos";
import AutorizacionesSalida from "./pages/AutorizacionesSalida";

const queryClient = new QueryClient();

function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <ThemeProvider defaultTheme="system" storageKey="vite-react-theme">
            <Toaster />
            
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/home" element={<Home />} />
              <Route path="/departamentos" element={<Departamentos />} />
              <Route path="/promover" element={<PromoverAlumnos />} />
              <Route path="/autorizaciones" element={<AutorizacionesSalida />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            
            <Toaster />
          </ThemeProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}

export default App;
