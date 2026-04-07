import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, MapPin, Users, FileText, List, Info } from "lucide-react";
import { jsPDF } from "jspdf";
import { useQuery } from "@tanstack/react-query";
import { getCompany } from "@/lib/api";
import { getPersistentCompanyId } from "@/contexts/CompanyContext";
import { MuiDatePickerField } from "@/components/MuiDatePickerField";
import { format, parseISO } from "date-fns";

const AutorizacionCampamento = () => {
  const [loading, setLoading] = useState(false);
  const [inicioOpen, setInicioOpen] = useState(false);
  const [finOpen, setFinOpen] = useState(false);
  const [limiteOpen, setLimiteOpen] = useState(false);

  const { data: company } = useQuery({
    queryKey: ['company', getPersistentCompanyId()],
    queryFn: () => getCompany(getPersistentCompanyId())
  });

  // Lista por defecto de elementos
  const elementosDefault = `• Sábanas, frazadas
• Ropa liviana
• Un pullover o campera
• Short / malla de baño (en el caso de las chicas solo se permite llevar
  malla enteriza o short y remera) sin excepción
• Ojotas y zapatillas
• Gorro para el sol
• Toalla y elementos de higiene (cepillo de dientes, dentífrico, jabón, peine, etc.).
• Biblia`;

  const [formData, setFormData] = useState({
    fechaInicio: "",
    fechaFin: "",
    lugar: "",
    costo: "",
    fechaLimite: "",
    horaSalida1: "",
    horaSalida2: "",
    horaRegreso: "",
    liderDirector: "",
    telefono: "",
    elementos: elementosDefault
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [fechaInicioOpen, setFechaInicioOpen] = useState(false);
  const [fechaFinOpen, setFechaFinOpen] = useState(false);
  const [fechaLimiteOpen, setFechaLimiteOpen] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "costo") {
      const numericValue = value.replace(/\D/g, "");
      const formattedValue = numericValue ? new Intl.NumberFormat("es-AR").format(parseInt(numericValue, 10)) : "";
      setFormData(prev => ({
        ...prev,
        [name]: formattedValue
      }));
      return;
    }

    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const handleDateChange = (name: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));

    if (errors[name]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const formatDate = (dateStr) => {
    // Simplemente reorganizar el string sin crear objeto Date
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const getCurrentDate = () => {
    const today = new Date();
    const day = String(today.getDate()).padStart(2, '0');
    const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    const month = months[today.getMonth()];
    const year = today.getFullYear();
    return `${day} de ${month} del ${year}`;
  };

  const getMonthName = (monthNumber) => {
    const months = [
      'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
      'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    return months[parseInt(monthNumber) - 1];
  };

  const generatePDF = () => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
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

    currentY += 6;

    // Saludo
    doc.text("Señores Padres:", margin, currentY);
    currentY += 10;

    // Cuerpo de la carta
    const textoIntro = `Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que estamos organizando el campamento para adolescentes que cada año hacemos. En esta oportunidad el campamento se realizará en el domicilio ${formData.lugar}`;

    // Dividir texto en líneas manualmente
    const lineas = [
      "Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que estamos",
      "organizando el campamento para adolescentes que cada año hacemos. En esta",
      `oportunidad el campamento se realizará en el domicilio ${formData.lugar.substring(0, 30)}`,
      formData.lugar.length > 30 ? formData.lugar.substring(30) : ""
    ].filter(linea => linea.trim());

    lineas.forEach(linea => {
      doc.text(linea, margin, currentY);
      currentY += 5;
    });
    currentY += 3;

    // Detalles del campamento
    const inicioFormatted = formatDate(formData.fechaInicio);
    const finFormatted = formatDate(formData.fechaFin);
    const mesNombre = finFormatted ? getMonthName(finFormatted.split('/')[1]) : "______";
    const año = finFormatted ? finFormatted.split('/')[2] : "______";
    const inicioDia = inicioFormatted ? inicioFormatted.split('/')[0] : "____";
    const finDia = finFormatted ? finFormatted.split('/')[0] : "____";

    doc.text(`El campamento se realizará los días ${inicioDia} al ${finDia} de ${mesNombre} del ${año}. Vamos`, margin, currentY);
    currentY += 4;
    doc.text(`a salir de la Iglesia el día viernes ${inicioDia}, a las ${formData.horaSalida1 || "____"}hs${formData.horaSalida2 ? ` y ${formData.horaSalida2}hs` : ''}. y estaremos`, margin, currentY);
    currentY += 4;
    doc.text(`regresando el día Domingo ${finDia}, a las ${formData.horaRegreso || "____"}hs., aproximadamente.`, margin, currentY);
    currentY += 4;
    doc.text(`El costo es de: $${formData.costo || "______"}.-`, margin, currentY);
    currentY += 7;

    // Párrafo de inscripción
    doc.text("Si Uds. están interesados en que su hijo/a concurra a este campamento,", margin, currentY);
    currentY += 4;
    doc.text("les rogamos nos lo hagan saber a la mayor brevedad posible, completando la", margin, currentY);
    currentY += 4;
    doc.text("planilla de inscripción y firmando la autorización que se adjunta a la", margin, currentY);
    currentY += 4;
    doc.text("presente.", margin, currentY);
    currentY += 7;

    doc.text("Sin otro particular, les saludamos muy atentamente.", margin, currentY);
    currentY += 8;

    // Firma del director
    doc.setFont("helvetica", "bold");
    doc.text(formData.liderDirector, pageWidth - margin - 60, currentY);
    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.text("Director/Responsable", pageWidth - margin - 50, currentY);
    currentY += 4;
    doc.text(`Teléfono: ${formData.telefono}`, pageWidth - margin - 60, currentY);
    currentY += 8;

    // Información importante
    doc.setFont("helvetica", "bold");
    doc.text(`IMPORTANTE: último plazo para entregar los datos y autorización`, margin, currentY);
    currentY += 4;
    doc.text(`correspondiente ${formatDate(formData.fechaLimite).toUpperCase()}.`, margin, currentY);
    currentY += 8;

    doc.text(`SALIMOS EL: ${formatDate(formData.fechaInicio)} a las ${formData.horaSalida1}hs${formData.horaSalida2 != null ? ` y ${formData.horaSalida2}hs` : ''}.`, margin, currentY);
    currentY += 8;

    // Lista de elementos a llevar (usando la lista del formulario)
    doc.text("CADA CAMPAMENTISTA DEBERÁ LLEVAR:", margin, currentY);
    currentY += 5;

    // Convertir el texto del formulario en un array de líneas
    const elementos = formData.elementos.trim() ?
      formData.elementos.split('\n').filter(linea => linea.trim()) :
      elementosDefault.split('\n').filter(linea => linea.trim());

    doc.setFont("helvetica", "normal");
    elementos.forEach(elemento => {
      if (currentY > pageHeight - 30) {
        doc.addPage();
        currentY = margin;
      }
      doc.text(elemento, margin + 5, currentY);
      currentY += 5;
    });

    currentY += 5;

    // Prohibiciones y sugerencias
    doc.setFont("helvetica", "bold");
    doc.text("ESTÁ PROHIBIDO:", margin, currentY);
    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.text("llevar elementos de valor, tales como reloj, etc.", margin + 5, currentY);
    currentY += 7;

    doc.setFont("helvetica", "bold");
    doc.text("SUGERIMOS:", margin, currentY);
    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Que todos los elementos deberán estar correctamente identificados", margin + 5, currentY);
    currentY += 5;
    doc.text("con el nombre del adolescente.", margin + 5, currentY);
    currentY += 7;

    doc.setFont("helvetica", "bold");
    doc.text("ROGAMOS:", margin, currentY);
    currentY += 5;
    doc.setFont("helvetica", "normal");
    doc.text("Que se indique si el adolescente necesita medicación (enviar copia de la", margin + 5, currentY);
    currentY += 5;
    doc.text("receta médica escribiendo en el reverso la autorización correspondiente", margin + 5, currentY);
    currentY += 5;
    doc.text("con firma y aclaración, indicando también los horarios en que se los", margin + 5, currentY);
    currentY += 5;
    doc.text("deberá administrar), dieta alimentaría, o si necesita de algún cuidado", margin + 5, currentY);
    currentY += 5;
    doc.text("especial (problemas pulmonares, cardíacos, etc.) o si es alérgico a", margin + 5, currentY);
    currentY += 5;
    doc.text("alguna medicación. De forma que cada maestro pueda ocuparse correcta", margin + 5, currentY);
    currentY += 5;
    doc.text("y personalmente del adolescente.", margin + 5, currentY);
    currentY += 5;
    doc.text("Fotocopia del D.N.I y Carnet Obra Social.", margin + 5, currentY);

    // Nueva página para el formulario
    doc.addPage();
    currentY = margin;

    // Formulario de datos personales
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS PERSONALES PARA INSCRIPCIÓN", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;
    doc.text(`CAMPAMENTO DE ADOLESCENTES – ${mesNombre.toUpperCase()} ${año.toUpperCase()}`, pageWidth / 2, currentY, { align: "center" });
    currentY += 15;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Campos del formulario
    doc.text("NOMBRES (completos): .......................................................................................................", margin, currentY);
    currentY += 8;
    doc.text("APELLIDO: ................................................................................................................................", margin, currentY);
    currentY += 8;
    doc.text("D.N.I. N°: ............................................... NACIONALIDAD: .................................................", margin, currentY);
    currentY += 8;
    doc.text("EDAD: ........años   FECHA DE NACIMIENTO: ....../.../.....  ", margin, currentY);
    currentY += 8;
    doc.text("DIRECCIÓN: Calle ......................................................................................... N° .................... ", margin, currentY);
    currentY += 8;
    doc.text("Barrio .......................................................... Localidad ......................................................... ", margin, currentY);
    currentY += 8;
    doc.text("Código Postal ………………..", margin, currentY);
    currentY += 15;

    // Sección de autorización
    doc.setFont("helvetica", "bold");
    doc.text("AUTORIZACIÓN", pageWidth / 2, currentY, { align: "center" });
    currentY += 15;

    doc.setFont("helvetica", "normal");
    doc.text("Autorizo a mi hijo/a ..................................................................................................... a", margin, currentY);
    currentY += 8;
    doc.text(`concurrir los días ${inicioFormatted.split('/')[0]} al ${finFormatted.split('/')[0]} de ${mesNombre} del ${año} al Campamento para Adolescentes que`, margin, currentY);
    currentY += 8;
    doc.text(`organiza la "${authPdfHeader[0]?.text || 'ASOCIACIÓN DE BENEFICIENCIA Y EDUCACIÓN RHEMA'}", en el predio con`, margin, currentY);
    currentY += 8;
    doc.text(`domicilio en ${formData.lugar}.`, margin, currentY);
    currentY += 12;

    doc.text("Autorizo expresamente a la iglesia Comunidad Cristiana a la toma, difusión", margin, currentY);
    currentY += 8;
    doc.text("y publicación para uso institucional de las imágenes y videos de mi hijo/a", margin, currentY);
    currentY += 8;
    doc.text("en el campamento. SI / NO.", margin, currentY);
    currentY += 8;
    doc.text("Nota: (Tache lo que no corresponda).", margin, currentY);
    currentY += 15;

    doc.text("FIRMA DEL PADRE ó TUTOR: …………................................................................................", margin, currentY);
    currentY += 12;
    doc.text("ACLARACIÓN: .........................................................................................................................", margin, currentY);
    currentY += 12;
    doc.text("TEL. DE CONTACTO:...............................................................................................................", margin, currentY);

    doc.save("autorizacion_campamento_adolescentes.pdf");
  };

  const handleSubmit = (e) => {
    if (e) e.preventDefault();

    // Validación de campos básicos
    const newErrors: Record<string, string> = {};
    if (!formData.lugar) newErrors.lugar = "El lugar es requerido";
    if (!formData.fechaInicio) newErrors.fechaInicio = "La fecha de inicio es requerida";
    if (!formData.fechaFin) newErrors.fechaFin = "La fecha de fin es requerida";
    if (!formData.fechaLimite) newErrors.fechaLimite = "La fecha límite es requerida";
    if (!formData.costo) newErrors.costo = "El costo es requerido";
    if (!formData.liderDirector) newErrors.liderDirector = "El nombre del responsable es requerido";
    if (!formData.telefono) newErrors.telefono = "El teléfono es requerido";
    if (!formData.horaSalida1) newErrors.horaSalida1 = "La hora de salida es requerida";
    if (!formData.horaRegreso) newErrors.horaRegreso = "La hora de regreso es requerida";

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.keys(newErrors)[0];
      const element = document.getElementById(firstError);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    setLoading(true);

    // Simular tiempo de procesamiento
    setTimeout(() => {
      generatePDF();
      setLoading(false);
    }, 1000);
  };

  const companyData = company as any;
  const authPdfHeader = (companyData?.auth_pdf_header && Array.isArray(companyData.auth_pdf_header))
    ? companyData.auth_pdf_header
    : [
      { text: "Asociación de Beneficencia y Educación RHEMA", enabled: true },
      { text: "Personería Jurídica N° 23.212 (Leg. 111.169 – D.P.P.J.)", enabled: true },
      { text: "Libertad 3248, El Talar, Pdo. de Tigre, Pcia. Bs. As.", enabled: true },
      { text: "C.U.I.T. N° 30-70792033-1", enabled: true }
    ];

  const inicioFormatted = formatDate(formData.fechaInicio);
  const finFormatted = formatDate(formData.fechaFin);
  const mesNombre = finFormatted && finFormatted.split('/')[1] ? getMonthName(finFormatted.split('/')[1]) : "______";
  const año = finFormatted && finFormatted.split('/')[2] ? finFormatted.split('/')[2] : "______";
  const inicioDia = inicioFormatted ? inicioFormatted.split('/')[0] : "____";
  const finDia = finFormatted ? finFormatted.split('/')[0] : "____";

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-purple-50/30 via-white to-white">
      <div className="p-4 md:p-6 pb-28 max-w-[1600px] mx-auto">

        {/* Header */}
        <div className="mb-6 animate-fade-in">
          <h1 className="text-3xl font-black text-slate-800 dark:text-slate-100 tracking-tight">Autorización de Campamento</h1>
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
                Datos del Campamento
              </h2>
              <div onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label htmlFor="fechaInicio" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de inicio <span className="text-red-500">*</span></Label>
                    <MuiDatePickerField
                      value={formData.fechaInicio ? parseISO(formData.fechaInicio) : undefined}
                      onChange={(date) =>
                        handleDateChange('fechaInicio', date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      open={fechaInicioOpen}
                      onOpenChange={setFechaInicioOpen}
                      placeholder="Seleccionar fecha"
                    />
                    {errors.fechaInicio && <p className="text-xs text-red-500">{errors.fechaInicio}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fechaFin" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha de fin <span className="text-red-500">*</span></Label>
                    <MuiDatePickerField
                      value={formData.fechaFin ? parseISO(formData.fechaFin) : undefined}
                      onChange={(date) =>
                        handleDateChange('fechaFin', date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      open={fechaFinOpen}
                      onOpenChange={setFechaFinOpen}
                      placeholder="Seleccionar fecha"
                    />
                    {errors.fechaFin && <p className="text-xs text-red-500">{errors.fechaFin}</p>}
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="lugar" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lugar del campamento <span className="text-red-500">*</span></Label>
                    <div className="relative">
                      <Input
                        id="lugar"
                        name="lugar"
                        value={formData.lugar}
                        onChange={handleInputChange}
                        className="pl-10 rounded-xl bg-slate-50 border-slate-200"
                        placeholder="Dirección completa del campamento"
                      />
                      <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" size={16} />
                    </div>
                    {errors.lugar && <p className="text-xs text-red-500">{errors.lugar}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="costo" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Costo ($) <span className="text-red-500">*</span></Label>
                    <Input
                      id="costo"
                      name="costo"
                      type="text"
                      value={formData.costo}
                      onChange={handleInputChange}
                      placeholder="Ej: 15.000"
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.costo && <p className="text-xs text-red-500">{errors.costo}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="fechaLimite" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Fecha límite de inscripción <span className="text-red-500">*</span></Label>
                    <MuiDatePickerField
                      value={formData.fechaLimite ? parseISO(formData.fechaLimite) : undefined}
                      onChange={(date) =>
                        handleDateChange('fechaLimite', date ? format(date, 'yyyy-MM-dd') : '')
                      }
                      open={fechaLimiteOpen}
                      onOpenChange={setFechaLimiteOpen}
                      placeholder="Seleccionar límite"
                    />
                    {errors.fechaLimite && <p className="text-xs text-red-500">{errors.fechaLimite}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaSalida1" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Primera hora de salida <span className="text-red-500">*</span></Label>
                    <Input
                      id="horaSalida1"
                      name="horaSalida1"
                      type="time"
                      value={formData.horaSalida1}
                      onChange={handleInputChange}
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.horaSalida1 && <p className="text-xs text-red-500">{errors.horaSalida1}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaSalida2" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Segunda hora de salida</Label>
                    <Input
                      id="horaSalida2"
                      name="horaSalida2"
                      type="time"
                      value={formData.horaSalida2}
                      onChange={handleInputChange}
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="horaRegreso" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Hora de regreso <span className="text-red-500">*</span></Label>
                    <Input
                      id="horaRegreso"
                      name="horaRegreso"
                      type="time"
                      value={formData.horaRegreso}
                      onChange={handleInputChange}
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.horaRegreso && <p className="text-xs text-red-500">{errors.horaRegreso}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="liderDirector" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Director/Responsable <span className="text-red-500">*</span></Label>
                    <Input
                      id="liderDirector"
                      name="liderDirector"
                      value={formData.liderDirector}
                      onChange={handleInputChange}
                      placeholder="Nombre del director/responsable"
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.liderDirector && <p className="text-xs text-red-500">{errors.liderDirector}</p>}
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="telefono" className="text-xs font-bold text-slate-500 uppercase tracking-wider">Teléfono de contacto <span className="text-red-500">*</span></Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      type="tel"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="Número de teléfono"
                      className="rounded-xl bg-slate-50 border-slate-200"
                    />
                    {errors.telefono && <p className="text-xs text-red-500">{errors.telefono}</p>}
                  </div>
                </div>

                {/* Lista de elementos */}
                <div className="space-y-1">
                  <Label htmlFor="elementos" className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <List className="h-4 w-4 text-primary" />
                    Lista de elementos a llevar
                  </Label>
                  <Textarea
                    id="elementos"
                    name="elementos"
                    value={formData.elementos}
                    onChange={handleInputChange}
                    placeholder="Escriba cada elemento en una línea separada..."
                    rows={10}
                    className="resize-vertical rounded-xl bg-slate-50 border-slate-200"
                  />
                  <p className="text-xs text-slate-400">
                    Escriba cada elemento en una línea separada. Si deja vacío, se usará la lista por defecto.
                  </p>
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
          <div className="w-full xl:w-1/2 sticky top-6 space-y-4">
            <div className="glass-card overflow-hidden">
              <div className="px-6 pt-5 pb-3 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Vista Previa del Documento
                </h3>
              </div>
              <div className="p-4 bg-slate-50/50 flex justify-center py-8 overflow-hidden hidden md:flex">
                {/* Vista previa A4 aproximada */}
                <div className="w-[100%] max-w-[650px] bg-white p-8 sm:p-12 shadow-md font-sans text-black relative scale-[0.70] sm:scale-[0.80] md:scale-90 xl:scale-100 origin-top rounded-lg border border-slate-100">

                  {/* Encabezado */}
                  {authPdfHeader.filter((l: any) => l.enabled).map((line: any, idx: number) => (
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
                      Tenemos el agrado de dirigirnos a Uds., a fin de comunicarles que estamos organizando el campamento para adolescentes que cada año hacemos. En esta oportunidad el campamento se realizará en el domicilio <strong>{formData.lugar || "_________________"}</strong>.
                    </p>
                    <p className="text-justify leading-relaxed">
                      El campamento se realizará los días <strong>{inicioDia} al {finDia} de {mesNombre} del {año}</strong>. Vamos a salir de la Iglesia el día viernes {inicioDia}, a las {formData.horaSalida1 || "____"}hs{formData.horaSalida2 ? ` y ${formData.horaSalida2}hs` : ''}. y estaremos regresando el día Domingo {finDia}, a las {formData.horaRegreso || "____"}hs., aproximadamente.
                    </p>
                    <p className="text-justify leading-relaxed">
                      El costo es de: <strong>${formData.costo || "______"}.-</strong>
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
                <li>• El PDF incluye la carta para padres completa.</li>
                <li>• Contiene el formulario de inscripción y autorización.</li>
                <li>• La lista de elementos es editable y personalizable.</li>
                <li>• Si dejas el campo vacío, se usará la lista predeterminada.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutorizacionCampamento;