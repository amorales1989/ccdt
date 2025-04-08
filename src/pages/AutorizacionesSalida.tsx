
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { jsPDF } from "jspdf";
import { Calendar, Download } from "lucide-react";
import { format } from "date-fns";

type FormValues = {
  fecha: string;
  horaSalida: string;
  lugarSalida: string;
  lugarDestino: string;
  horaRegreso: string;
};

const AutorizacionesSalida = () => {
  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      fecha: format(new Date(), "yyyy-MM-dd"),
      horaSalida: "",
      lugarSalida: "",
      lugarDestino: "",
      horaRegreso: "",
    }
  });

  const [loading, setLoading] = useState(false);

  const onSubmit = (data: FormValues) => {
    setLoading(true);
    generatePDF(data);
    setLoading(false);
  };

  const generatePDF = (data: FormValues) => {
    // Create a new jsPDF instance
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 10;
    const authHeight = (pageHeight - margin * 2) / 2;
    
    // Function to draw one authorization
    const drawAuthorization = (y: number) => {
      // Set text color to black
      doc.setTextColor(0, 0, 0);
      
      // Title
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("AUTORIZACIÓN DE SALIDA", pageWidth / 2, y + 10, { align: "center" });
      
      // Subtitle
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Por medio de la presente autorizo a que mi hijo/a participe en la salida", pageWidth / 2, y + 20, { align: "center" });
      
      // Form fields
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      
      const leftMargin = 20;
      const fieldY = y + 30;
      const lineHeight = 10;
      
      doc.text("Día de la salida:", leftMargin, fieldY);
      doc.setFont("helvetica", "normal");
      doc.text(data.fecha, leftMargin + 40, fieldY);
      
      doc.setFont("helvetica", "bold");
      doc.text("Hora de salida:", leftMargin, fieldY + lineHeight);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaSalida, leftMargin + 40, fieldY + lineHeight);
      
      doc.setFont("helvetica", "bold");
      doc.text("Lugar de salida:", leftMargin, fieldY + lineHeight * 2);
      doc.setFont("helvetica", "normal");
      doc.text(data.lugarSalida, leftMargin + 40, fieldY + lineHeight * 2);
      
      doc.setFont("helvetica", "bold");
      doc.text("Lugar de destino:", leftMargin, fieldY + lineHeight * 3);
      doc.setFont("helvetica", "normal");
      doc.text(data.lugarDestino, leftMargin + 40, fieldY + lineHeight * 3);
      
      doc.setFont("helvetica", "bold");
      doc.text("Hora de regreso:", leftMargin, fieldY + lineHeight * 4);
      doc.setFont("helvetica", "normal");
      doc.text(data.horaRegreso, leftMargin + 40, fieldY + lineHeight * 4);

      // Photo/video consent text
      const consentY = fieldY + lineHeight * 5.5;
      doc.setFontSize(8);
      const consentText = "Asimismo, autorizo expresamente el uso de fotografías y/o videos en los que el menor aparezca, tomados durante dicha salida, para ser publicados en las redes sociales oficiales de la congregación con fines institucionales y de difusión.";
      doc.text(consentText, leftMargin, consentY, { 
        align: "justify", 
        maxWidth: pageWidth - leftMargin * 2 
      });
      
      // Signature fields - adjusted spacing to fit everything
      const signY = consentY + lineHeight * 2;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Nombre del alumno/a: ________________________________", leftMargin, signY);
      
      doc.text("Firma del padre/tutor: ________________________________", leftMargin, signY + lineHeight * 1.5);
      
      doc.text("Aclaración: ________________________________", leftMargin, signY + lineHeight * 3);
      
      doc.text("DNI: ________________________________", leftMargin, signY + lineHeight * 4.5);
      
      // Draw border
      doc.setDrawColor(0);
      doc.setLineWidth(0.5);
      doc.rect(margin, y, pageWidth - margin * 2, authHeight - 5);
    };
    
    // Draw two authorizations on the page
    drawAuthorization(margin);
    drawAuthorization(margin + authHeight);
    
    // Save the PDF
    doc.save("autorizacion_salida.pdf");
  };

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-2xl font-bold mb-6">Generar Autorización de Salida</h1>
      
      <Card>
        <CardHeader>
          <CardTitle>Datos de la Salida</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fecha" error={!!errors.fecha}>Fecha de salida</Label>
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
              
              <div className="space-y-2">
                <Label htmlFor="lugarSalida" error={!!errors.lugarSalida}>Lugar de salida</Label>
                <Input
                  id="lugarSalida"
                  {...register("lugarSalida", { required: "Este campo es requerido" })}
                  error={!!errors.lugarSalida}
                />
                {errors.lugarSalida && <p className="text-sm text-destructive">{errors.lugarSalida.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="lugarDestino" error={!!errors.lugarDestino}>Lugar de destino</Label>
                <Input
                  id="lugarDestino"
                  {...register("lugarDestino", { required: "Este campo es requerido" })}
                  error={!!errors.lugarDestino}
                />
                {errors.lugarDestino && <p className="text-sm text-destructive">{errors.lugarDestino.message}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="horaRegreso" error={!!errors.horaRegreso}>Hora de regreso</Label>
                <Input
                  id="horaRegreso"
                  type="time"
                  {...register("horaRegreso", { required: "Este campo es requerido" })}
                  error={!!errors.horaRegreso}
                />
                {errors.horaRegreso && <p className="text-sm text-destructive">{errors.horaRegreso.message}</p>}
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

export default AutorizacionesSalida;
