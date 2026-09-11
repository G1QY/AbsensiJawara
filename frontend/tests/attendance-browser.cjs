// Run from frontend after npm run build; API responses are explicit test fixtures.
const { chromium } = require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES + '/playwright');
const http = require('node:http'), fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve('dist'), output = require("./qa-output.cjs");
const server = http.createServer((req,res) => {
  const file = path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));
  fs.readFile(file,(e,data) => {if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});
});
(async()=>{
  const binary = (await import(process.env.CHROMIUM_MODULE)).default;
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}}), errors=[], calls=[];
    page.on('pageerror',e=>errors.push(e.message));
    const photo='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl6yWQAAAAASUVORK5CYII=';
    const local={id:'GST-P5D35',nama:'Gilang Lokal',hp:'087825791000',jenis:'Crew Event',lokasi:'BCH',posisi:'Fotografer',tipe:'Clock In',timestamp:'Senin, 31 Agustus 2026 • 13:04',dateFull:'Senin, 31 Agustus 2026',timeShort:'13:04',foto:photo,catatan:'Kendala login, hadir di BCH',status:'Menunggu Verifikasi Admin'};
    const registered={id:'11111111-1111-4111-8111-111111111111',attendance_date:'2026-08-31',check_in:'2026-08-31T02:20:00Z',check_out:'2026-08-31T12:00:00Z',status:'LATE',late_minutes:20,overtime_minutes:60,overtime_status:'PENDING',review_status:'PENDING',review_note:'',check_in_note:'Masuk lewat gerbang belakang',check_out_note:'Selesai merapikan alat',inPhoto:photo,outPhoto:photo+'#out',crew:{employee_code:'BDG01',user:{full_name:'Rina Store',email:'rina@example.test',phone_number:'081234567890'}},store_assignment:{store:{name:'Bandung Store 1'}},store_schedule:{schedule_date:'2026-08-31',start_time:'09:00:00',end_time:'18:00:00'}};
    const guest={id:'22222222-2222-4222-8222-222222222222',legacy_id:null,full_name:'Budi Guest',phone:'081111111111',crew_type:'CREW_STORE',location_name:'Bandung Store 2',position:'Operator',clock_type:'OUT',occurred_at:'2026-08-30T11:00:00Z',received_at:'2026-08-30T11:00:00Z',time_source:'SERVER',note:'Pulang setelah beres alat',review_status:'PENDING',outPhoto:photo};
    const guests=[guest];let conflict=true;
    const user={id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',full_name:'Admin Uji',email:'admin@example.test'};
    await page.addInitScript(g=>localStorage.setItem('fotosnaps_guest_attendances',JSON.stringify([g])),local);
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());if(url.origin===origin||url.protocol==='data:')return route.continue();
      if(!url.pathname.startsWith('/api/'))return route.abort();
      const p=url.pathname,method=req.method();calls.push({p,method,body:req.postData()});let data=[],status=200;
      if(p==='/api/auth/login')data={token:'fixture-token',user,role:'SUPER_ADMIN'};
      else if(p==='/api/users/me')data=user;
      else if(p==='/api/admin-directory')data={branches:[],stores:[],events:[]};
      else if(p==='/api/admin-attendance')data={registered:[registered],guest:guests};
      else if(p==='/api/admin-attendance/import-guest'){
        assert.match(req.postData(),/GST-P5D35/);assert.match(req.postData(),/Kendala login/);
        const imported={...guest,id:'33333333-3333-4333-8333-333333333333',legacy_id:local.id,full_name:local.nama,phone:local.hp,crew_type:'CREW_EVENT',location_name:local.lokasi,clock_type:'IN',occurred_at:'2026-08-31T06:04:00Z',time_source:'LEGACY_DEVICE',note:local.catatan,inPhoto:photo,outPhoto:undefined};guests.push(imported);data={id:imported.id};
      } else if(p.endsWith('/review')){
        assert(!p.includes('GST-'));const body=req.postDataJSON();
        if(conflict){status=409;data={message:'Pengajuan telah ditinjau. Muat ulang.'};conflict=false;}
        else {const row=p.includes('/registered/')?registered:guests.find(g=>p.includes(g.id));if(body.target==='overtime')row.overtime_status=body.decision;else row.review_status=body.decision;row.review_note=body.note;data={id:row.id};}
      } else if(p.startsWith('/api/admin-attendance/registered/'))data=registered;
      else if(p.startsWith('/api/admin-attendance/guest/'))data=guests.find(g=>p.endsWith(g.id));
      await route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Log in',exact:true}).click();
    await page.locator('aside:visible').getByRole('button',{name:'Absensi',exact:true}).click();
    await page.getByText('Gilang Lokal',{exact:true}).waitFor();assert.equal(await page.locator('tbody tr').count(),3);
    await page.getByLabel('Cari crew',{exact:true}).fill('rina');await page.getByLabel('Tanggal kerja',{exact:true}).fill('2026-08-31');assert.equal(await page.locator('tbody tr').count(),1);
    await page.getByLabel('Tanggal kerja',{exact:true}).fill('2026-08-30');await page.getByText('Tidak ada absensi yang sesuai filter.').waitFor();
    await page.getByLabel('Tanggal kerja',{exact:true}).fill('2026-08-31');
    const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export Rekap ke Excel'}).click();await (await download).saveAs(path.join(output,'attendance-filtered.xlsx'));
    await page.getByRole('button',{name:'Lihat Detail',exact:true}).click();let dialog=page.getByRole('dialog');await dialog.waitFor();
    assert.equal(await dialog.getByAltText('Foto Clock In',{exact:true}).count(),1);assert.equal(await dialog.getByAltText('Foto Clock Out',{exact:true}).count(),1);
    assert.notEqual(await dialog.getByAltText('Foto Clock In',{exact:true}).getAttribute('src'),await dialog.getByAltText('Foto Clock Out',{exact:true}).getAttribute('src'));
    await dialog.getByText('Masuk lewat gerbang belakang',{exact:true}).waitFor();await dialog.getByText('Selesai merapikan alat',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Tutup dialog'}).click();
    await page.getByRole('button',{name:'Reset filter'}).click();const guestRow=page.locator('tbody tr').filter({hasText:'Budi Guest'});
    await guestRow.getByRole('button',{name:'Lihat Detail'}).click();dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getByAltText('Foto Clock In',{exact:true}).count(),0);assert.equal(await dialog.getByAltText('Foto Clock Out',{exact:true}).count(),1);await dialog.getByText('Pulang setelah beres alat',{exact:true}).waitFor();await dialog.getByRole('button',{name:'Tutup dialog'}).click();
    await page.locator('tbody tr').filter({hasText:'Gilang Lokal'}).getByRole('button',{name:'Simpan & Tinjau'}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Simpan data lama ke server'}).click();await dialog.getByRole('button',{name:'Setujui',exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Tolak Pengajuan'}).click();await dialog.getByText('Isi alasan penolakan terlebih dahulu.').waitFor();
    await dialog.getByLabel('Catatan admin',{exact:true}).fill('Bukti perlu diperbaiki');await dialog.getByRole('button',{name:'Tolak Pengajuan'}).click();await dialog.getByText('Pengajuan telah ditinjau. Muat ulang.').waitFor();
    await dialog.getByRole('button',{name:'Tolak Pengajuan'}).click();await page.getByText('Pengajuan absensi ditolak. Keputusan tersimpan dan notifikasi dikirim ke akun crew.').waitFor();
    const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('fotosnaps_guest_attendances')));assert.equal(persisted[0].foto,photo);assert.equal(persisted[0].serverId,guests[1].id);assert.equal(await page.locator('tbody tr').count(),3);
    await page.locator('tbody tr').filter({hasText:'Rina Store'}).getByRole('button',{name:'Tinjau Absensi',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Setujui',exact:true}).click();await page.getByText('Pengajuan absensi disetujui. Keputusan tersimpan dan notifikasi dikirim ke akun crew.').waitFor();assert.equal(registered.status,'LATE');assert.equal(registered.late_minutes,20);
    await page.locator('tbody tr').filter({hasText:'Rina Store'}).getByRole('button',{name:'Tinjau Lembur',exact:true}).click();await page.getByRole('dialog').getByLabel('Yang ditinjau').selectOption('overtime');await page.getByRole('dialog').getByRole('button',{name:'Setujui',exact:true}).click();await page.getByText('Lembur disetujui. Keputusan tersimpan dan notifikasi dikirim ke akun crew.').waitFor();assert.equal(registered.overtime_status,'APPROVED');
    const colors=()=>page.evaluate(()=>({sidebar:getComputedStyle(document.querySelector('aside')).backgroundColor,topbar:getComputedStyle(document.querySelector('header')).backgroundColor}));
    await page.locator('table').evaluate(t=>t.parentElement.scrollLeft=0);
    let c=await colors();assert.equal(c.sidebar,c.topbar);
    const navColor=await page.locator('aside:visible').getByRole('button',{name:'Dashboard',exact:true}).evaluate(e=>getComputedStyle(e).color);assert.equal(navColor,'rgb(70, 88, 115)');
    await page.screenshot({path:path.join(output,'attendance-light.png'),animations:'disabled'});
    await page.getByRole('button',{name:'Ubah ke tema gelap'}).click();c=await colors();assert.equal(c.sidebar,c.topbar);await page.screenshot({path:path.join(output,'attendance-dark.png'),animations:'disabled'});
    await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1));await page.screenshot({path:path.join(output,'attendance-mobile.png'),animations:'disabled'});
    assert.deepEqual(errors,[]);console.log('PASS browser: search/date/reset, real xlsx download, independent photos/notes, legacy import, rejection validation/error/retry, approval/overtime separation, sidebar themes, mobile overflow.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
