
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";
import { Calendar, Download } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

type FormValues = {
  fecha: string;
  horaSalida: string;
  motivo: string;
};

const AutorizacionSimple = () => {
  const { profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      fecha: format(new Date(), "yyyy-MM-dd"),
      horaSalida: "",
      motivo: "",
    }
  });

  useEffect(() => {
    if (profile) {
      const authorized = profile.role === 'admin' || profile.role === 'secretaria';
      setIsAuthorized(authorized);
      
      if (!authorized) {
        console.log("User not authorized:", profile.role);
        toast({
          title: "Acceso restringido",
          description: "No tienes permisos para acceder a esta sección",
          variant: "destructive"
        });
        navigate("/");
      }
    }
  }, [profile, navigate, toast]);

  const generatePDF = (data: FormValues) => {
    const formattedDate = data.fecha ? 
      format(parse(data.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : 
      '';
    
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 10;

    // Title
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("AUTORIZACIÓN DE SALIDA SIMPLE", pageWidth / 2, margin + 10, { align: "center" });
    
    // Content
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text("Por medio de la presente autorizo la salida de mi hijo/a", pageWidth / 2, margin + 20, { align: "center" });
    
    // Form fields
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("Fecha:", margin + 5, margin + 40);
    doc.setFont("helvetica", "normal");
    doc.text(formattedDate, margin + 25, margin + 40);
    
    doc.setFont("helvetica", "bold");
    doc.text("Hora de salida:", margin + 5, margin + 50);
    doc.setFont("helvetica", "normal");
    doc.text(data.horaSalida, margin + 35, margin + 50);
    
    doc.setFont("helvetica", "bold");
    doc.text("Motivo:", margin + 5, margin + 60);
    doc.setFont("helvetica", "normal");
    doc.text(data.motivo, margin + 25, margin + 60);
    
    // Signature fields
    const signY = margin + 100;
    doc.text("Firma del padre/tutor:", margin + 5, signY);
    doc.text("________________________________", margin + 45, signY);
    
    doc.text("Aclaración:", margin + 5, signY + 20);
    doc.text("________________________________", margin + 45, signY + 20);
    
    doc.text("DNI:", margin + 5, signY + 40);
    doc.text("________________________________", margin + 45, signY + 40);
    
    doc.save("autorizacion_simple.pdf");
  };

  const onSubmit = (data: FormValues) => {
    setLoading(true);
    generatePDF(data);
    setLoading(false);
  };

  if (!profile) {
    return <div>Cargando...</div>;
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Autorización de Salida Simple</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Datos de la Salida</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha" error={!!errors.fecha}>Fecha</Label>
                <div className="relative">
                  <Input
                    id="fecha"
                    type="date"
                    {...register("fecha", { required: "Este campo es requerido" })}
                    error={!!errors.fecha}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="horaSalida" error={!!errors.horaSalida}>Hora de salida</Label>
                <Input
                  id="horaSalida"
                  type="time"
                  {...register("horaSalida", { required: "Este campo es requerido" })}
                  error={!!errors.horaSalida}
                />
                {errors.horaSalida && <p className="text-sm text-destructive">{errors.horaSalida.message}</p>}
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="motivo" error={!!errors.motivo}>Motivo de la salida</Label>
                <Input
                  id="motivo"
                  {...register("motivo", { required: "Este campo es requerido" })}
                  error={!!errors.motivo}
                />
                {errors.motivo && <p className="text-sm text-destructive">{errors.motivo.message}</p>}
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="mt-4 w-full md:w-auto">
              {loading ? "Generando..." : "Generar PDF"}
              <Download className="ml-2 h-4 w-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutorizacionSimple;
