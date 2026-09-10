// Utilitas export data ke Excel (.csv, siap dibuka Excel) dan PDF (via dialog print browser)

export type ExportRow = (string | number)[];

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

/** Export array data ke file .csv (format Excel) dan langsung download */
export function exportToExcel(filename: string, headers: string[], rows: ExportRow[]) {
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}-${todayStr()}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** Export array data ke PDF: membuka tab print browser berisi tabel siap "Simpan sebagai PDF" */
export function exportToPDF(title: string, subtitle: string, headers: string[], rows: ExportRow[]) {
  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return;

  const style = `
    <style>
      * { box-sizing: border-box; }
      body { font-family: 'Inter', system-ui, sans-serif; padding: 32px; color: #0F172A; }
      h1 { font-size: 18px; margin: 0 0 2px; }
      p.sub { font-size: 12px; color: #64748B; margin: 0 0 20px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #E2E8F0; padding: 6px 8px; text-align: left; }
      th { background: #F1F5F9; text-transform: uppercase; font-size: 9px; letter-spacing: 0.03em; color: #64748B; }
      tr:nth-child(even) td { background: #F8FAFC; }
      .footer { margin-top: 16px; font-size: 10px; color: #94A3B8; }
      @media print { body { padding: 12px; } }
    </style>
  `;

  const tableHead = `<tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>`;
  const tableBody = rows
    .map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`)
    .join('');

  win.document.write(`
    <html>
      <head><title>${title}</title>${style}</head>
      <body>
        <h1>${title}</h1>
        <p class="sub">${subtitle} • Dicetak ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <table>
          <thead>${tableHead}</thead>
          <tbody>${tableBody}</tbody>
        </table>
        <p class="footer">Jawara &mdash; Dokumen dibuat otomatis dari sistem.</p>
      </body>
    </html>
  `);
  win.document.close();
  win.onload = () => {
    win.focus();
    win.print();
  };
}
