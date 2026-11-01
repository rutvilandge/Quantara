import type { QueryResult } from './Queries';

function filename(name: string) { return name.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, 80) || 'quantara-report'; }
export function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportCsv(result: QueryResult, name: string) {
  const text = [result.columns.map(csvCell).join(','), ...result.rows.map(row => result.columns.map(c => csvCell(row[c])).join(','))].join('\r\n');
  download(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8' }), filename(name) + '.csv');
}
export async function exportPdf(result: QueryResult, title: string, source: string, sql: string) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const document = new jsPDF({ orientation: result.columns.length > 6 ? 'landscape' : 'portrait' });
  document.setTextColor(49, 91, 67); document.setFontSize(11); document.text('QUANTARA / ANALYTICS REPORT', 14, 18);
  document.setFontSize(21); document.text(document.splitTextToSize(title, 240), 14, 32);
  document.setFontSize(9); document.setTextColor(104, 141, 112);
  document.text(`Source: ${source} | Exported: ${new Date().toISOString().slice(0, 10)} | ${result.rows.length} rows${result.truncated ? ' (limited to 500)' : ''}`, 14, 46);
  autoTable(document, { startY: 54, head: [result.columns], body: result.rows.map(row => result.columns.map(c => row[c] == null ? '' : String(row[c]))), styles: { fontSize: 7, cellPadding: 3 }, headStyles: { fillColor: [49, 91, 67] }, alternateRowStyles: { fillColor: [246, 249, 245] }, margin: { bottom: 20 } });
  document.addPage(); document.setFontSize(15); document.setTextColor(49, 91, 67); document.text('Source query & context', 14, 22);
  document.setFontSize(9); document.text(document.splitTextToSize(sql, 180), 14, 36);
  document.text('This report contains executed query results, not model-generated predictions.', 14, 100);
  const pages = document.getNumberOfPages();
  for (let p = 1; p <= pages; p++) { document.setPage(p); document.setFontSize(8); document.text(`QUANTARA | ${p} / ${pages}`, 14, document.internal.pageSize.getHeight() - 10); }
  document.save(filename(title) + '.pdf');
}
