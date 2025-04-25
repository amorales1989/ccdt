
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format, parse } from "date-fns";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";

type FormValues = {
  fechaSalida: string;
  horaSalida: string;
  fechaRegreso: string;
  horaRegreso: string;
  lugarSalida: string;
  lugarDestino: string;
};

const AutorizacionCampamento = () => {
  const { profile } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  
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

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      fechaSalida: format(new Date(), "yyyy-MM-dd"),
      horaSalida: "",
      fechaRegreso: "",
      horaRegreso: "",
      lugarSalida: "",
      lugarDestino: ""
    }
  });

  const generatePDF = (data: FormValues) => {
    // Format dates
    const fechaSalidaFormatted = data.fechaSalida ? 
      format(parse(data.fechaSalida, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '';
    const fechaRegresoFormatted = data.fechaRegreso ? 
      format(parse(data.fechaRegreso, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '';
    
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const authHeight = (pageHeight - margin * 2) / 2;
    
    // Function to draw one authorization
    const drawAuthorization = (startY: number) => {
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("AUTORIZACIÓN PARA CAMPAMENTO", pageWidth / 2, startY + 10, { align: "center" });
      
      // Content
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      
      // Grid layout for info
      const col1X = margin + 5;
      const col2X = pageWidth / 2;
      const lineHeight = 8;
      let currentY = startY + 25;
      
      // Departure info
      doc.setFont("helvetica", "bold");
      doc.text("Fecha de salida:", col1X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(fechaSalidaFormatted, col1X + 25, currentY);
      
      doc.setFont("helvetica", "bold");
      doc.text("Hora de salida:", col2X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaSalida, col2X + 25, currentY);
      
      currentY += lineHeight * 1.5;
      
      // Return info
      doc.setFont("helvetica", "bold");
      doc.text("Fecha de regreso:", col1X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(fechaRegresoFormatted, col1X + 30, currentY);
      
      doc.setFont("helvetica", "bold");
      doc.text("Hora de regreso:", col2X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaRegreso, col2X + 25, currentY);
      
      currentY += lineHeight * 1.5;
      
      // Location info
      doc.setFont("helvetica", "bold");
      doc.text("Lugar de salida:", col1X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.lugarSalida, col1X + 25, currentY);
      
      currentY += lineHeight;
      
      doc.setFont("helvetica", "bold");
      doc.text("Lugar del campamento:", col1X, currentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.lugarDestino, col1X + 35, currentY);
      
      // Parent/Guardian info section
      currentY += lineHeight * 2;
      
      // Signature fields
      const signatureY = currentY + 5;
      doc.text("Nombre del alumno/a: _________________________________", col1X, signatureY);
      doc.text("Teléfono de urgencias: _______________________________", col2X - 15, signatureY);
      
      doc.text("Firma del padre/tutor: _______________________________", col1X, signatureY + lineHeight * 2);
      doc.text("Aclaración: _______________________________________", col2X - 15, signatureY + lineHeight * 2);
      
      // Draw border around the authorization
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(margin, startY, pageWidth - margin * 2, authHeight - 5);
    };
    
    // Draw both authorizations
    drawAuthorization(margin);
    drawAuthorization(margin + authHeight);
    
    doc.save("autorizacion_campamento.pdf");
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
      <h1 className="text-2xl font-bold mb-6">Autorización de Campamento</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Datos del Campamento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Fecha y hora de salida */}
              <div className="space-y-2">
                <Label htmlFor="fechaSalida">Fecha de salida</Label>
                <div className="relative">
                  <Input
                    id="fechaSalida"
                    type="date"
                    {...register("fechaSalida", { required: "Este campo es requerido" })}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.fechaSalida && <p className="text-sm text-destructive">{errors.fechaSalida.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="horaSalida">Hora de salida</Label>
                <div className="relative">
                  <Input
                    id="horaSalida"
                    type="time"
                    {...register("horaSalida", { required: "Este campo es requerido" })}
                  />
                  <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.horaSalida && <p className="text-sm text-destructive">{errors.horaSalida.message}</p>}
              </div>

              {/* Fecha y hora de regreso */}
              <div className="space-y-2">
                <Label htmlFor="fechaRegreso">Fecha de regreso</Label>
                <div className="relative">
                  <Input
                    id="fechaRegreso"
                    type="date"
                    {...register("fechaRegreso", { required: "Este campo es requerido" })}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.fechaRegreso && <p className="text-sm text-destructive">{errors.fechaRegreso.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="horaRegreso">Hora de regreso</Label>
                <div className="relative">
                  <Input
                    id="horaRegreso"
                    type="time"
                    {...register("horaRegreso", { required: "Este campo es requerido" })}
                  />
                  <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.horaRegreso && <p className="text-sm text-destructive">{errors.horaRegreso.message}</p>}
              </div>

              {/* Lugares */}
              <div className="space-y-2">
                <Label htmlFor="lugarSalida">Lugar de salida</Label>
                <div className="relative">
                  <Input
                    id="lugarSalida"
                    {...register("lugarSalida", { required: "Este campo es requerido" })}
                  />
                  <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.lugarSalida && <p className="text-sm text-destructive">{errors.lugarSalida.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lugarDestino">Lugar del campamento</Label>
                <div className="relative">
                  <Input
                    id="lugarDestino"
                    {...register("lugarDestino", { required: "Este campo es requerido" })}
                  />
                  <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.lugarDestino && <p className="text-sm text-destructive">{errors.lugarDestino.message}</p>}
              </div>
            </div>
            
            <Button type="submit" disabled={loading} className="mt-4 w-full md:w-auto">
              {loading ? "Generando..." : "Generar PDF"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AutorizacionCampamento;
