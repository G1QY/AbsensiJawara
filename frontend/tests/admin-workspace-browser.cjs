// Isolated browser fixtures, not a live Supabase or email delivery test.
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist'),out=process.env.QA_OUTPUT;
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;fs.readFile(path.join(root,p==='/'?'index.html':p),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(data);});});
(async()=>{let browser;await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
try{
 const binary=(await import(process.env.CHROMIUM_MODULE)).default;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args});
 const context=await browser.newContext({viewport:{width:1440,height:1050},permissions:['geolocation'],geolocation:{latitude:-6.9,longitude:107.6}});
 const page=await context.newPage();page.setDefaultTimeout(12000);
 const errors=[],calls=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 const branch={id:'branch-1',name:'Bandung',code:'BDG'},user={id:'admin-1',full_name:'Admin Uji',email:'admin@example.test'};
 const crew=[{id:'crew-1',employee_code:'C01',crew_type:'CREW_EVENT',status:'ACTIVE',base_salary:80000,branch_id:branch.id,branch,user:{id:'u1',full_name:'Crew Event Uji',email:'crew@example.test',phone_number:'081234567890'},store_assignments:[],event_assignments:[]}];
 let event={id:'event-1',event_code:'EV-QA',event_name:'Event Pengujian',client_name:'Klien Uji',branch_id:branch.id,branch,event_date:'2026-09-01',start_time:'08:00:00',end_time:'17:00:00',status:'ONGOING',pic_crew_id:'crew-1',pic:{user:crew[0].user},updated_at:'2026-08-31T00:00:00Z',event_locations:[{id:'loc-1',address:'Lokasi Pengujian Bandung',latitude:-6.9,longitude:107.6,radius_meters:100}],event_assignments:[],audit:[]};
 const logs=[{id:'a1',crew_id:'crew-1',attendance_date:'2026-09-01',check_in:'2026-09-01T01:20:00Z',check_out:'2026-09-01T11:59:00Z',status:'LATE',review_status:'APPROVED',late_minutes:20,overtime_minutes:119,overtime_status:'APPROVED',check_in_note:'Catatan pengujian masuk',check_out_note:'Catatan pengujian pulang'}];
 let created=null;
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.origin===origin)return r.continue();if(!u.pathname.startsWith('/api/'))return r.abort();const p=u.pathname,method=r.request().method(),body=r.request().postData()?r.request().postDataJSON():{};calls.push({p,method,body});let data=[];
 if(p==='/api/auth/login')data={token:'fixture-token',refreshToken:'fixture-refresh',user,role:'SUPER_ADMIN'};
 else if(p==='/api/users/me')data=user;
 else if(p==='/api/admin-directory')data={branches:[branch],stores:[],events:[event]};
 else if(p==='/api/crew')data=crew;
 else if(p==='/api/crew/crew-1/email'){crew[0].user.email=body.email;data={email:body.email};}
 else if(p==='/api/crew/crew-1')data=crew[0];
 else if(p==='/api/admin-attendance')data={registered:logs,guest:[]};
 else if(p==='/api/admin-events'){if(method==='POST'){created=body;data={id:'created-1'};}else data=[event];}
 else if(p==='/api/admin-events/event-1/crew'){event.event_assignments=[{id:'as1',crew_id:'crew-1',position:body.position,status:body.status,crew:{id:'crew-1',employee_code:'C01',crew_type:'CREW_EVENT',base_salary:80000,user:crew[0].user},event_schedules:[{id:'sch1',schedule_date:'2026-09-01',start_time:'08:00:00',end_time:'17:00:00'}]}];data={id:'as1'};}
 else if(p==='/api/admin-events/event-1')data={...event,attendance:logs};
 return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Log in',exact:true}).click();
 await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();
 let dialog=page.getByRole('dialog');await dialog.getByLabel('Email',{exact:true}).fill('newcrew@example.test');await dialog.getByRole('button',{name:'Simpan Crew',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.ok(!calls.some(c=>c.p==='/api/crew/crew-1'&&c.method==='PATCH'));
 await dialog.getByRole('button',{name:'Perbarui email login'}).click();await dialog.getByRole('status').waitFor();assert.equal(crew[0].user.email,'newcrew@example.test');await dialog.getByRole('button',{name:'Tutup dialog'}).click();
 const nav=name=>page.locator('aside:visible').getByRole('button',{name,exact:true}).click();
 await nav('Dashboard');await page.getByText('Event per Bulan',{exact:true}).waitFor();assert.equal(await page.getByText('Akses cepat',{exact:true}).count(),0);assert.equal(await page.getByRole('img').count()>=3,true);
 await page.screenshot({path:out+'/dashboard-workspace-light.png',animations:'disabled'});
 await nav('Kelola Event');await page.getByRole('columnheader',{name:'PIC',exact:true}).waitFor();await page.getByLabel('Cari event').fill('tidak ada');assert.equal(await page.getByRole('button',{name:'Detail',exact:true}).count(),0);await page.getByLabel('Cari event').fill('');
 await page.getByRole('button',{name:'+ Tambah Event'}).click();dialog=page.getByRole('dialog');
 for(const [label,value]of [['Kode Event','EV-NEW'],['Nama Event','Event Baru Uji'],['Tanggal Event','2026-09-02'],['Jam Mulai (WIB)','09:00'],['Jam Selesai (WIB)','18:00'],['Radius GPS (meter)','80']])await dialog.getByLabel(label,{exact:true}).fill(value);
 await dialog.getByLabel('Cari lokasi di Google Maps').fill('Lokasi Baru');await dialog.getByRole('button',{name:'Gunakan Lokasi Perangkat'}).click();await dialog.getByText('Lokasi sudah dipilih').waitFor();
 await dialog.getByLabel('Kantor Cabang').selectOption('branch-1');await dialog.getByRole('button',{name:'Simpan Event',exact:true}).click();await dialog.waitFor({state:'hidden'});assert.equal(created.latitude,-6.9);assert.equal(created.start_time,'09:00');
 await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('tab',{name:'Overview',exact:true}).waitFor();assert.equal(await page.getByRole('tab',{name:'Kertas',exact:true}).count(),0);assert.equal(await page.getByRole('tab',{name:'Keuangan',exact:true}).count(),0);assert.equal(await page.getByRole('tab',{name:'Dokumentasi',exact:true}).count(),0);await page.screenshot({path:out+'/event-workspace-light.png',animations:'disabled'});
 await page.getByRole('tab',{name:'Crew',exact:true}).click();await page.getByLabel('Pilih crew event').selectOption('crew-1');await page.getByLabel('Posisi penugasan').fill('Fotografer');await page.getByRole('button',{name:'Tugaskan Crew'}).click();await page.getByRole('cell',{name:'PIC • Fotografer',exact:true}).waitFor();assert.ok(calls.some(c=>c.p.endsWith('/event-1/crew')&&c.body.crewId==='crew-1'));
 await page.getByRole('tab',{name:'Absensi',exact:true}).click();await page.getByText('Catatan pengujian masuk / Catatan pengujian pulang',{exact:true}).waitFor();
 await page.getByRole('tab',{name:'Payroll',exact:true}).click();await page.getByRole('cell',{name:'Rp80.000',exact:true}).first().waitFor();let eventPdf=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();await (await eventPdf).saveAs(out+'/event-qa.pdf');
 await nav('Payroll');await page.getByLabel('Periode payroll').fill('2026-09');await page.getByText('Aturan simulasi payroll',{exact:true}).click();await page.getByLabel('Potongan / jam (Rp)').fill('10000');await page.getByLabel('Bonus lembur / jam (Rp)').fill('10000');await page.getByRole('cell',{name:'Crew Event Uji',exact:true}).waitFor();
 await page.getByLabel('Cari payroll').fill('absent');assert.equal(await page.getByRole('button',{name:'Detail',exact:true}).count(),0);await page.getByLabel('Cari payroll').fill('');
 let downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export Excel',exact:true}).click();await (await downloadPromise).saveAs(out+'/payroll-qa.xlsx');
 downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export PDF',exact:true}).click();await (await downloadPromise).saveAs(out+'/payroll-qa.pdf');
 await page.screenshot({path:out+'/payroll-workspace-light.png',animations:'disabled'});
 await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('dialog').getByText('Tren lembur disetujui',{exact:true}).waitFor();await page.screenshot({path:out+'/payroll-detail-light.png',animations:'disabled'});await page.getByRole('button',{name:'Tutup dialog'}).click();
 await page.getByRole('button',{name:'Ubah ke tema gelap',exact:true}).click();await page.screenshot({path:out+'/payroll-workspace-dark.png',animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/payroll-workspace-mobile.png',animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
 assert.deepEqual(errors,[]);console.log('PASS admin UI: email, dashboard charts, event list/create/detail/assignment, notes, payroll filters/detail/Excel/PDF, dark theme and mobile. APIs mocked.');
}finally{await browser?.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e);process.exitCode=1;});
