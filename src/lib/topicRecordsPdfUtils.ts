import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { TopicRecord } from '@/lib/api';

const NAVY = [0, 35, 102] as [number, number, number];
const SIG_ROW_H = 14; // altura mínima de fila con firma (mm)
const DEFAULT_ROW_H = 10;

const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd/MM/yy', { locale: es }); }
  catch { return d; }
};

export const exportTopicRecordsPdf = (
  records: TopicRecord[],
  companyName = 'CCDT',
  departmentName?: string,
  assignedClass?: string,
  showClassCol = false,
) => {
  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  const sorted = [...records].sort((a, b) => a.fecha.localeCompare(b.fecha));

  // ── HEADER ──────────────────────────────────────────────────────────────────
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, pageWidth, 28, 'F');

  doc.setTextColor(255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('REGISTRO DE TEMAS', margin, 12);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const subtitle = [companyName, departmentName, assignedClass].filter(Boolean).join(' · ');
  doc.text(subtitle, margin, 20);
  doc.text(
    `Generado: ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`,
    pageWidth - margin, 20, { align: 'right' }
  );
  doc.setTextColor(0);

  // ── TABLA ───────────────────────────────────────────────────────────────────
  // Columnas con dataKey para identificarlas en callbacks
  const columns = [
    ...(showClassCol ? [{ header: 'Clase', dataKey: 'clase' }] : []),
    { header: 'Fecha',              dataKey: 'fecha' },
    { header: 'Tema',               dataKey: 'tema' },
    { header: 'Base Bíblica',       dataKey: 'base_biblica' },
    { header: 'Enseñanza Principal',dataKey: 'ensenanza' },
    { header: 'Versículo',          dataKey: 'versiculo' },
    { header: 'Actividad',          dataKey: 'actividad' },
    { header: 'T',  dataKey: 'total' },
    { header: 'P',  dataKey: 'presentes' },
    { header: 'N',  dataKey: 'nuevos' },
    { header: 'A',  dataKey: 'ausentes' },
    { header: 'FIRMA',              dataKey: 'firma' },
    { header: 'Observaciones',      dataKey: 'obs' },
  ];

  const body = sorted.map(r => ({
    clase:      r.assigned_class || '',
    fecha:      fmtDate(r.fecha),
    tema:       r.tema || '',
    base_biblica: r.base_biblica || '',
    ensenanza:  r.ensenanza_principal || '',
    versiculo:  r.versiculo_memorizar || '',
    actividad:  r.actividad_practica || '',
    total:      r.estadistica_total?.toString() ?? '',
    presentes:  r.estadistica_presentes_regulares?.toString() ?? '',
    nuevos:     r.estadistica_presentes_nuevos?.toString() ?? '',
    ausentes:   r.estadistica_ausentes?.toString() ?? '',
    firma:      '',   // celda vacía — la imagen se dibuja en didDrawCell
    obs:        r.observaciones || '',
  }));

  autoTable(doc, {
    startY: 32,
    columns,
    body,
    headStyles: {
      fillColor: NAVY,
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      valign: 'middle',
    },
    styles: {
      font: 'helvetica',
      fontSize: 7.5,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
    },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      clase:        { cellWidth: 22 },
      fecha:        { cellWidth: 18, halign: 'center' },
      tema:         { cellWidth: 38 },
      base_biblica: { cellWidth: 24 },
      ensenanza:    { cellWidth: 52 },
      versiculo:    { cellWidth: 22 },
      actividad:    { cellWidth: 26 },
      total:        { cellWidth: 5, halign: 'center', fontStyle: 'bold' },
      presentes:    { cellWidth: 5, halign: 'center', fontStyle: 'bold' },
      nuevos:       { cellWidth: 5, halign: 'center', fontStyle: 'bold' },
      ausentes:     { cellWidth: 5, halign: 'center', fontStyle: 'bold' },
      firma:        { cellWidth: 38, halign: 'center' },
      obs:          { cellWidth: 'auto' },
    },
    didParseCell: (data) => {
      const statsCols = ['total', 'presentes', 'nuevos', 'ausentes'];
      if (statsCols.includes(data.column.dataKey as string)) {
        data.cell.styles.cellPadding = 1;
      }
      if (data.column.dataKey === 'firma' && data.section === 'body') {
        const record = sorted[data.row.index];
        if (record?.firma) {
          data.cell.styles.minCellHeight = SIG_ROW_H;
        } else {
          data.cell.styles.minCellHeight = DEFAULT_ROW_H;
        }
      }
    },
    // Dibujar la imagen de firma dentro de su celda
    didDrawCell: (data) => {
      if (data.column.dataKey === 'firma' && data.section === 'body') {
        const record = sorted[data.row.index];
        if (record?.firma) {
          const pad = 2;
          const x = data.cell.x + pad;
          const y = data.cell.y + pad;
          const w = data.cell.width - pad * 2;
          const h = data.cell.height - pad * 2;
          try {
            doc.addImage(record.firma, 'PNG', x, y, w, h, undefined, 'FAST');
          } catch {
            // si la imagen falla, no rompe el PDF
          }
        }
      }
    },
    didDrawPage: () => {
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Página ${(doc as any).internal.getCurrentPageInfo().pageNumber}`,
        pageWidth - margin, pageHeight - 6, { align: 'right' }
      );
      doc.setTextColor(0);
    },
  });

  const parts = ['registro-temas', departmentName, assignedClass, format(new Date(), 'dd-MM-yyyy')]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/\s+/g, '_');
  doc.save(`${parts}.pdf`);
};
