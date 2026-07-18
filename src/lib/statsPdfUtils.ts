import jsPDF from "jspdf";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ReportData {
    totalStudents: number;
    attendanceRate: number | string;
    totalVolunteers: number;
    newStudents: number;
    genderData: { name: string; key?: string; value: number }[];
    ageBuckets: { name: string; value: number }[];
    last12Months: { name: string; total: number }[];
    roleData: { name: string; value: number }[];
}

// Paleta del reporte (coherente con la app)
const INDIGO: [number, number, number] = [99, 102, 241];
const INDIGO_DARK: [number, number, number] = [49, 46, 129];
const FUCHSIA: [number, number, number] = [236, 72, 153];
const INK: [number, number, number] = [30, 41, 59];
const INK_MUTED: [number, number, number] = [100, 116, 139];
const LINE_SOFT: [number, number, number] = [226, 232, 240];
const SURFACE_SOFT: [number, number, number] = [248, 250, 252];

export const exportStatsReport = async (data: ReportData, scopeLabel: string = "Estadísticas") => {
    const doc = new jsPDF("p", "mm", "a4");
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 18;
    const contentW = pageWidth - margin * 2;
    let y = 0;

    const setColor = (fn: 'setTextColor' | 'setFillColor' | 'setDrawColor', c: [number, number, number]) =>
        (doc as any)[fn](c[0], c[1], c[2]);

    const addFooter = (pageNum: number, totalPages: number) => {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        setColor('setTextColor', INK_MUTED);
        doc.text(`Generado el ${format(new Date(), "PPp", { locale: es })}`, margin, pageHeight - 8);
        doc.text(`${pageNum} / ${totalPages}`, pageWidth - margin, pageHeight - 8, { align: "right" });
        setColor('setDrawColor', LINE_SOFT);
        doc.setLineWidth(0.2);
        doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    };

    const sectionTitle = (title: string, subtitle?: string) => {
        setColor('setFillColor', INDIGO);
        doc.roundedRect(margin, y - 3.2, 1.6, 4.5, 0.8, 0.8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12.5);
        setColor('setTextColor', INK);
        doc.text(title, margin + 4.5, y);
        if (subtitle) {
            doc.setFont("helvetica", "normal");
            doc.setFontSize(8);
            setColor('setTextColor', INK_MUTED);
            doc.text(subtitle, margin + 4.5, y + 4.5);
            y += 4.5;
        }
        y += 8;
    };

    // ── Encabezado de portada ────────────────────────────────────────────────
    setColor('setFillColor', INDIGO_DARK);
    doc.rect(0, 0, pageWidth, 52, "F");
    setColor('setFillColor', INDIGO);
    doc.rect(0, 49, pageWidth, 3, "F");

    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(23);
    doc.text("Reporte de Estadísticas", margin, 26);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(199, 210, 254);
    doc.text(scopeLabel, margin, 35);
    doc.setFontSize(9);
    doc.text(format(new Date(), "PPPP", { locale: es }), margin, 43);

    y = 66;

    // ── KPIs ────────────────────────────────────────────────────────────────
    sectionTitle("Resumen");
    const rate = typeof data.attendanceRate === 'number' ? data.attendanceRate : parseFloat(data.attendanceRate) || 0;
    const kpis = [
        { label: "MIEMBROS", value: `${data.totalStudents}` },
        { label: "ASISTENCIA HISTÓRICA", value: `${rate}%` },
        { label: "EQUIPO DE SERVICIO", value: `${data.totalVolunteers}` },
        { label: "NUEVOS", value: `${data.newStudents}` },
    ];
    const kpiW = (contentW - 3 * 5) / 4;
    kpis.forEach((kpi, i) => {
        const x = margin + i * (kpiW + 5);
        setColor('setFillColor', SURFACE_SOFT);
        setColor('setDrawColor', LINE_SOFT);
        doc.setLineWidth(0.25);
        doc.roundedRect(x, y, kpiW, 24, 2.5, 2.5, "FD");
        setColor('setFillColor', INDIGO);
        doc.roundedRect(x, y, kpiW, 1.4, 0.7, 0.7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(16);
        setColor('setTextColor', INK);
        doc.text(kpi.value, x + 4, y + 12);
        doc.setFontSize(6.3);
        setColor('setTextColor', INK_MUTED);
        doc.text(kpi.label, x + 4, y + 19);
    });
    y += 36;

    // ── Crecimiento (línea nativa) ───────────────────────────────────────────
    sectionTitle("Crecimiento de membresía", "Total acumulado de miembros — últimos 12 meses");
    const chart = { x: margin + 8, y, w: contentW - 12, h: 52 };
    const totals = data.last12Months.map(m => m.total);
    const minV = Math.min(...totals);
    const maxV = Math.max(...totals);
    const span = Math.max(maxV - minV, 1);
    const px = (i: number) => chart.x + (i / (totals.length - 1)) * chart.w;
    const py = (v: number) => chart.y + chart.h - ((v - minV) / span) * (chart.h - 10) - 5;

    // Gridlines + valores de referencia
    setColor('setDrawColor', LINE_SOFT);
    doc.setLineWidth(0.2);
    [minV, Math.round((minV + maxV) / 2), maxV].forEach(v => {
        const gy = py(v);
        doc.line(chart.x, gy, chart.x + chart.w, gy);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(6.5);
        setColor('setTextColor', INK_MUTED);
        doc.text(`${v}`, chart.x - 1.5, gy + 1, { align: "right" });
    });

    // Línea
    setColor('setDrawColor', INDIGO);
    doc.setLineWidth(0.7);
    for (let i = 0; i < totals.length - 1; i++) {
        doc.line(px(i), py(totals[i]), px(i + 1), py(totals[i + 1]));
    }
    // Puntos inicial y final con etiqueta
    [[0, totals[0]], [totals.length - 1, totals[totals.length - 1]]].forEach(([i, v]) => {
        setColor('setFillColor', INDIGO);
        doc.circle(px(i as number), py(v as number), 1.1, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setColor('setTextColor', INDIGO_DARK);
        doc.text(`${v}`, px(i as number), py(v as number) - 2.5, { align: i === 0 ? "left" : "right" });
    });
    // Meses
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    setColor('setTextColor', INK_MUTED);
    data.last12Months.forEach((m, i) => {
        if (i % 2 === 0 || i === totals.length - 1) {
            doc.text(m.name, px(i), chart.y + chart.h + 4, { align: "center" });
        }
    });
    y += chart.h + 12;

    // ── Proyección (basada en datos) ─────────────────────────────────────────
    const slope = (totals[totals.length - 1] - totals[0]) / (totals.length - 1);
    const next6m = Math.round(totals[totals.length - 1] + slope * 6);
    setColor('setFillColor', SURFACE_SOFT);
    setColor('setDrawColor', LINE_SOFT);
    doc.roundedRect(margin, y, contentW, 26, 2.5, 2.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    setColor('setTextColor', INDIGO_DARK);
    doc.text(`Proyección a 6 meses: ~${next6m} miembros`, margin + 6, y + 9);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    setColor('setTextColor', INK_MUTED);
    const projTxt = `Tendencia de los últimos 12 meses: ${slope >= 0 ? '+' : ''}${slope.toFixed(1)} miembros por mes. La proyección es una extrapolación lineal del período analizado.`;
    doc.text(doc.splitTextToSize(projTxt, contentW - 12), margin + 6, y + 15);

    // ── PÁGINA 2: Demografía y equipo ───────────────────────────────────────
    doc.addPage();
    y = margin + 4;

    // Género — barra proporcional
    sectionTitle("Composición por género");
    const males = data.genderData.find(g => (g.key || g.name.toLowerCase()) === 'masculino')?.value || 0;
    const females = data.genderData.find(g => (g.key || g.name.toLowerCase()) === 'femenino')?.value || 0;
    const genderTotal = Math.max(males + females, 1);
    const barY = y + 6;
    const maleW = (males / genderTotal) * contentW;
    setColor('setFillColor', INDIGO);
    doc.roundedRect(margin, barY, Math.max(maleW - 0.5, 0), 6, 1.5, 1.5, "F");
    setColor('setFillColor', FUCHSIA);
    doc.roundedRect(margin + maleW + 0.5, barY, Math.max(contentW - maleW - 0.5, 0), 6, 1.5, 1.5, "F");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    setColor('setTextColor', INK);
    doc.text(`Masculino  ${males}  (${Math.round(males / genderTotal * 100)}%)`, margin, barY + 13);
    doc.text(`Femenino  ${females}  (${Math.round(females / genderTotal * 100)}%)`, pageWidth - margin, barY + 13, { align: "right" });
    y = barY + 24;

    // Rangos etarios — barras horizontales con valor
    sectionTitle("Distribución por edad");
    const ageRows = data.ageBuckets.filter(b => b.value > 0);
    const maxAge = Math.max(...ageRows.map(r => r.value), 1);
    const ageBarX = margin + 30;
    const ageBarW = contentW - 42;
    ageRows.forEach(row => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setColor('setTextColor', INK_MUTED);
        doc.text(row.name, margin, y + 3);
        setColor('setFillColor', LINE_SOFT);
        doc.roundedRect(ageBarX, y, ageBarW, 4, 1.2, 1.2, "F");
        setColor('setFillColor', INDIGO);
        doc.roundedRect(ageBarX, y, Math.max((row.value / maxAge) * ageBarW, 2), 4, 1.2, 1.2, "F");
        setColor('setTextColor', INK);
        doc.text(`${row.value}`, ageBarX + ageBarW + 3, y + 3.2);
        y += 7.5;
    });
    y += 10;

    // Roles — barras horizontales
    sectionTitle("Equipo de servicio por rol");
    const roleRows = data.roleData.filter(r => r.value > 0);
    const maxRole = Math.max(...roleRows.map(r => r.value), 1);
    roleRows.forEach(row => {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        setColor('setTextColor', INK_MUTED);
        doc.text(row.name.replace(/_/g, ' '), margin, y + 3, { maxWidth: 28 });
        setColor('setFillColor', LINE_SOFT);
        doc.roundedRect(ageBarX, y, ageBarW, 4, 1.2, 1.2, "F");
        setColor('setFillColor', INDIGO);
        doc.roundedRect(ageBarX, y, Math.max((row.value / maxRole) * ageBarW, 2), 4, 1.2, 1.2, "F");
        setColor('setTextColor', INK);
        doc.text(`${row.value}`, ageBarX + ageBarW + 3, y + 3.2);
        y += 7.5;
    });

    // ── Análisis de los datos (generado a partir de los números reales) ─────
    y += 10;

    const insights: string[] = [];

    // Crecimiento
    const growth12 = totals[totals.length - 1] - totals[0];
    if (Math.abs(slope) < 0.2) {
        insights.push(`La membresía se mantuvo estable en los últimos 12 meses (${totals[0]} → ${totals[totals.length - 1]}).`);
    } else {
        insights.push(`La membresía ${growth12 >= 0 ? 'creció' : 'se redujo'} ${Math.abs(growth12)} personas en 12 meses (de ${totals[0]} a ${totals[totals.length - 1]}), un ritmo de ${slope >= 0 ? '+' : ''}${slope.toFixed(1)} por mes.`);
    }
    if (data.newStudents > 0) {
        insights.push(`Actualmente hay ${data.newStudents} miembro${data.newStudents !== 1 ? 's' : ''} marcado${data.newStudents !== 1 ? 's' : ''} como nuevo${data.newStudents !== 1 ? 's' : ''}, un ${Math.round(data.newStudents / Math.max(data.totalStudents, 1) * 100)}% del total: conviene asegurar su seguimiento e integración.`);
    }

    // Género
    const malePct = Math.round(males / genderTotal * 100);
    if (malePct >= 45 && malePct <= 55) {
        insights.push(`La composición por género está equilibrada: ${malePct}% masculino y ${100 - malePct}% femenino.`);
    } else {
        const domName = malePct > 50 ? 'masculina' : 'femenina';
        insights.push(`Hay una mayoría ${domName} (${Math.max(malePct, 100 - malePct)}% contra ${Math.min(malePct, 100 - malePct)}%).`);
    }

    // Edad
    const agesTotal = ageRows.reduce((s, r) => s + r.value, 0);
    if (agesTotal > 0) {
        const domBucket = ageRows.reduce((a, b) => (b.value > a.value ? b : a));
        insights.push(`El grupo etario más numeroso es ${domBucket.name} años con ${domBucket.value} personas (${Math.round(domBucket.value / agesTotal * 100)}% de quienes tienen fecha de nacimiento cargada).`);
        const minors = ageRows.filter(r => r.name.startsWith('0') || r.name.startsWith('12')).reduce((s, r) => s + r.value, 0);
        if (minors > 0) {
            insights.push(`Los menores de 18 representan el ${Math.round(minors / agesTotal * 100)}% (${minors} personas), un indicador clave para planificar el relevo generacional.`);
        }
    }

    // Asistencia
    const rateNum = rate;
    const rateLabel = rateNum >= 75 ? 'alta' : rateNum >= 50 ? 'media' : 'baja';
    insights.push(`La tasa de asistencia histórica es del ${rateNum}% (participación ${rateLabel}${rateNum < 50 ? ': conviene revisar los grupos con más ausencias en la vista por clase' : ''}).`);

    // Equipo
    if (data.totalVolunteers > 0) {
        const ratio = Math.round(data.totalStudents / data.totalVolunteers);
        const topRole = roleRows.length > 0 ? roleRows.reduce((a, b) => (b.value > a.value ? b : a)) : null;
        insights.push(`El equipo de servicio es de ${data.totalVolunteers} personas — aproximadamente 1 servidor cada ${ratio} miembros${topRole ? `, con ${topRole.name.replace(/_/g, ' ').toLowerCase()} como rol más numeroso (${topRole.value})` : ''}.`);
    }

    // Renderizar la sección (con salto de página si no entra)
    const lineH = 4.2;
    const estimatedH = 14 + insights.reduce((s, t) => s + doc.splitTextToSize(t, contentW - 10).length * lineH + 3, 0);
    if (y + estimatedH > pageHeight - 20) {
        doc.addPage();
        y = margin + 4;
    }
    sectionTitle("Análisis de los datos");
    insights.forEach(text => {
        const lines = doc.splitTextToSize(text, contentW - 10);
        setColor('setFillColor', INDIGO);
        doc.circle(margin + 1.5, y + 1.6, 0.9, "F");
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        setColor('setTextColor', INK);
        doc.text(lines, margin + 6, y + 2.8);
        y += lines.length * lineH + 3;
    });

    // Numerar todas las páginas al final (el total recién se conoce acá)
    const totalPages = doc.getNumberOfPages();
    for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        addFooter(p, totalPages);
    }

    doc.save(`Reporte_Estadisticas_${format(new Date(), "yyyyMMdd")}.pdf`);
};
