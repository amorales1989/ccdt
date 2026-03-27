
import jsPDF from "jspdf";

export const generateBlankFichaSalud = (company: any) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12; // Reduced from 15
    let currentY = margin;

    const drawSectionHeader = (text: string, y: number) => {
        doc.setFillColor(235, 235, 235); // Lighter gray
        doc.rect(margin, y, pageWidth - margin * 2, 5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(text, margin + 2, y + 3.75);
        return y + 5;
    };

    const checkPageOverflow = (needed: number) => {
        if (currentY + needed > pageHeight - margin) {
            doc.addPage();
            currentY = margin;
            return true;
        }
        return false;
    };

    // 1. Institutional Header
    const authPdfHeader = (company?.auth_pdf_header && Array.isArray(company.auth_pdf_header))
        ? company.auth_pdf_header
        : [{ text: company?.name || "Institución", enabled: true }];

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11); // Slightly smaller
    let headerY = margin;
    authPdfHeader.forEach((line: any) => {
        if (line.enabled) {
            doc.text(line.text, margin, headerY);
            headerY += 4.5;
        }
    });
    currentY = Math.max(headerY + 3, 22);

    // A - CONDICION DE SALUD
    currentY = drawSectionHeader("A - CONDICION DE SALUD", currentY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);

    const rowH = 6.5; // Reduced from 7
    doc.setDrawColor(0);
    // Row 1
    doc.rect(margin, currentY, pageWidth - margin * 2, rowH);
    doc.text("Apellido y Nombre: ___________________________________________________________", margin + 2, currentY + 4.5);
    currentY += rowH;
    // Row 2
    doc.rect(margin, currentY, 60, rowH);
    doc.text("DNI: _____________", margin + 2, currentY + 4.5);
    doc.rect(margin + 60, currentY, 60, rowH);
    doc.text("Fecha Nac.:    /    /", margin + 62, currentY + 4.5);
    doc.rect(margin + 120, currentY, pageWidth - margin * 2 - 120, rowH);
    doc.text("Edad: _______", margin + 122, currentY + 4.5);
    currentY += rowH;
    // Row 3
    doc.rect(margin, currentY, 40, rowH);
    doc.text("Peso: ______ Kg.", margin + 2, currentY + 4.5);
    doc.rect(margin + 40, currentY, 40, rowH);
    doc.text("Talla: _______", margin + 42, currentY + 4.5);
    doc.rect(margin + 80, currentY, pageWidth - margin * 2 - 80, rowH);
    doc.text("Teléfonos: ________________________________", margin + 82, currentY + 4.5);
    currentY += rowH;
    // Row 4
    doc.rect(margin, currentY, pageWidth - margin * 2, rowH);
    doc.text("Mail: ____________________________________________________________________", margin + 2, currentY + 4.5);
    currentY += rowH + 4;

    // B.1 - DATOS A COMPLETAR
    currentY = drawSectionHeader("B.1 - DATOS A COMPLETAR", currentY);
    doc.setFontSize(8);
    doc.text("Marcar con una cruz las respuestas positivas", margin + 2, currentY + 3.5);
    currentY += 5;

    const items = [
        ["Asma", "Epilepsia", "Cardiopatía"],
        ["Presión arterial", "Diabetes", "Usa anteojos"],
        ["Escoliosis", "Celiaquismo", "Sangrado nasal"]
    ];

    items.forEach(row => {
        let x = margin + 5;
        row.forEach(item => {
            doc.rect(x, currentY, 35, 5);
            doc.text(item, x + 2, currentY + 3.75);
            doc.rect(x + 35, currentY, 8, 5); // Checkbox
            x += 55;
        });
        currentY += 6.5;
    });
    currentY += 2;

    // B.2 - ANTECEDENTES
    currentY = drawSectionHeader("B.2 - ANTECEDENTES", currentY);
    doc.setFontSize(8);
    doc.text("¿Tiene alguna enfermedad que requiera periódicamente tratamiento o control médico?", margin + 2, currentY + 3.5);
    currentY += 5;
    doc.rect(margin, currentY, 15, 5);
    doc.text("NO", margin + 5, currentY + 3.75);
    doc.rect(margin + 15, currentY, 15, 5);
    doc.text("SI", margin + 21, currentY + 3.75);
    doc.rect(margin + 30, currentY, pageWidth - margin * 2 - 30, 5);
    doc.text("¿cuál?: _________________________________________", margin + 32, currentY + 3.75);
    currentY += 8;

    doc.text("¿Durante los últimos tres años fue internado alguna vez?", margin + 2, currentY + 3.5);
    currentY += 5;
    doc.rect(margin, currentY, 15, 5);
    doc.text("NO", margin + 5, currentY + 3.75);
    doc.rect(margin + 15, currentY, 15, 5);
    doc.text("SI", margin + 21, currentY + 3.75);
    doc.rect(margin + 30, currentY, pageWidth - margin * 2 - 30, 5);
    doc.text("¿Por qué?: _______________________________________", margin + 32, currentY + 3.75);
    currentY += 8;

    // B.3 - ¿TIENE ALGÚN TIPO DE ALERGIA?
    currentY = drawSectionHeader("B.3 - ¿TIENE ALGÚN TIPO DE ALERGIA?", currentY);
    doc.text("En caso afirmativo, describa manifestaciones:", margin + 2, currentY + 3.5);
    currentY += 5;
    doc.rect(margin, currentY, pageWidth - margin * 2, 5);
    currentY += 6.5;
    doc.rect(margin, currentY, 130, 5);
    doc.text("La alergia se debe a: ________________________________", margin + 2, currentY + 3.75);
    doc.rect(margin + 130, currentY, pageWidth - margin * 2 - 130, 5);
    doc.text("No sabe", margin + 132, currentY + 3.75);
    currentY += 6.5;
    doc.rect(margin, currentY, 35, 5);
    doc.text("¿Recibe tratamiento?", margin + 2, currentY + 3.75);
    doc.rect(margin + 35, currentY, 15, 5);
    doc.text("NO", margin + 40, currentY + 3.75);
    doc.rect(margin + 50, currentY, 15, 5);
    doc.text("SI", margin + 56, currentY + 3.75);
    doc.rect(margin + 65, currentY, pageWidth - margin * 2 - 65, 5);
    doc.text("¿Cuál?: _________________________________________", margin + 67, currentY + 3.75);
    currentY += 8;

    // C - TRATAMIENTOS
    currentY = drawSectionHeader("C - TRATAMIENTOS", currentY);
    const treatments = [
        "¿Recibe tratamiento médico?",
        "¿Quirúrgicos?",
        "¿Presenta alguna limitación física?"
    ];
    treatments.forEach(t => {
        doc.text(t, margin + 2, currentY + 4);
        doc.rect(margin + 55, currentY, 15, 5);
        doc.text("NO", margin + 60, currentY + 3.75);
        doc.rect(margin + 70, currentY, 15, 5);
        doc.text("SI", margin + 76, currentY + 3.75);
        if (t === "¿Recibe tratamiento médico?") {
            doc.text("Medic.: ___________________", margin + 95, currentY + 4);
        }
        currentY += 5.5;
    });
    doc.rect(margin, currentY, pageWidth - margin * 2, 8);
    doc.text("Si contestó positivamente alguna de las 3 opciones, detalle:", margin + 2, currentY + 5);
    currentY += 12;

    // D - SI EL NIÑO TIENE ALGUN PROBLEMA DE SALUD
    currentY = drawSectionHeader("D - SI EL NIÑO TIENE ALGUN PROBLEMA DE SALUD", currentY);
    currentY += 2;
    doc.setFont("helvetica", "bold");
    doc.text("Derivación al centro asistencial más cercano en caso de accidente.", margin + 2, currentY + 3.5);
    currentY += 5;

    // Obra Social Info
    doc.rect(margin, currentY, pageWidth - margin * 2, 8);
    doc.setFont("helvetica", "bold");
    doc.text("¿Posee Obra Social / Prepaga?", margin + 3, currentY + 5.5);
    doc.rect(margin + 55, currentY + 1.5, 12, 5);
    doc.setFont("helvetica", "normal");
    doc.text("NO", margin + 57.5, currentY + 5.25);
    doc.rect(margin + 67, currentY + 1.5, 12, 5);
    doc.text("SI", margin + 71, currentY + 5.25);
    doc.text("¿Cuál?: ____________________________", margin + 85, currentY + 5.5);
    currentY += 9;
    doc.setFontSize(7.5);
    doc.setFont("helvetica", "bold");
    doc.text("* ADJUNTAR FOTOCOPIA DEL CARNET DE LA OBRA SOCIAL / PREPAGA.", margin + 3, currentY + 3);
    currentY += 8;

    // Family Info
    doc.setFontSize(9);
    doc.rect(margin, currentY, 35, 11);
    doc.text("Avisar al Familiar:", margin + 2, currentY + 6.5);
    doc.rect(margin + 35, currentY, pageWidth - margin * 2 - 35, 5.5);
    doc.setFont("helvetica", "normal");
    doc.text("Nombre y Apellido: _________________________________________", margin + 37, currentY + 4);
    doc.rect(margin + 35, currentY + 5.5, 80, 5.5);
    doc.text("Dirección: ____________________", margin + 37, currentY + 9.5);
    doc.rect(margin + 115, currentY + 5.5, pageWidth - margin * 2 - 115, 5.5);
    doc.text("Teléfono: _______________", margin + 117, currentY + 9.5);
    currentY += 15;

    // Footer
    checkPageOverflow(40);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.text("Firma, aclaración y DNI de los responsables:", margin, currentY);
    currentY += 12;

    doc.line(margin, currentY, margin + 75, currentY);
    doc.line(pageWidth - margin - 75, currentY, pageWidth - margin, currentY);
    currentY += 4;
    doc.setFontSize(7.5);
    doc.text("Firma Madre/Padre/Tutor", margin + 22, currentY);
    doc.text("Aclaración y DNI", pageWidth - margin - 50, currentY);

    currentY += 12;
    doc.setFontSize(9);
    doc.text("Fecha: ____ / ____ / ________", margin, currentY);
    currentY += 8;
    doc.text("Los datos consignados en las presente planilla son ciertos y somos responsables de los mismos.", margin, currentY);

    doc.save("ficha_salud.pdf");
};
