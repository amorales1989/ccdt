// jspdf + autotable pesan ~128 KB gzip. Cargarlos con import() dinámico los saca del
// arranque: los baja solo quien genera un PDF, y recién al apretar el botón.
export async function loadJsPdf() {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
}
