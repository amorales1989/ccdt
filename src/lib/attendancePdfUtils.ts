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

interface MatrixStudent {
    id: string;
    first_name: string;
    last_name: string;
    assigned_class?: string | null;
    department?: string | null;
    dept_assignments?: Array<{ departments?: { name?: string } | null; assigned_class?: string | null }> | null;
    profile_assigned_class?: string | null;
}

interface MatrixAttendance {
    student_id: string;
    date: string; // YYYY-MM-DD
    status: boolean;
}

export const exportAttendanceMatrix = async (
    students: MatrixStudent[],
    attendance: MatrixAttendance[],
    title: string = "Asistencia Anual",
    companyName: string = "CCDT",
    contextDepartment?: string | null,
) => {
    const isObreros = (v?: string | null) => (v || '').toLowerCase() === 'obreros';
    const classForStudent = (s: MatrixStudent): string => {
        // 1. Prefer profile.assigned_class (lo que se asigna desde "Guardar Clase")
        if (s.profile_assigned_class && !isObreros(s.profile_assigned_class)) return s.profile_assigned_class;
        // 2. Dept assignment del depto en contexto, distinto de Obreros
        if (contextDepartment && s.dept_assignments?.length) {
            const inDept = s.dept_assignments.filter(a => a.departments?.name === contextDepartment && a.assigned_class);
            const nonObreros = inDept.find(a => !isObreros(a.assigned_class));
            if (nonObreros?.assigned_class) return nonObreros.assigned_class;
        }
        // 3. Student.assigned_class si no es Obreros
        if (s.assigned_class && !isObreros(s.assigned_class)) return s.assigned_class;
        // 4. Fallback: profile.assigned_class (puede ser Obreros) > student.assigned_class
        return s.profile_assigned_class || s.assigned_class || '-';
    };
    // 1. Unique dates with activity, ordered ASC
    const uniqueDates = Array.from(new Set(attendance.map(a => a.date))).sort();

    if (uniqueDates.length === 0) {
        throw new Error("No hay fechas con asistencia registrada.");
    }

    // 2. Build attendance map: { student_id -> { date -> 'P'|'A' } }
    const attMap = new Map<string, Map<string, 'P' | 'A'>>();
    for (const a of attendance) {
        if (!attMap.has(a.student_id)) attMap.set(a.student_id, new Map());
        attMap.get(a.student_id)!.set(a.date, a.status ? 'P' : 'A');
    }

    // 3. Sort students by class then name
    const sortedStudents = [...students].sort((a, b) => {
        const ca = classForStudent(a).localeCompare(classForStudent(b));
        if (ca !== 0) return ca;
        return `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
    });

    // 4. Setup PDF landscape
    const doc = new jsPDF("l", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 8;
    const currentYear = new Date().getFullYear();

    // Header
    doc.setFillColor(0, 35, 102);
    doc.rect(0, 0, pageWidth, 22, "F");
    doc.setTextColor(255);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`${title.toUpperCase()} - ${currentYear}`, margin, 10);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Institución: ${companyName}  •  ${sortedStudents.length} miembros  •  ${uniqueDates.length} fechas con actividad`, margin, 17);
    doc.setTextColor(0);

    // 5. Split dates across pages (panels)
    const fixedColsWidth = 22 + 50 + 10; // CLASE + NOMBRE + ASIST
    const dateColWidth = 8;
    const availableWidth = pageWidth - margin * 2 - fixedColsWidth;
    const datesPerPage = Math.max(1, Math.floor(availableWidth / dateColWidth));

    let startY = 28;

    for (let pageIdx = 0; pageIdx * datesPerPage < uniqueDates.length; pageIdx++) {
        if (pageIdx > 0) {
            doc.addPage();
            startY = margin + 4;
        }

        const chunkDates = uniqueDates.slice(pageIdx * datesPerPage, (pageIdx + 1) * datesPerPage);

        // Build grouped header: month row + day row
        const monthRow: any[] = [
            { content: 'CLASE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
            { content: 'MIEMBRO', rowSpan: 2, styles: { halign: 'left', valign: 'middle' } },
            { content: 'TOT', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } },
        ];
        // Group chunkDates by month
        const monthGroups: { month: string; count: number }[] = [];
        for (const d of chunkDates) {
            const m = format(new Date(d + 'T00:00:00'), 'LLLL', { locale: es }).toUpperCase();
            const last = monthGroups[monthGroups.length - 1];
            if (last && last.month === m) last.count++;
            else monthGroups.push({ month: m, count: 1 });
        }
        for (const g of monthGroups) {
            monthRow.push({ content: g.month, colSpan: g.count, styles: { halign: 'center', fillColor: [0, 35, 102] } });
        }

        const dayRow: any[] = chunkDates.map(d => ({
            content: format(new Date(d + 'T00:00:00'), 'dd'),
            styles: { halign: 'center', fontSize: 7 },
        }));

        const body = sortedStudents.map(s => {
            const studentAtt = attMap.get(s.id);
            const totalP = chunkDates.filter(d => studentAtt?.get(d) === 'P').length;
            const row: any[] = [
                { content: classForStudent(s), styles: { halign: 'center', fontStyle: 'bold' } },
                { content: `${s.first_name} ${s.last_name}`, styles: { fontStyle: 'bold' } },
                { content: totalP.toString(), styles: { halign: 'center', fontSize: 7 } },
            ];
            for (const d of chunkDates) {
                const v = studentAtt?.get(d);
                if (v === 'P') row.push({ content: 'P', styles: { halign: 'center', fontSize: 7, fillColor: [220, 240, 220] } });
                else if (v === 'A') row.push({ content: 'A', styles: { halign: 'center', fontSize: 7, textColor: [200, 0, 0], fillColor: [255, 235, 235] } });
                else row.push({ content: '', styles: { fillColor: [248, 248, 248] } });
            }
            return row;
        });

        const colStyles: any = {
            0: { cellWidth: 22 },
            1: { cellWidth: 50 },
            2: { cellWidth: 10 },
        };
        for (let i = 0; i < chunkDates.length; i++) {
            colStyles[3 + i] = { cellWidth: dateColWidth };
        }

        autoTable(doc, {
            startY,
            head: [monthRow, dayRow],
            body,
            theme: 'grid',
            headStyles: {
                fillColor: [0, 35, 102],
                textColor: 255,
                fontStyle: 'bold',
                fontSize: 8,
            },
            styles: {
                font: 'helvetica',
                fontSize: 8,
                cellPadding: 1,
                lineColor: [200, 200, 200],
                lineWidth: 0.1,
            },
            columnStyles: colStyles,
            margin: { left: margin, right: margin },
            didDrawPage: () => {
                doc.setFontSize(7);
                doc.setTextColor(150);
                doc.text(
                    `Generado el ${format(new Date(), "PPpp", { locale: es })}  •  Página ${doc.internal.pages.length - 1}`,
                    margin,
                    pageHeight - 4,
                );
                doc.setTextColor(0);
            },
        });
    }

    doc.save(`Matriz_Asistencia_${format(new Date(), "yyyyMMdd")}.pdf`);
};
