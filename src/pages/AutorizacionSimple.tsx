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
import { useToast } from "@/hooks/use-toast";

type FormValues = {
  fecha: string;
  horaSalida: string;
  horaRegreso: string;
  lugarSalida: string;
};

const AutorizacionSimple = () => {
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
      fecha: format(new Date(), "yyyy-MM-dd"),
      horaSalida: "",
      horaRegreso: "",
      lugarSalida: "",
    }
  });

  const generatePDF = (data: FormValues) => {
    const formattedDate = data.fecha ? 
      format(parse(data.fecha, 'yyyy-MM-dd', new Date()), 'dd/MM/yyyy') : '';
    
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;

    const drawAuthorization = (startY: number) => {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("INSTITUTO SAN JOSÉ", pageWidth / 2, startY + 10, { align: "center" });
      
      doc.setFontSize(14);
      doc.text("AUTORIZACIÓN DE SALIDA", pageWidth / 2, startY + 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const contentY = startY + 30;
      const col1X = margin + 5;
      const col2X = pageWidth / 2;
      const lineHeight = 7;

      doc.setFont("helvetica", "bold");
      doc.text("Fecha:", col1X, contentY);
      doc.setFont("helvetica", "normal");
      doc.text(formattedDate, col1X + 20, contentY);

      doc.setFont("helvetica", "bold");
      doc.text("Hora de salida:", col2X - 15, contentY);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaSalida, col2X + 15, contentY);

      doc.setFont("helvetica", "bold");
      doc.text("Hora de regreso:", col1X, contentY + lineHeight);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaRegreso, col1X + 35, contentY + lineHeight);

      doc.setFont("helvetica", "bold");
      doc.text("Lugar de salida:", col1X, contentY + lineHeight * 2);
      doc.setFont("helvetica", "normal");
      doc.text(data.lugarSalida, col1X + 35, contentY + lineHeight * 2);

      const authText = "Por medio de la presente autorizo a mi hijo/a a participar de la salida detallada anteriormente:";
      doc.text(authText, pageWidth / 2, contentY + lineHeight * 4, { align: "center" });

      const signatureY = contentY + lineHeight * 6;
      doc.text("_____________________________", col1X, signatureY);
      doc.text("_____________________________", col2X, signatureY);
      
      doc.setFontSize(8);
      doc.text("Firma del padre/madre/tutor", col1X + 15, signatureY + 5);
      doc.text("Aclaración", col2X + 15, signatureY + 5);

      const emergencyY = signatureY + lineHeight * 2;
      doc.setFontSize(10);
      doc.text("Teléfono de contacto para urgencias: _________________________________", col1X, emergencyY);

      doc.setDrawColor(200);
      doc.line(margin, startY + 85, pageWidth - margin, startY + 85);
    };

    drawAuthorization(margin);
    drawAuthorization(pageHeight / 2);

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
                <Label htmlFor="fecha">Fecha</Label>
                <div className="relative">
                  <Input
                    id="fecha"
                    type="date"
                    {...register("fecha", { required: "Este campo es requerido" })}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.fecha && <p className="text-sm text-destructive">{errors.fecha.message}</p>}
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

export default AutorizacionSimple;
