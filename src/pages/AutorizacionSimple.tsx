import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Users, Phone, User } from "lucide-react";
import { jsPDF } from "jspdf";


const AutorizacionRhema = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fechaEvento: new Date().toISOString().split('T')[0],
    horaInicio: "",
    horaFin: "",
    tipoEvento: "Reunión unida para adolescentes",
    lugarEvento: "",
    descripcionEvento: "",
    liderDirector: "",
    telefono: ""
  });

  const [errors, setErrors] = useState({});

  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    // Dividir la fecha en partes para evitar problemas de zona horaria
    const [year, month, day] = dateString.split('-').map(num => parseInt(num, 10));
    
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return `${day} de ${months[month - 1]} de ${year}`;
  };

  const getCurrentDate = () => {
    const today = new Date();
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    return `${today.getDate()} de ${months[today.getMonth()]} de ${today.getFullYear()}`;
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.fechaEvento) newErrors.fechaEvento = "Este campo es requerido";
    if (!formData.horaInicio) newErrors.horaInicio = "Este campo es requerido";
    if (!formData.horaFin) newErrors.horaFin = "Este campo es requerido";
    if (!formData.tipoEvento) newErrors.tipoEvento = "Este campo es requerido";
    if (!formData.lugarEvento) newErrors.lugarEvento = "Este campo es requerido";
    if (!formData.liderDirector) newErrors.liderDirector = "Este campo es requerido";
    if (!formData.telefono) newErrors.telefono = "Este campo es requerido";
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generatePDF = async (data) => {
    const fechaEventoFormatted = formatDate(data.fechaEvento);
    
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    
    // Cargar la imagen de la tijera
    let tijeraImage = null;
    try {
      const response = await fetch('/tijera.png');
      const blob = await response.blob();
      const reader = new FileReader();
      tijeraImage = await new Promise((resolve) => {
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.log('No se pudo cargar la imagen de la tijera:', error);
    }

    // Función para dibujar la autorización completa
    const drawAuthorizationDocument = () => {
      let currentY = margin;
      
      // Encabezado de la organización
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Asociación de Beneficencia y Educación RHEMA", margin, currentY);
      doc.text(getCurrentDate(), pageWidth - margin - 50, currentY);
      currentY += 5;
      
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Personería Jurídica N° 23.212 (Leg. 111.169 – D.P.P.J.)", margin, currentY);
      currentY += 4;
      doc.text("Libertad 3248, El Talar, Pdo. de Tigre, Pcia. Bs. As.", margin, currentY);
      currentY += 4;
      doc.text("C.U.I.T. N° 30-70792033-1", margin, currentY);
      
      currentY += 15;
      
      // Saludo
      doc.setFont("helvetica", "bold");
      doc.text("Señores Padres:", margin, currentY);
      
      currentY += 10;
      
      // Cuerpo de la carta
      doc.setFont("helvetica", "normal");
      const parrafo1 = `Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que se está organizando una ${data.tipoEvento.toLowerCase()}. En esta oportunidad ${data.tipoEvento.toLowerCase()} se realizará en ${data.lugarEvento}.`;
      
      // Dividir texto en líneas
      const lines1 = doc.splitTextToSize(parrafo1, pageWidth - margin * 2);
      lines1.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 5;
      });
      
      currentY += 5;
      
      const parrafo2 = `${data.tipoEvento} se realizará el día ${fechaEventoFormatted}. La actividad comenzará a las ${data.horaInicio} hs., y terminará a las ${data.horaFin} hs.`;
      
      const lines2 = doc.splitTextToSize(parrafo2, pageWidth - margin * 2);
      lines2.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 5;
      });
      
      currentY += 5;
      
      if (data.descripcionEvento) {
        const lines3 = doc.splitTextToSize(data.descripcionEvento, pageWidth - margin * 2);
        lines3.forEach((line) => {
          doc.text(line, margin, currentY);
          currentY += 5;
        });
        currentY += 5;
      }
      
      const parrafo3 = "Si Uds. están interesados en que su hijo/a concurra a la actividad, les rogamos nos lo hagan saber a la mayor brevedad posible, completando la autorización que se adjunta a la presente.";
      
      const lines3 = doc.splitTextToSize(parrafo3, pageWidth - margin * 2);
      lines3.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 5;
      });
      
      currentY += 10;
      
      doc.text("Sin otro particular, les saludamos muy atentamente.", margin, currentY);
      
      currentY += 20;
      
      // Firma del director
      doc.setFont("helvetica", "bold");
      doc.text(formData.liderDirector, pageWidth - margin - 60, currentY);
      currentY += 4;
      doc.setFont("helvetica", "normal");
      doc.text("Director", pageWidth - margin - 50, currentY);
      currentY += 4;
      doc.text(`Teléfono: ${formData.telefono}`, pageWidth - margin - 60, currentY);
      currentY += 20;

      doc.addImage(tijeraImage, 'PNG', margin, currentY - 3, 6, 6);
      doc.text("   ................................................................................................................................................................................", margin, currentY);
      currentY += 20;
      // Sección de autorización
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("AUTORIZACIÓN", pageWidth / 2, currentY, { align: "center" });
      
      currentY += 20;
      
      // Texto de autorización
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      
      const textoAutorizacion = `Autorizo a mi hijo/a ................................................................................................ a concurrir a ${data.tipoEvento.toLowerCase()} el día ${fechaEventoFormatted} que organiza "Asociación de Beneficencia y Educación RHEMA", en ${data.lugarEvento}. Conste.-`;
      
      const linesAuth = doc.splitTextToSize(textoAutorizacion, pageWidth - margin * 2);
      linesAuth.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 7;
      });
      
      currentY += 15;
      
      // Firma del padre o tutor
      doc.text("FIRMA DEL PADRE ó TUTOR: …………................................................................................", margin, currentY);
      
      currentY += 15;
      
      // Aclaración
      doc.text("ACLARACIÓN: ........................................................................................................................", margin, currentY);

      currentY += 15;
      
      // telefono de urgencias
      doc.text("N° de contacto en caso de emergencia: .................................................................................", margin, currentY);
    };
    
    drawAuthorizationDocument();
    
    doc.save("autorizacion_rhema.pdf");
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Limpiar error cuando el usuario empiece a escribir
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      generatePDF(formData);
      setLoading(false);
    }, 500);
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2 text-center">Autorización para Actividades</h1>
      <p className="text-center text-gray-600 mb-8">Asociación de Beneficencia y Educación RHEMA</p>
      
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Datos de la Actividad
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tipoEvento">Tipo de Evento</Label>
                <Input
                  id="tipoEvento"
                  value={formData.tipoEvento}
                  onChange={(e) => handleInputChange('tipoEvento', e.target.value)}
                  placeholder="Ej: Reunión unida para adolescentes"
                />
                {errors.tipoEvento && <p className="text-sm text-red-500">{errors.tipoEvento}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="fechaEvento">Fecha del Evento</Label>
                <div className="relative">
                  <Input
                    id="fechaEvento"
                    type="date"
                    value={formData.fechaEvento}
                    onChange={(e) => handleInputChange('fechaEvento', e.target.value)}
                  />
                  <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.fechaEvento && <p className="text-sm text-red-500">{errors.fechaEvento}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaInicio">Hora de Inicio</Label>
                <div className="relative">
                  <Input
                    id="horaInicio"
                    type="time"
                    value={formData.horaInicio}
                    onChange={(e) => handleInputChange('horaInicio', e.target.value)}
                  />
                  <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.horaInicio && <p className="text-sm text-red-500">{errors.horaInicio}</p>}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="horaFin">Hora de Finalización</Label>
                <div className="relative">
                  <Input
                    id="horaFin"
                    type="time"
                    value={formData.horaFin}
                    onChange={(e) => handleInputChange('horaFin', e.target.value)}
                  />
                  <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.horaFin && <p className="text-sm text-red-500">{errors.horaFin}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="liderDirector">Nombre del Director</Label>
                <div className="relative">
                  <Input
                    id="liderDirector"
                    value={formData.liderDirector}
                    onChange={(e) => handleInputChange('liderDirector', e.target.value)}
                    placeholder="Ej: Juan Pérez"
                  />
                  <User className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.liderDirector && <p className="text-sm text-red-500">{errors.liderDirector}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <div className="relative">
                  <Input
                    id="telefono"
                    value={formData.telefono}
                    onChange={(e) => handleInputChange('telefono', e.target.value)}
                    placeholder="Ej: +54 11 1234-5678"
                  />
                  <Phone className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.telefono && <p className="text-sm text-red-500">{errors.telefono}</p>}
              </div>

              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="lugarEvento">Lugar del Evento</Label>
                <div className="relative">
                  <Input
                    id="lugarEvento"
                    value={formData.lugarEvento}
                    onChange={(e) => handleInputChange('lugarEvento', e.target.value)}
                    placeholder="Ej: Iglesia Comunidad Cristiana de Saavedra, Holmberg 3261, CABA"
                  />
                  <MapPin className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
                {errors.lugarEvento && <p className="text-sm text-red-500">{errors.lugarEvento}</p>}
              </div>
              
              <div className="md:col-span-2 space-y-2">
                <Label htmlFor="descripcionEvento">Descripción Adicional (Opcional)</Label>
                <textarea
                  id="descripcionEvento"
                  value={formData.descripcionEvento}
                  onChange={(e) => handleInputChange('descripcionEvento', e.target.value)}
                  placeholder="Información adicional sobre la actividad, transporte, etc."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <Button 
              onClick={handleSubmit}
              disabled={loading} 
              className="w-full md:w-auto px-8 py-2 text-lg"
              size="lg"
            >
              {loading ? "Generando PDF..." : "Generar Autorización PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">Información:</h3>
        <p className="text-blue-800 text-sm">
          Esta autorización replica el formato oficial de la Asociación de Beneficencia y Educación RHEMA.
          El PDF generado incluirá el encabezado institucional, la carta a los padres y la sección de autorización
          con espacios para completar el nombre del alumno, firma del padre/tutor y aclaración.
        </p>
      </div>
    </div>
  );
};

export default AutorizacionRhema;