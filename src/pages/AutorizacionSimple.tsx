import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Users, Phone, User, FileText, Info } from "lucide-react";
import { jsPDF } from "jspdf";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { format, parseISO } from "date-fns";


const AutorizacionRhema = () => {
  const [loading, setLoading] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company'],
    queryFn: () => getCompany(1)
  });
  const [formData, setFormData] = useState({
    fechaEvento: "",
    horaInicio: "",
    horaFin: "",
    tipoEvento: "",
    lugarEvento: "",
    descripcionEvento: "",
    liderDirector: "",
    telefono: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fechaOpen, setFechaOpen] = useState(false);

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
    const newErrors: Record<string, string> = {};

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
      const companyData = company as any;
      const authPdfHeader = (companyData?.auth_pdf_header && Array.isArray(companyData.auth_pdf_header))
        ? companyData.auth_pdf_header
        : [
          { text: "Asociación de Beneficencia y Educación RHEMA", enabled: true },
          { text: "Personería Jurídica N° 23.212 (Leg. 111.169 – D.P.P.J.)", enabled: true },
          { text: "Libertad 3248, El Talar, Pdo. de Tigre, Pcia. Bs. As.", enabled: true },
          { text: "C.U.I.T. N° 30-70792033-1", enabled: true }
        ];

      authPdfHeader.forEach((line: any, index: number) => {
        if (!line.enabled) return;

        if (index === 0) {
          doc.setFontSize(12);
          doc.setFont("helvetica", "bold");
          doc.text(line.text, margin, currentY);
          doc.text(getCurrentDate(), pageWidth - margin - 50, currentY);
          currentY += 5;
        } else {
          doc.setFontSize(10);
          doc.setFont("helvetica", "normal");
          doc.text(line.text, margin, currentY);
          currentY += 4;
        }
      });

      currentY += 9;

      // Saludo
      doc.setFont("helvetica", "bold");
      doc.text("Señores Padres:", margin, currentY);

      currentY += 10;

      // Cuerpo de la carta
      doc.setFont("helvetica", "normal");
      const parrafo1 = `Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que se está organizando una ${data.tipoEvento.toLowerCase()}, que será en: ${data.lugarEvento}.`;

      // Dividir texto en líneas
      const lines1 = doc.splitTextToSize(parrafo1, pageWidth - margin * 2);
      lines1.forEach((line) => {
        doc.text(line, margin, currentY);
        currentY += 5;
      });

      currentY += 5;

      const parrafo2 = `La salida se realizará el día ${fechaEventoFormatted}, a las ${data.horaInicio} hs., regresando aproximadamente a las ${data.horaFin} hs.`;

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
      doc.text("Director/Responsable", pageWidth - margin - 50, currentY);
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

      const headerText = authPdfHeader[0]?.text || "Asociación de Beneficencia y Educación RHEMA";
      const textoAutorizacion = `Autorizo a mi hijo/a ................................................................................................ a concurrir a ${data.tipoEvento.toLowerCase()} el día ${fechaEventoFormatted} que organiza "${headerText}", en ${data.lugarEvento}. Conste.-`;

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
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Autorización de Salidas</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Completá los datos para generar la autorización en PDF.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-6 items-start">

          {/* Lado izquierdo: Formulario */}
          <div className="w-full xl:w-1/2 space-y-4">
            <div className="glass-card p-6">
              <h2 className="text-sm font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2 mb-5">
                <Users className="h-4 w-4" />
                Datos de la Actividad
              </h2>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="tipoEvento" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tipo de Evento <span className="text-red-500">*</span></Label>
                    <Input
                      id="tipoEvento"
                      value={formData.tipoEvento}
                      onChange={(e) => handleInputChange('tipoEvento', e.target.value)}
                      placeholder="Ej: Reunión unida para adolescentes"
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.tipoEvento && <p className="text-xs text-red-500">{errors.tipoEvento}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fechaEvento" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha del Evento <span className="text-red-500">*</span></Label>
                    <MuiDatePickerField
                      value={formData.fechaEvento ? parseISO(formData.fechaEvento) : undefined}
                      onChange={(date) => handleInputChange('fechaEvento', date ? format(date, 'yyyy-MM-dd') : '')}
                      open={fechaOpen}
                      onOpenChange={setFechaOpen}
                      placeholder="Seleccionar fecha"
                    />
                    {errors.fechaEvento && <p className="text-xs text-red-500">{errors.fechaEvento}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaInicio" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora de Inicio <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="horaInicio"
                        type="time"
                        value={formData.horaInicio}
                        onChange={(e) => handleInputChange('horaInicio', e.target.value)}
                        className="rounded-xl bg-slate-50 border-slate-200"
                      />
                    </div>
                    {errors.horaInicio && <p className="text-xs text-red-500">{errors.horaInicio}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaFin" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora de Finalización <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="horaFin"
                        type="time"
                        value={formData.horaFin}
                        onChange={(e) => handleInputChange('horaFin', e.target.value)}
                        className="rounded-xl bg-slate-50 border-slate-200"
                      />
                    </div>
                    {errors.horaFin && <p className="text-xs text-red-500">{errors.horaFin}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="liderDirector" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Director/Responsable <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="liderDirector"
                        value={formData.liderDirector}
                        onChange={(e) => handleInputChange('liderDirector', e.target.value)}
                        placeholder="Ej: Juan Pérez"
                        className="rounded-xl bg-slate-50 border-slate-200"
                      />
                    </div>
                    {errors.liderDirector && <p className="text-xs text-red-500">{errors.liderDirector}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="telefono" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="telefono"
                        value={formData.telefono}
                        onChange={(e) => handleInputChange('telefono', e.target.value)}
                        placeholder="Ej: +54 11 1234-5678"
                        className="rounded-xl bg-slate-50 border-slate-200"
                      />
                    </div>
                    {errors.telefono && <p className="text-xs text-red-500">{errors.telefono}</p>}
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label htmlFor="lugarEvento" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lugar del Evento <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="lugarEvento"
                        value={formData.lugarEvento}
                        onChange={(e) => handleInputChange('lugarEvento', e.target.value)}
                        placeholder="Ej: Iglesia Comunidad Cristiana de Saavedra, Holmberg 3261, CABA"
                        className="pl-10 rounded-xl bg-slate-50 border-slate-200"
                      />
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    {errors.lugarEvento && <p className="text-xs text-red-500">{errors.lugarEvento}</p>}
                  </div>

                  <div className="md:col-span-2 space-y-1">
                    <Label htmlFor="descripcionEvento" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Descripción Adicional (Opcional)</Label>
                    <textarea
                      id="descripcionEvento"
                      value={formData.descripcionEvento}
                      onChange={(e) => handleInputChange('descripcionEvento', e.target.value)}
                      placeholder="Información adicional sobre la actividad, transporte, etc."
                      rows={3}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl bg-slate-50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 text-sm resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleSubmit}
                    disabled={loading}
                    className="button-gradient rounded-xl font-black px-8 h-12 shadow-lg shadow-primary/20"
                  >
                    <FileText className="w-5 h-5 mr-2" />
                    {loading ? "Generando PDF..." : "Generar PDF"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Lado derecho: Previsualización */}
          <div className="w-full xl:w-1/2 flex flex-col gap-4 sticky top-6">
            <div className="glass-card overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Vista Previa del Documento
                </h3>
              </div>
              <div className="p-4 bg-slate-50/50 flex justify-center py-8 overflow-hidden hidden md:flex">
                <div className="w-[100%] max-w-[650px] bg-white p-8 sm:p-12 shadow-md font-sans text-black relative scale-[0.70] sm:scale-[0.80] md:scale-90 xl:scale-100 origin-top rounded-lg border border-slate-100">
                  {((company as any)?.auth_pdf_header || [
                    { text: "Asociación de Beneficencia y Educación RHEMA", enabled: true },
                    { text: "Personería Jurídica N° 23.212 (Leg. 111.169 – D.P.P.J.)", enabled: true },
                    { text: "Libertad 3248, El Talar, Pdo. de Tigre, Pcia. Bs. As.", enabled: true },
                    { text: "C.U.I.T. N° 30-70792033-1", enabled: true }
                  ]).filter((l: any) => l.enabled).map((line: any, idx: number) => (
                    <div key={idx} className={idx === 0 ? "flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1 gap-2" : "mb-1"}>
                      <div className={idx === 0 ? "font-bold text-base flex-1" : "text-sm text-gray-800"}>
                        {line.text}
                      </div>
                      {idx === 0 && (
                        <div className="font-bold text-base text-gray-800 whitespace-nowrap">
                          {getCurrentDate()}
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="mt-8 mb-4">
                    <strong className="text-base block">Señores Padres:</strong>
                  </div>

                  <div className="text-sm mt-4 text-gray-800 space-y-4">
                    <p className="text-justify leading-relaxed">
                      Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que se está organizando una {formData.tipoEvento ? formData.tipoEvento.toLowerCase() : "__________"}, que será en: {formData.lugarEvento || "__________"}.
                    </p>
                    <p className="text-justify leading-relaxed">
                      La salida se realizará el día {formData.fechaEvento ? formatDate(formData.fechaEvento) : "__________"}, a las {formData.horaInicio || "__:__"} hs., regresando aproximadamente a las {formData.horaFin || "__:__"} hs.
                    </p>
                    {formData.descripcionEvento && (
                      <p className="text-justify leading-relaxed">
                        {formData.descripcionEvento}
                      </p>
                    )}
                    <p className="text-justify leading-relaxed">
                      Si Uds. están interesados en que su hijo/a concurra a la actividad, les rogamos nos lo hagan saber a la mayor brevedad posible, completando la autorización que se adjunta a la presente.
                    </p>
                  </div>

                  <div className="mt-8 border-t-2 border-dashed border-gray-300 pt-8 opacity-50 flex flex-col items-center">
                    <p className="text-xs text-gray-400 font-bold tracking-widest uppercase mb-2">Resto del documento</p>
                    <div className="h-2 bg-gray-100 rounded w-full mb-2"></div>
                    <div className="h-2 bg-gray-100 rounded w-5/6 mb-2"></div>
                    <div className="h-2 bg-gray-100 rounded w-4/6"></div>
                  </div>
                </div>
              </div>
              <div className="p-8 text-center text-muted-foreground flex md:hidden items-center justify-center">
                Vista previa disponible en pantallas más grandes
              </div>
            </div>

            {/* Información importante */}
            <div className="glass-card p-5 border-l-4 border-primary flex flex-col gap-2">
              <h3 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wider">
                <Info className="h-4 w-4 text-primary" />
                Información importante
              </h3>
              <ul className="text-sm text-slate-500 space-y-1.5 ml-1 leading-relaxed">
                <li>• El documento generado sirve como autorización estándar para cualquier tipo de actividad.</li>
                <li>• Puede ser impreso o enviado digitalmente a los padres.</li>
                <li>• Contiene el texto genérico para autorizaciones y espacios para firma y aclaración.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutorizacionRhema;