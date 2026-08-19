import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getPersistentCompanyId } from '@/contexts/CompanyContext';
import { supabase } from '@/integrations/supabase/client';
import { getEventColor } from '@/lib/eventColors';

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
    companyName: string = "Nexus"
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
    teacher_assignments?: Array<{ department?: string | null; assigned_class?: string | null; role?: string | null }> | null;
}

// Día especial (no hubo clase): pinta la columna y entra en la leyenda del pie.
interface MatrixEvent {
    date: string;
    title: string;
    color: string;
    assigned_class?: string | null;
}

// Matriz ya agregada por el SP api.asistencia_matriz: un caracter por fecha (P/A/-)
interface MatrixData {
    dates: string[]; // YYYY-MM-DD ordenadas ASC
    rows: Array<{ student_id: string; marks: string }>;
    events?: MatrixEvent[];
}

export const exportAttendanceMatrix = async (
    students: MatrixStudent[],
    matrix: MatrixData,
    title: string = "Asistencia Anual",
    companyName: string = "Nexus",
    contextDepartment?: string | null,
    showClassColumn: boolean = true,
) => {
    // Valores que no son una "clase real" sino nombres del departamento/grupo
    const deptTokens = (contextDepartment || '')
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean);
    const isInvalidClass = (v?: string | null) => {
        const val = (v || '').toLowerCase().trim();
        if (!val) return true;
        if (val === 'obreros') return true;
        if (contextDepartment && val === contextDepartment.toLowerCase()) return true;
        if (deptTokens.includes(val)) return true; // ej: "central" cuando depto es "Escuelita Central"
        return false;
    };
    const classForStudent = (s: MatrixStudent): string => {
        // 1. Teacher assignment (user_metadata.assignments) en el depto en contexto con clase válida
        if (contextDepartment && s.teacher_assignments?.length) {
            const inDept = s.teacher_assignments.filter(a => a.department === contextDepartment && a.assigned_class);
            const valid = inDept.find(a => !isInvalidClass(a.assigned_class));
            if (valid?.assigned_class) return valid.assigned_class;
        }
        // 2. profile.assigned_class si es válida
        if (s.profile_assigned_class && !isInvalidClass(s.profile_assigned_class)) return s.profile_assigned_class;
        // 3. Dept assignment (student_departments) del depto en contexto con clase válida
        if (contextDepartment && s.dept_assignments?.length) {
            const inDept = s.dept_assignments.filter(a => a.departments?.name === contextDepartment && a.assigned_class);
            const valid = inDept.find(a => !isInvalidClass(a.assigned_class));
            if (valid?.assigned_class) return valid.assigned_class;
        }
        // 4. Student.assigned_class si es válida
        if (s.assigned_class && !isInvalidClass(s.assigned_class)) return s.assigned_class;
        // 5. Fallback
        return s.profile_assigned_class || s.assigned_class || '-';
    };
    // 1. Fechas con actividad (ya vienen ordenadas ASC desde el SP)
    const uniqueDates = matrix.dates;

    if (uniqueDates.length === 0) {
        throw new Error("No hay fechas con asistencia registrada.");
    }

    // 2. Map student_id -> string de marcas alineada a uniqueDates
    const marksMap = new Map<string, string>();
    for (const r of matrix.rows) marksMap.set(r.student_id, r.marks);

    // 2 bis. Días especiales por fecha. La referencia con la leyenda del pie es el color.
    const eventsByDate = new Map<string, MatrixEvent[]>();
    (matrix.events || [])
        .slice()
        .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
        .forEach((e) => {
            const lista = eventsByDate.get(e.date) || [];
            lista.push(e);
            eventsByDate.set(e.date, lista);
        });

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
    const classColW = showClassColumn ? 22 : 0;
    const nameColW = showClassColumn ? 50 : 65;
    const fixedColsWidth = classColW + nameColW + 10; // CLASE? + NOMBRE + ASIST
    const dateColWidth = 8;
    const availableWidth = pageWidth - margin * 2 - fixedColsWidth;
    const datesPerPage = Math.max(1, Math.floor(availableWidth / dateColWidth));

    let startY = 28;

    // Leyenda de los días sin clase que aparecen en las columnas de esta página.
    const drawLegend = (evs: MatrixEvent[], y: number) => {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(80);
        doc.text('REFERENCIAS · DÍAS SIN CLASE', margin, y);
        doc.setFont('helvetica', 'normal');
        let cy = y + 4.5;
        for (const e of evs) {
            const c = getEventColor(e.color);
            doc.setFillColor(c.rgb[0], c.rgb[1], c.rgb[2]);
            doc.setDrawColor(170);
            doc.rect(margin, cy - 3, 4, 4, 'FD');
            doc.setTextColor(60);
            const fecha = format(new Date(e.date + 'T00:00:00'), 'dd/MM');
            const clase = e.assigned_class ? ` (${e.assigned_class})` : '';
            doc.text(`${fecha} — ${e.title}${clase}`, margin + 6, cy);
            cy += 4.5;
        }
        doc.setTextColor(0);
    };

    for (let pageIdx = 0; pageIdx * datesPerPage < uniqueDates.length; pageIdx++) {
        if (pageIdx > 0) {
            doc.addPage();
            startY = margin + 4;
        }

        const chunkStart = pageIdx * datesPerPage;
        const chunkDates = uniqueDates.slice(chunkStart, chunkStart + datesPerPage);

        // Build grouped header: month row + day row
        const monthRow: any[] = [
            ...(showClassColumn ? [{ content: 'CLASE', rowSpan: 2, styles: { halign: 'center', valign: 'middle' } }] : []),
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

        const dayRow: any[] = chunkDates.map(d => {
            const evs = eventsByDate.get(d);
            const dia = format(new Date(d + 'T00:00:00'), 'dd');
            if (!evs?.length) return { content: dia, styles: { halign: 'center', fontSize: 7 } };
            const c = getEventColor(evs[0].color);
            // Mismo formato que el resto de los días: lo que lo cruza con la leyenda es el color.
            return {
                content: dia,
                styles: { halign: 'center', fontSize: 7, fillColor: c.rgb, textColor: c.textRgb },
            };
        });

        const body = sortedStudents.map(s => {
            const chunkMarks = (marksMap.get(s.id) || '').slice(chunkStart, chunkStart + chunkDates.length);
            const totalP = chunkMarks.split('').filter(c => c === 'P').length;
            const row: any[] = [
                ...(showClassColumn ? [{ content: classForStudent(s), styles: { halign: 'center', fontStyle: 'bold' } }] : []),
                { content: `${s.first_name} ${s.last_name}`, styles: { fontStyle: 'bold' } },
                { content: totalP.toString(), styles: { halign: 'center', fontSize: 7 } },
            ];
            for (let i = 0; i < chunkDates.length; i++) {
                const v = chunkMarks[i];
                const ev = eventsByDate.get(chunkDates[i])?.[0];
                // Si igual se tomó lista ese día, la asistencia manda sobre el color del evento.
                if (v === 'P') row.push({ content: 'P', styles: { halign: 'center', fontSize: 7, fillColor: [220, 240, 220] } });
                else if (v === 'A') row.push({ content: 'A', styles: { halign: 'center', fontSize: 7, textColor: [200, 0, 0], fillColor: [255, 235, 235] } });
                else if (ev) row.push({ content: '', styles: { fillColor: getEventColor(ev.color).rgb } });
                else row.push({ content: '', styles: { fillColor: [248, 248, 248] } });
            }
            return row;
        });

        const colStyles: any = {};
        let baseIdx = 0;
        if (showClassColumn) {
            colStyles[baseIdx++] = { cellWidth: 22 };
        }
        colStyles[baseIdx++] = { cellWidth: nameColW };
        colStyles[baseIdx++] = { cellWidth: 10 };
        for (let i = 0; i < chunkDates.length; i++) {
            colStyles[baseIdx + i] = { cellWidth: dateColWidth };
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

        const chunkEvents = chunkDates.flatMap(d => eventsByDate.get(d) || []);
        if (chunkEvents.length > 0) {
            const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY;
            let legendY = (finalY || startY) + 6;
            const alto = 5 + chunkEvents.length * 4.5;
            if (legendY + alto > pageHeight - 8) {
                doc.addPage();
                legendY = margin + 6;
            }
            drawLegend(chunkEvents, legendY);
        }
    }

    // Nombre del archivo con depto/clase (del título) para diferenciarlos a simple vista.
    const slug = (title || '')
        .replace(/^Asistencia\s*-?\s*/i, '')
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '_')
        .replace(/^_+|_+$/g, '');
    const namePart = slug ? `${slug}_` : '';
    doc.save(`Matriz_Asistencia_${namePart}${format(new Date(), "yyyyMMdd")}.pdf`);
};
