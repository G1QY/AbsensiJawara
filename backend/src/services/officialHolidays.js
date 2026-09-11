// Published 19 September 2025; reviewed 11 September 2026.
// https://www.kemenkopmk.go.id/pemerintah-tetapkan-17-hari-libur-nasional-dan-8-hari-cuti-bersama-tahun-2026
const source = 'https://www.kemenkopmk.go.id/pemerintah-tetapkan-17-hari-libur-nasional-dan-8-hari-cuti-bersama-tahun-2026';
const national = [
 ['01-01','Tahun Baru Masehi'], ['01-16','Isra Mikraj Nabi Muhammad SAW'],
 ['02-17','Tahun Baru Imlek'], ['03-19','Hari Suci Nyepi'],
 ['03-21','Idul Fitri'], ['03-22','Idul Fitri'], ['04-03','Wafat Yesus Kristus'],
 ['04-05','Paskah'], ['05-01','Hari Buruh Internasional'], ['05-14','Kenaikan Yesus Kristus'],
 ['05-27','Idul Adha'], ['05-31','Waisak'], ['06-01','Hari Lahir Pancasila'],
 ['06-16','Tahun Baru Islam'], ['08-17','Hari Kemerdekaan Republik Indonesia'],
 ['08-25','Maulid Nabi Muhammad SAW'], ['12-25','Natal'],
];
const collective = [
 ['02-16','Tahun Baru Imlek'], ['03-18','Hari Suci Nyepi'],
 ['03-20','Idul Fitri'], ['03-23','Idul Fitri'], ['03-24','Idul Fitri'],
 ['05-15','Kenaikan Yesus Kristus'], ['05-28','Idul Adha'], ['12-24','Natal'],
];
function officialRows(year) {
 if (Number(year) !== 2026) return [];
 return [
  ...national.map(([date,name])=>({holiday_date:`2026-${date}`,name,kind:'NATIONAL_HOLIDAY'})),
  ...collective.map(([date,name])=>({holiday_date:`2026-${date}`,name:`Cuti bersama ${name}`,kind:'COLLECTIVE_LEAVE'})),
 ].sort((a,b)=>a.holiday_date.localeCompare(b.holiday_date));
}
module.exports = { officialRows, source };
