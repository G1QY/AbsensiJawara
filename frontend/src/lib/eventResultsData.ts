// One calculation for event screens and PDF/Excel reports.
export function eventFinancials(data: Record<string, unknown>) {
  const number = (key: string) => Number(data[key]) || 0;
  const cash = data.omset_tunai === undefined && data.omset_transfer === undefined ? number('omset_nominal') : number('omset_tunai');
  const transfer = number('omset_transfer');
  const revenue = cash + transfer;
  const transport = number('transportasi_pergi_nominal') + number('transportasi_pulang_nominal');
  const quota = number('kuota_nominal');
  const cost = transport + quota;
  return { cash, transfer, revenue, transport, quota, cost, net: revenue - cost };
}
