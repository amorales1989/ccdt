import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Calendar, MapPin, Users, FileText } from "lucide-react";
import { jsPDF } from "jspdf";


const AutorizacionCampamento = () => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fechaInicio: "2025-03-14",
    fechaFin: "2025-03-16",
    lugar: "Sta. Ana 455, Toruguitas, Pcia. de Buenos Aires",
    costo: "10000",
    fechaLimite: "2025-03-08",
    horaSalida1: "17:00",
    horaSalida2: null,
    horaRegreso: "18:00",
    liderDirector: "ALEJANDRO MORALES",
    telefono: "",
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
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
    currentY += 10;

    // Fecha
    

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
    const mesNombre = getMonthName(finFormatted.split('/')[1]);
    const año = finFormatted.split('/')[2];
console.log(formData.horaSalida2)
    doc.text(`El campamento se realizará los días ${inicioFormatted.split('/')[0]} al ${finFormatted.split('/')[0]} de ${mesNombre} del ${año}. Vamos`, margin, currentY);
    currentY += 4;
    doc.text(`a salir de la Iglesia el día viernes ${inicioFormatted.split('/')[0]}, a las ${formData.horaSalida1}hs${formData.horaSalida2 != null ? ` y ${formData.horaSalida2}hs` : ''}. y estaremos`, margin, currentY);
    currentY += 4;
    doc.text(`regresando el día Domingo ${finFormatted.split('/')[0]}, a las ${formData.horaRegreso}hs., aproximadamente.`, margin, currentY);
    currentY += 4;
    doc.text(`El costo es de: $${formData.costo}.-`, margin, currentY);
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
    doc.text("Líder Director", pageWidth - margin - 50, currentY);
    currentY += 4;
    doc.text(`Teléfono: ${formData.telefono}`, pageWidth - margin - 60, currentY);
    currentY += 8;

    // Información importante
    doc.setFont("helvetica", "bold");
    doc.text(`IMPORTANTE: último plazo para entregar los datos y autorización`, margin, currentY);
    currentY += 4;
    doc.text(`correspondiente ${formatDate(formData.fechaLimite).toUpperCase()}.`, margin, currentY);
    currentY += 5;

    doc.text(`SALIMOS EL: viernes ${formatDate(formData.fechaInicio)} a las ${formData.horaSalida1}hs${formData.horaSalida2 != null ? ` y ${formData.horaSalida2}hs` : ''}.`, margin, currentY);
    currentY += 5;

    // Lista de elementos a llevar
    doc.text("CADA CAMPAMENTISTA DEBERÁ LLEVAR:", margin, currentY);
    currentY += 8;

    const elementos = [
      "• Sábanas, frazadas",
      "• Ropa liviana",
      "• Un pullover o campera",
      "• Short / malla de baño (en el caso de las chicas solo se permite llevar",
      "  malla enteriza o short y remera) sin excepción",
      "• Ojotas y zapatillas",
      "• Gorro para el sol",
      "• Toalla y elementos de higiene (cepillo de dientes, dentífrico, jabón, peine, etc.).",
      "• Biblia"
    ];

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
    currentY += 5;

    doc.setFont("helvetica", "bold");
    doc.text("SUGERIMOS:", margin, currentY);
    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.text("Que todos los elementos deberán estar correctamente identificados", margin + 5, currentY);
    currentY += 4;
    doc.text("con el nombre del adolescente.", margin + 5, currentY);
    currentY += 5;

    doc.setFont("helvetica", "bold");
    doc.text("ROGAMOS:", margin, currentY);
    currentY += 4;
    doc.setFont("helvetica", "normal");
    doc.text("Que se indique si el adolescente necesita medicación (enviar copia de la", margin + 5, currentY);
    currentY += 4;
    doc.text("receta médica escribiendo en el reverso la autorización correspondiente", margin + 5, currentY);
    currentY += 4;
    doc.text("con firma y aclaración, indicando también los horarios en que se los", margin + 5, currentY);
    currentY += 4;
    doc.text("deberá administrar), dieta alimentaría, o si necesita de algún cuidado", margin + 5, currentY);
    currentY += 4;
    doc.text("especial (problemas pulmonares, cardíacos, etc.) o si es alérgico a", margin + 5, currentY);
    currentY += 4;
    doc.text("alguna medicación. De forma que cada maestro pueda ocuparse correcta", margin + 5, currentY);
    currentY += 4;
    doc.text("y personalmente del adolescente.", margin + 5, currentY);
    currentY += 4;
    doc.text("Fotocopia del D.N.I y Carnet Obra Social.", margin + 5, currentY);

    // Nueva página para el formulario
    doc.addPage();
    currentY = margin;

    // Formulario de datos personales
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("DATOS PERSONALES PARA INSCRIPCIÓN", pageWidth / 2, currentY, { align: "center" });
    currentY += 8;
    doc.text("CAMPAMENTO DE ADOLESCENTES – MARZO 2025", pageWidth / 2, currentY, { align: "center" });
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
    doc.text("EDAD: ........años GRADO: ............ FECHA DE NACIMIENTO: ....../…./.....  ", margin, currentY);
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
    doc.text(`concurrir los días ${inicioFormatted.split('/')[0]} al ${finFormatted.split('/')[0]} de marzo del 2025 al Campamento para Adolescentes que`, margin, currentY);
    currentY += 8;
    doc.text("organiza la \"ASOCIACIÓN DE BENEFICIENCIA Y EDUCACIÓN RHEMA\", en el predio con", margin, currentY);
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
    e.preventDefault();
    setLoading(true);
    
    // Simular tiempo de procesamiento
    setTimeout(() => {
      generatePDF();
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-6 text-center">Autorización Campamento de Adolescentes</h1>
      
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <Users className="h-6 w-6 text-blue-600" />
            Datos del Campamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fechaInicio" className="text-sm font-medium">Fecha de inicio</Label>
                <div className="relative">
                  <Input
                    id="fechaInicio"
                    name="fechaInicio"
                    type="date"
                    value={formData.fechaInicio}
                    onChange={handleInputChange}
                    className="pl-10"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaFin" className="text-sm font-medium">Fecha de fin</Label>
                <div className="relative">
                  <Input
                    id="fechaFin"
                    name="fechaFin"
                    type="date"
                    value={formData.fechaFin}
                    onChange={handleInputChange}
                    className="pl-10"
                  />
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="lugar" className="text-sm font-medium">Lugar del campamento</Label>
                <div className="relative">
                  <Input
                    id="lugar"
                    name="lugar"
                    value={formData.lugar}
                    onChange={handleInputChange}
                    className="pl-10"
                    placeholder="Dirección completa del campamento"
                  />
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="costo" className="text-sm font-medium">Costo ($)</Label>
                <Input
                  id="costo"
                  name="costo"
                  type="number"
                  value={formData.costo}
                  onChange={handleInputChange}
                  placeholder="10000"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fechaLimite" className="text-sm font-medium">Fecha límite de inscripción</Label>
                <Input
                  id="fechaLimite"
                  name="fechaLimite"
                  type="date"
                  value={formData.fechaLimite}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaSalida1" className="text-sm font-medium">Primera hora de salida</Label>
                <Input
                  id="horaSalida1"
                  name="horaSalida1"
                  type="time"
                  value={formData.horaSalida1}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaSalida2" className="text-sm font-medium">Segunda hora de salida</Label>
                <Input
                  id="horaSalida2"
                  name="horaSalida2"
                  type="time"
                  value={formData.horaSalida2}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="horaRegreso" className="text-sm font-medium">Hora de regreso</Label>
                <Input
                  id="horaRegreso"
                  name="horaRegreso"
                  type="time"
                  value={formData.horaRegreso}
                  onChange={handleInputChange}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="liderDirector" className="text-sm font-medium">Líder Director</Label>
                <Input
                  id="liderDirector"
                  name="liderDirector"
                  value={formData.liderDirector}
                  onChange={handleInputChange}
                  placeholder="Nombre del líder director"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefono" className="text-sm font-medium">Teléfono de contacto</Label>
                <Input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  value={formData.telefono}
                  onChange={handleInputChange}
                  placeholder="Número de teléfono"
                />
              </div>
            </div>
            
            <div className="flex justify-center pt-4">
              <Button 
                onClick={handleSubmit}
                disabled={loading} 
                className="w-full md:w-auto px-8 py-3 text-lg"
              >
                <FileText className="w-5 h-5 mr-2" />
                {loading ? "Generando PDF..." : "Generar PDF de Autorización"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-blue-800 mb-2">📋 Información importante:</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• El PDF generado incluye la carta informativa completa para los padres</li>
          <li>• Contiene el formulario de inscripción que deben completar</li>
          <li>• Incluye la autorización que debe ser firmada por el padre o tutor</li>
          <li>• Lista todos los elementos que debe llevar cada campamentista</li>
        </ul>
      </div>
    </div>
  );
};

export default AutorizacionCampamento;