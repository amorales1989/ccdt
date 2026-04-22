import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPersistentCompanyId } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';

interface AttendanceReportData {
    studentName: string;
    departmentName: string;
    className: string;
    presenceCount: number;
    percentage: number;
}

export const exportAttendanceReport = async (
    data: AttendanceReportData[],
    totalActivityDays: number,
    companyName: string = "CCDT"
) => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    let currentY = margin;

    const addFooter = (pageNum: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(150);
        const dateStr = format(new Date(), "PPpp", { locale: es });
        doc.text(`Reporte generado el ${dateStr}`, margin, pageHeight - 10);
        doc.text(`Página ${pageNum}`, pageWidth - margin - 15, pageHeight - 10);
    };

    // --- HEADER ---
    // Blue banner
    doc.setFillColor(0, 35, 102);
    doc.rect(0, 0, pageWidth, 40, "F");

    doc.setTextColor(255);
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    const currentYear = new Date().getFullYear();
    doc.text(`REPORTE DE ASISTENCIA ANUAL - ${currentYear}`, margin, 20);
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Institución: ${companyName}`, margin, 30);

    currentY = 55;
    doc.setTextColor(0);

    // Resumen Header
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 35, 102); // Naval Blue
    doc.text("Resumen de Actividad", margin, currentY);
    doc.setDrawColor(0, 35, 102);
    doc.line(margin, currentY + 2, pageWidth - margin, currentY + 2);
    currentY += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(50);
    doc.text(`Total de días con actividad (clases/eventos) en el año ${currentYear}: `, margin, currentY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 35, 102);
    doc.text(`${totalActivityDays} días`, margin + 115, currentY);
    currentY += 15;

    // Table
    autoTable(doc, {
        startY: currentY,
        head: [['Miembro', 'Departamento/Clase', 'Asistencias', 'Porcentaje']],
        body: data.map(item => [
            item.studentName,
            `${item.departmentName}${item.className ? ` - ${item.className}` : ''}`,
            item.presenceCount.toString(),
            `${item.percentage.toFixed(1)}%`
        ]),
        headStyles: {
            fillColor: [0, 35, 102],
            textColor: 255,
            fontStyle: 'bold',
        },
        styles: {
            font: 'helvetica',
            fontSize: 10,
            cellPadding: 4,
        },
        alternateRowStyles: {
            fillColor: [245, 247, 250],
        },
        didDrawPage: (dataInfo) => {
            // Add footer to every page
            addFooter(doc.internal.pages.length - 1); // pages array contains an empty dummy first element
        },
    });

    doc.save(`Reporte_Asistencia_${format(new Date(), "yyyyMMdd")}.pdf`);
};
