export interface ImportCrew {
  fullName: string; email: string; password: string; companyName: string; jobTitle: string; phoneNumber: string;
  crewType: string; result: string; done: boolean;
}
export function parseCrewCsv(text: string): ImportCrew[] {
  text = text.replace(/^\uFEFF/, '');
  const delimiter = text.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const lines: string[][] = []; let row: string[] = [], cell = '', quoted = false;
  for (let i=0; i<text.length; i++) {
    const ch=text[i];
    if(ch==='"') { if(quoted && text[i+1]==='"'){cell+='"';i++;} else quoted=!quoted; }
    else if(ch===delimiter && !quoted){row.push(cell);cell='';}
    else if((ch==='\n'||ch==='\r') && !quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(v=>v.trim()))lines.push(row);row=[];cell='';}
    else cell+=ch;
  }
  if(quoted)throw new Error('Tanda kutip CSV belum ditutup.');
  row.push(cell);if(row.some(v=>v.trim()))lines.push(row);
  const headers=(lines.shift()||[]).map(v=>v.trim().toLowerCase());
  const required=['nama','email','password','perusahaan','jabatan','no_hp'];
  if(required.some(h=>!headers.includes(h)) || new Set(headers).size!==headers.length)throw new Error('Header CSV harus memuat nama, email, password, perusahaan, jabatan, no_hp tanpa kolom ganda.');
  if(!lines.length||lines.length>100)throw new Error('Pilih CSV berisi 1 sampai 100 akun.');
  const emails=new Set<string>();
  return lines.map((values,index)=>{
    const get=(key:string)=>values[headers.indexOf(key)]||'';
    const email=get('email').trim().toLowerCase(),password=get('password');
    if(values.length!==headers.length)throw new Error(`Baris ${index+2}: jumlah kolom tidak sesuai.`);
    if(get('nama').trim().length<2||get('nama').trim().length>150||!/^\S+@\S+\.\S+$/.test(email)||email.length>150)throw new Error(`Baris ${index+2}: nama atau email tidak valid.`);
    if(password.length<8||password.length>128)throw new Error(`Baris ${index+2}: password harus 8–128 karakter.`);
    if(get('perusahaan').trim().length>150||get('jabatan').trim().length>100||get('no_hp').trim().length>30)throw new Error(`Baris ${index+2}: perusahaan, jabatan, atau nomor HP terlalu panjang.`);
    if(emails.has(email))throw new Error(`Baris ${index+2}: email muncul lebih dari satu kali.`);emails.add(email);
    return {fullName:get('nama').trim(),email,password,companyName:get('perusahaan').trim(),jobTitle:get('jabatan').trim(),phoneNumber:get('no_hp').trim(),crewType:'',result:'',done:false};
  });
}
