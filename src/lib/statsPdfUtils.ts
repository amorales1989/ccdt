
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReportData {
    totalStudents: number;
    attendanceRate: string;
    totalVolunteers: number;
    newStudents: number;
    genderData: { name: string; value: number }[];
    ageData: { name: string; value: number }[];
    last12Months: { name: string; total: number }[];
    roleData: { name: string; value: number }[];
}

export const exportStatsReport = async (data: ReportData, chartIds: string[], companyName: string = "CCDT") => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    const addHeader = (title: string, y: number) => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(0, 35, 102); // Naval Blue
        doc.text(title, margin, y);
        doc.setDrawColor(0, 35, 102);
        doc.line(margin, y + 2, pageWidth - margin, y + 2);
        return y + 12;
    };

    const addFooter = (pageNum: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        const dateStr = format(new Date(), "PPpp", { locale: es });
        doc.text(`Reporte generado el ${dateStr}`, margin, pageHeight - 10);
        doc.text(`Página ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
    };

    // --- PAGE 1: COVER & SUMMARY ---
    // Blue banner
    doc.setFillColor(0, 35, 102);
    doc.rect(0, 0, pageWidth, 60, "F");

    doc.setTextColor(255);
    doc.setFontSize(26);
    doc.setFont("helvetica", "bold");
    doc.text("INFORME EJECUTIVO", margin, 35);
    doc.setFontSize(14);
    doc.setFont("helvetica", "normal");
    doc.text(`Institución: ${companyName}`, margin, 45);

    currentY = 80;
    doc.setTextColor(0);
    currentY = addHeader("Resumen General de Operaciones", currentY);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const summaryText = `Este informe presenta un análisis detallado de la membresía, participación y estructura organizacional basado en los datos consolidados a la fecha de ${format(new Date(), "PPPP", { locale: es })}. Se analizan tendencias de crecimiento, perfiles demográficos e indicadores de compromiso ministerial.`;
    const splitSummary = doc.splitTextToSize(summaryText, pageWidth - margin * 2);
    doc.text(splitSummary, margin, currentY);
    currentY += splitSummary.length * 5 + 15;

    // KPI Grid
    const kpis = [
        { label: "Membresía Activa", value: data.totalStudents.toString() },
        { label: "Tasa Participación", value: `${data.attendanceRate}%` },
        { label: "Cuerpo Docente", value: data.totalVolunteers.toString() },
        { label: "Nuevos (Mes)", value: data.newStudents.toString() }
    ];

    const kpiBoxW = 75;
    const kpiBoxH = 22;
    const kpiGap = 10;

    kpis.forEach((kpi, i) => {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const x = margin + col * (kpiBoxW + kpiGap);
        const y = currentY + row * (kpiBoxH + kpiGap);

        doc.setDrawColor(230, 230, 230);
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, y, kpiBoxW, kpiBoxH, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text(kpi.label.toUpperCase(), x + 5, y + 8);

        doc.setFontSize(14);
        doc.setTextColor(0, 35, 102);
        doc.text(kpi.value, x + 5, y + 16);
    });

    currentY += 60;
    currentY = addHeader("Análisis de Crecimiento", currentY);
    doc.setFontSize(9);
    doc.setTextColor(80);
    doc.text("Visualización de la evolución acumulada de miembros registrados (últimos 12 meses):", margin, currentY);
    currentY += 8;

    // Capture Growth Chart
    const growthChart = document.getElementById(chartIds[0]);
    if (growthChart) {
        try {
            const canvas = await html2canvas(growthChart, {
                scale: 2,
                backgroundColor: "#ffffff",
                logging: false
            });
            const imgData = canvas.toDataURL("image/png");
            doc.addImage(imgData, "PNG", margin, currentY, pageWidth - margin * 2, 80);
            currentY += 85;
        } catch (e) {
            console.error("Error capturing growth chart:", e);
            doc.text("[Error al capturar gráfico de crecimiento]", margin, currentY);
            currentY += 10;
        }
    }

    addFooter(1);

    // --- PAGE 2: DEMOGRAPHICS ---
    doc.addPage();
    currentY = margin;
    currentY = addHeader("Segmentación y Demografía", currentY);

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.text("1. Estructura Generacional:", margin, currentY);
    currentY += 5;

    const ageChart = document.getElementById(chartIds[1]);
    if (ageChart) {
        try {
            const canvas = await html2canvas(ageChart, { scale: 2, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL("image/png");
            doc.addImage(imgData, "PNG", margin, currentY, 110, 70);

            doc.setFontSize(8);
            doc.setFont("helvetica", "italic");
            const ageAnalysis = "La distribución etaria muestra una base sólida de jóvenes y adolescentes, representando el motor principal de las actividades ministeriales actuales.";
            const splitAge = doc.splitTextToSize(ageAnalysis, 50);
            doc.text(splitAge, 140, currentY + 15);

        } catch (e) {
            console.error("Error capturing age chart:", e);
        }
        currentY += 85;
    }

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("2. Balance por Género:", margin, currentY);
    currentY += 5;
    const genderChart = document.getElementById(chartIds[2]);
    if (genderChart) {
        try {
            const canvas = await html2canvas(genderChart, { scale: 2, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL("image/png");
            doc.addImage(imgData, "PNG", margin + 30, currentY, 110, 70);
        } catch (e) {
            console.error("Error capturing gender chart:", e);
        }
        currentY += 85;
    }

    addFooter(2);

    // --- PAGE 3: ROLES & PROJECTIONS ---
    doc.addPage();
    currentY = margin;
    currentY = addHeader("Recursos Humanos y Proyecciones", currentY);

    doc.setFontSize(10);
    doc.text("Distribución de Roles Ministeriales:", margin, currentY);
    currentY += 5;
    const roleChart = document.getElementById(chartIds[3]);
    if (roleChart) {
        try {
            const canvas = await html2canvas(roleChart, { scale: 2, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL("image/png");
            doc.addImage(imgData, "PNG", margin, currentY, pageWidth - margin * 2, 70);
        } catch (e) {
            console.error("Error capturing role chart:", e);
        }
        currentY += 80;
    }

    // Projection Logic
    const growthData = data.last12Months;
    const startVal = growthData[0].total;
    const endVal = growthData[growthData.length - 1].total;
    const slope = (endVal - startVal) / (growthData.length - 1);
    const next6m = Math.round(endVal + slope * 6);

    currentY = addHeader("Pronóstico de Crecimiento", currentY);

    doc.setFillColor(240, 252, 244); // Light green bg
    doc.roundedRect(margin, currentY, pageWidth - margin * 2, 45, 3, 3, "F");

    doc.setFontSize(18);
    doc.setTextColor(21, 128, 61); // Green 700
    doc.text(`Proyección a 6 Meses: ~${next6m} Miembros`, margin + 10, currentY + 15);

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    const projectionTxt = `Basado en el historial de los últimos 12 meses, la institución presenta una tendencia de crecimiento de ${slope.toFixed(1)} nuevos integrantes por mes. De mantenerse esta dinámica, se estima alcanzar la cifra proyectada para el próximo semestre.`;
    const splitProj = doc.splitTextToSize(projectionTxt, pageWidth - margin * 2 - 20);
    doc.text(splitProj, margin + 10, currentY + 25);

    currentY += 60;
    currentY = addHeader("Conclusiones Finales", currentY);
    doc.setFontSize(10);
    doc.setTextColor(0);
    const finalConclusion = `La congregación mantiene un ecosistema estable con un compromiso de asistencia sostenido. La alta participación del segmento adolescente sugiere que los programas de formación y liderazgo deben priorizar este grupo para garantizar el relevo generacional y el fortalecimiento de la estructura administrativa.`;
    const splitFinal = doc.splitTextToSize(finalConclusion, pageWidth - margin * 2);
    doc.text(splitFinal, margin, currentY);

    addFooter(3);

    doc.save(`Reporte_CCDT_${format(new Date(), "yyyyMMdd")}.pdf`);
};
