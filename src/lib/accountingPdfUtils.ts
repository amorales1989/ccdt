import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { es } from 'date-fns/locale';
import type { AccountingTransaction, AccountingBalance } from '@/lib/api';

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
  companyName: string = 'CCDT'
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
