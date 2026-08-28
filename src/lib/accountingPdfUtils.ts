import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccountingTransaction, AccountingBalance, AccountingCategoryTotal } from '@/lib/api';
import { CHART_COLORS, hexToRgb } from '@/lib/chartColors';

const NAVY: [number, number, number] = [30, 41, 59];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);

const fmtDate = (d: string) => {
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: es }); } catch { return d; }
};

type LedgerRow = AccountingTransaction & { saldo: number };

export const exportAccountingReport = (
  ledger: LedgerRow[],
  balance: AccountingBalance,
  departmentName: string,
  range: { from?: string; to?: string },
  companyName: string = 'Nexus'
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Reporte de Contabilidad - ${departmentName}`, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const periodo = range.from || range.to
    ? `Período: ${range.from ? fmtDate(range.from) : '...'} a ${range.to ? fmtDate(range.to) : '...'}`
    : 'Período: todos los movimientos';
  doc.text(periodo, pageWidth / 2, 25, { align: 'center' });
  doc.text(`${companyName} · Generado ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pageWidth / 2, 31, { align: 'center' });

  // Resumen
  autoTable(doc, {
    startY: 38,
    body: [
      ['Saldo inicial', fmtMoney(balance.opening_balance)],
      ['Total ingresos', fmtMoney(balance.total_ingresos)],
      ['Total egresos', fmtMoney(balance.total_egresos)],
      ['Balance', fmtMoney(balance.balance)],
    ],
    theme: 'plain',
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50 }, 1: { halign: 'right' } },
    margin: { left: pageWidth / 2 - 45 },
  });

  const afterSummary = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 60;

  const openingRow = ['—', 'Saldo inicial', '', '', '', '', fmtMoney(balance.opening_balance)];
  const body = ledger.map(t => [
    fmtDate(t.movement_date),
    t.category || '-',
    t.description || '-',
    t.profiles ? `${t.profiles.first_name} ${t.profiles.last_name}` : '-',
    t.type === 'ingreso' ? fmtMoney(Number(t.amount)) : '',
    t.type === 'egreso' ? fmtMoney(Number(t.amount)) : '',
    fmtMoney(t.saldo),
  ]);

  autoTable(doc, {
    startY: afterSummary + 6,
    head: [['Fecha', 'Motivo', 'Detalle', 'Responsable', 'Debe', 'Haber', 'Saldo']],
    body: [openingRow, ...body],
    foot: [['', '', '', 'Totales', fmtMoney(balance.total_ingresos), fmtMoney(balance.total_egresos), fmtMoney(balance.balance)]],
    headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 8 },
    footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 8 },
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, overflow: 'linebreak' },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: {
      0: { cellWidth: 20, halign: 'center' },
      4: { halign: 'right' },
      5: { halign: 'right' },
      6: { halign: 'right', fontStyle: 'bold' },
    },
  });

  doc.save(`contabilidad_${departmentName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};

// Sector de torta como polígono (jsPDF no tiene arcos): centro -> arco cada 2° -> cierre.
const drawPieSlice = (
  doc: jsPDF,
  cx: number, cy: number, r: number,
  startDeg: number, endDeg: number,
  color: [number, number, number]
) => {
  const deltas: [number, number][] = [];
  let prevX = cx, prevY = cy;
  const push = (deg: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    const x = cx + r * Math.cos(rad);
    const y = cy + r * Math.sin(rad);
    deltas.push([x - prevX, y - prevY]);
    prevX = x; prevY = y;
  };
  for (let a = startDeg; a < endDeg; a += 2) push(a);
  push(endDeg);
  doc.setFillColor(...color);
  doc.lines(deltas, cx, cy, [1, 1], 'F', true);
};

// Reporte de la tab "Por motivos": torta + totales por motivo, para ingresos y egresos.
export const exportAccountingByCategoryReport = (
  rows: AccountingCategoryTotal[],
  departmentName: string,
  range: { from?: string; to?: string },
  companyName: string = 'Nexus',
  assignedClass?: string
) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Contabilidad por motivos - ${departmentName}`, pageWidth / 2, 18, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const periodo = range.from || range.to
    ? `Período: ${range.from ? fmtDate(range.from) : '...'} a ${range.to ? fmtDate(range.to) : '...'}`
    : 'Período: todos los movimientos';
  doc.text(periodo + (assignedClass ? ` · Clase: ${assignedClass}` : ''), pageWidth / 2, 25, { align: 'center' });
  doc.text(`${companyName} · Generado ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: es })}`, pageWidth / 2, 31, { align: 'center' });

  let cursorY = 40;

  (['ingreso', 'egreso'] as const).forEach((tipo) => {
    const items = rows.filter(r => r.type === tipo);
    if (!items.length) return;

    const total = items.reduce((acc, r) => acc + Number(r.total), 0);

    // Salto de página si no entra la torta con su tabla.
    if (cursorY + 75 > pageHeight) { doc.addPage(); cursorY = 20; }

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(tipo === 'ingreso' ? 'Ingresos por motivo' : 'Egresos por motivo', 14, cursorY);
    cursorY += 6;

    const cx = pageWidth / 2;
    const cy = cursorY + 28;
    let startDeg = 0;
    items.forEach((r, i) => {
      const sweep = total ? (Number(r.total) / total) * 360 : 0;
      drawPieSlice(doc, cx, cy, 26, startDeg, startDeg + sweep, hexToRgb(CHART_COLORS[i % CHART_COLORS.length]));
      startDeg += sweep;
    });
    cursorY = cy + 32;

    autoTable(doc, {
      startY: cursorY,
      head: [['', 'Motivo', 'Mov.', 'Total', '%']],
      body: items.map(r => [
        '',
        r.category,
        String(r.cantidad),
        fmtMoney(Number(r.total)),
        `${total ? Math.round((Number(r.total) / total) * 100) : 0}%`,
      ]),
      foot: [['', 'Total', '', fmtMoney(total), '100%']],
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold', fontSize: 9 },
      footStyles: { fillColor: [226, 232, 240], textColor: 20, fontStyle: 'bold', fontSize: 9 },
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      columnStyles: {
        0: { cellWidth: 8 },
        2: { halign: 'right', cellWidth: 18 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'right', cellWidth: 18 },
      },
      // Cuadradito del color de la porción: hace de leyenda de la torta.
      didDrawCell: (data) => {
        if (data.section !== 'body' || data.column.index !== 0) return;
        doc.setFillColor(...hexToRgb(CHART_COLORS[data.row.index % CHART_COLORS.length]));
        doc.rect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 1.5, 3, 3, 'F');
      },
    });

    cursorY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || cursorY) + 12;
  });

  if (!rows.length) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text('Sin movimientos en el período seleccionado.', pageWidth / 2, cursorY + 10, { align: 'center' });
  }

  doc.save(`contabilidad_motivos_${departmentName}_${format(new Date(), 'yyyyMMdd')}.pdf`);
};
