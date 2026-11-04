// Local fixture-only browser test. No production login or database mutations.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const out=process.env.QA_OUTPUT_DIR||path.resolve(__dirname,'../../.temp/shift-break-qa');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;fs.readFile(path.resolve(__dirname,'../dist',p==='/'?'index.html':p.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try {
    const context=await browser.newContext({viewport:{width:1365,height:900},permissions:['geolocation','camera'],geolocation:{latitude:-7.7956,longitude:110.3695,accuracy:20}});
    const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
    let role='SUPER_ADMIN',attendance=null,addressFailure=false;const permissions=[];
    await page.addInitScript(()=>{window.watermarkText=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y){window.watermarkText.push({text,x,y,width:this.canvas.width,height:this.canvas.height,measured:this.measureText(text).width,font:this.font});return original.call(this,text,x,y);};});
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date());
    const branch={id:id(10),code:'BDG',name:'Bandung',city_name:'Bandung'};
    const stores=[{id:id(11),code:'SHOP',name:'Store Bandung',branch_id:branch.id,location_kind:'STORE',status:'ACTIVE'},{id:id(12),code:'HQ',name:'Kantor Bandung',branch_id:branch.id,location_kind:'OFFICE',status:'ACTIVE'}];
    const crew={id:id(2),user_id:id(3),crew_type:'CREW_STORE',assignment_kind:'STORE',attendance_location_mode:'ASSIGNED',employee_code:'CREW-1',company_name:'Jawara',job_title:'Supervisor',base_salary:0,status:'ACTIVE',branch_id:branch.id,branch,
      avatarUrl:'https://photos.example.test/profile.png',user:{id:id(3),full_name:'Diaz Uji',email:'diaz@example.test',phone_number:'081234567890',user_roles:[{role:{code:'CREW_STORE',name:'Crew Store'}}]},
      store_assignments:[{id:id(4),status:'ACTIVE',start_date:'2026-01-01',end_date:null,store:stores[0]}],event_assignments:[]};
    const user=()=>role==='SUPER_ADMIN'?{id:id(1),full_name:'Admin Uji',email:'admin@example.test'}:crew.user;
    await page.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url()),p=url.pathname;
      if(url.origin===origin)return route.continue();
      if(url.hostname==='photos.example.test')return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aS1sAAAAASUVORK5CYII=','base64')});
      if(!p.startsWith('/api/'))return route.abort();
      let data=[];
      if(p==='/api/auth/login')data={token:'fixture',refreshToken:'fixture',user:user(),role};
      else if(p==='/api/users/me')data=user();
      else if(p==='/api/admin-attendance')data={registered:[],guest:[]};
      else if(p==='/api/admin-directory')data={branches:[branch],stores,events:[]};
      else if(p==='/api/crew')data=[crew];
      else if(p==='/api/crew/'+crew.id){
        if(req.method()==='PATCH'){
          const b=req.postDataJSON();writes.push(b);crew.assignment_kind=b.assignmentKind;crew.crew_type=b.crewType;crew.attendance_location_mode=b.attendanceLocationMode;
          crew.store_assignments=[{...crew.store_assignments[0],store:stores.find(s=>s.id===b.assignTo)}];
        }
        data=crew;
      }
      else if(p==='/api/crew-store/workspace')data={crew,assignment:{id:id(4),store:{...crew.store_assignments[0].store,branch}},schedules:[],attendance:[],permissions:[]};
      else if(p==='/api/attendance/today')data={crewId:crew.id,locationMode:crew.attendance_location_mode,hasSchedule:true,context:{type:'STORE',storeAssignmentId:id(4),storeScheduleId:id(5),scheduledStart:'09:00',scheduledEnd:'18:00',locationName:'Kantor Bandung',breakStart:'09:00',breakEnd:'10:00',breakOpensAt:'2020-01-01T02:00:00Z'},attendance};
      else if(p.startsWith('/api/admin-store-schedules/crew/'))data={assignment:{id:id(4),start_date:'2026-01-01',end_date:null,store:stores[0]},schedules:[]};
      else if(p==='/api/admin-store-schedules/range'||p==='/api/admin-store-schedules/day-status'){
        writes.push({p,body:req.postDataJSON()});data=p.endsWith('day-status')?{updated:1}:{created:1,inserted:1,skippedHoliday:0,skippedExisting:0,skippedEvent:0,skippedDay:0};
      }
      else if(p==='/api/permissions'){
        if(req.method()==='POST'){const body=req.postDataJSON();writes.push({p,body});permissions.push({id:id(75),type:body.type,start_date:body.startDate,end_date:body.endDate,reason:body.reason,status:'PENDING',admin_managed:false,crew:{user:{full_name:crew.user.full_name}}});data={id:id(75),status:'PENDING'};}
        else data=url.searchParams.has('status')?permissions.filter(p=>p.status==='PENDING'):permissions;
      }
      else if(p.startsWith('/api/permissions/')){writes.push({p,body:req.postDataJSON()});permissions.find(p=>p.id===id(75)).status=req.postDataJSON().decision;data={};}
      else if(p.includes('/break/')){
        const body=req.postDataBuffer(),start=body.indexOf(Buffer.from([255,216,255])),end=body.indexOf(Buffer.from([255,217]),start);
        assert.ok(start>0&&end>start);fs.writeFileSync(path.join(out,p.endsWith('/start')?'break-start.jpg':'break-end.jpg'),body.subarray(start,end+2));
        assert.match(body.toString('latin1'),/name="latitude"\r\n\r\n-7\.7956/);
        writes.push({p});attendance={...attendance,[p.endsWith('/start')?'break_started_at':'break_ended_at']:new Date().toISOString()};data=attendance;
      }
      else if(p==='/api/attendance/location'){
        assert.deepEqual(req.postDataJSON(),{latitude:-7.7956,longitude:110.3695});
        if(addressFailure)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Layanan alamat belum tersedia.'})});
        // Geocoder point differs from device GPS; it must never replace the photo/submission point.
        data={results:[{address:'Jalan Malioboro, Yogyakarta, Daerah Istimewa Yogyakarta, Indonesia',latitude:-7.792,longitude:110.365,street:'Jalan Malioboro',source:'OpenStreetMap',attribution:'© OpenStreetMap contributors'}]};
      }
      else if(p==='/api/attendance/calendar')data={days:[],holidays:[],holidayDataAvailable:true};
      else if(p==='/api/attendance/check-in'||p.endsWith('/check-out')){
        const body=req.postDataBuffer();const start=body.indexOf(Buffer.from([255,216,255]));const end=body.indexOf(Buffer.from([255,217]),start);assert.ok(start>0&&end>start);fs.writeFileSync(path.join(out,p.endsWith('/check-out')?'crew-checkout-watermark.jpg':'crew-checkin-watermark.jpg'),body.subarray(start,end+2));const payload=body.toString('latin1');assert.match(payload,/name="latitude"\r\n\r\n-7\.7956/);assert.match(payload,/name="longitude"\r\n\r\n110\.3695/);assert.match(payload,/filename="check(in|out)\.jpg"/);
        writes.push({attendance:p});
        attendance={id:id(50),check_in:new Date().toISOString(),check_out:null,status:'PRESENT',review_status:'PENDING',late_minutes:0,overtime_minutes:0,overtime_status:'NONE',...attendance,...(p.endsWith('/check-out')?{check_out:new Date().toISOString()}:{} )};data=attendance;
      }
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    const login=async()=>{await page.goto(origin);await page.locator('input[type=email]').fill(user().email);await page.locator('input[type=password]').fill('fixture-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Log in',exact:true}).waitFor({state:'hidden'});await page.getByRole('button',{name:'Dashboard',exact:true}).first().waitFor({state:'attached'});};
    const nav=async name=>{const menu=page.getByRole('button',{name:'Buka menu',exact:true});if(await menu.isVisible()){await menu.click();await page.locator('aside.translate-x-0').getByRole('button',{name,exact:true}).click();}else await page.locator('aside:visible').getByRole('button',{name,exact:true}).click();};
    const edit=async()=>{await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();return page.getByRole('dialog');};

    await page.goto(origin);await page.screenshot({path:path.join(out,'login-desktop.png'),fullPage:true});
    await page.setViewportSize({width:1365,height:645});await page.screenshot({path:path.join(out,'login-desktop-short.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'login-mobile.png'),fullPage:true});
    await page.setViewportSize({width:1365,height:900});await login();await nav('Kelola Crew');
    await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Atur Jadwal Kerja',exact:true}).click();
    let dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Buat jadwal',exact:true}).click();
    await dialog.getByLabel('Tanggal mulai',{exact:true}).fill('2026-12-25');await dialog.getByLabel('Tanggal selesai',{exact:true}).fill('2026-12-25');
    await dialog.getByLabel('Jam masuk',{exact:true}).fill('07:00');await dialog.getByLabel('Jam pulang',{exact:true}).fill('12:00');
    await dialog.getByLabel('Aktifkan istirahat pada shift ini').check();await dialog.getByLabel('Mulai istirahat',{exact:true}).fill('09:00');await dialog.getByLabel('Selesai istirahat',{exact:true}).fill('10:00');
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'admin-break-mobile.png'),fullPage:true});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await dialog.getByRole('button',{name:'Buat Jadwal Rentang',exact:true}).click();await page.waitForFunction(()=>!document.querySelector('[aria-label="Mulai istirahat"]'));
    const saved=writes.find(w=>w.p==='/api/admin-store-schedules/range').body;assert.equal(saved.breakStartTime,'09:00');assert.equal(saved.breakEndTime,'10:00');assert.equal(saved.shiftNumber,1);
    await dialog.getByRole('button',{name:'Libur & izin',exact:true}).click();await dialog.getByRole('radio',{name:'Sakit',exact:true}).check();
    await dialog.getByLabel('Tanggal mulai',{exact:true}).fill('2026-12-26');await dialog.getByLabel('Tanggal selesai',{exact:true}).fill('2026-12-26');await dialog.getByLabel('Keterangan',{exact:true}).fill('Sakit dikonfirmasi crew');
    await dialog.getByRole('button',{name:'Simpan status hari',exact:true}).click();await page.waitForTimeout(250);assert.equal(writes.find(w=>w.p?.endsWith('/day-status')).body.type,'SICK');
    role='CREW_STORE';crew.attendance_location_mode='ANYWHERE';attendance={id:id(50),check_in:new Date().toISOString(),check_out:null,status:'PRESENT',review_status:'PENDING',late_minutes:0,overtime_minutes:0,overtime_status:'NONE'};
    await login();await nav('Absensi');const rest=page.getByRole('region',{name:'Istirahat shift'});await rest.waitFor();
    await rest.getByRole('button',{name:'Mulai istirahat · ambil foto',exact:true}).click();await rest.getByRole('button',{name:'Ambil foto',exact:true}).click();
    await rest.getByText('Sedang istirahat',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Clock Out Sekarang'}).isDisabled(),true);
    await page.screenshot({path:path.join(out,'crew-break-mobile.png'),fullPage:true});
    await rest.getByRole('button',{name:'Selesai istirahat · ambil foto',exact:true}).click();await rest.getByRole('button',{name:'Ambil foto',exact:true}).click();await rest.getByText('Sudah selesai',{exact:true}).waitFor();
    assert.equal(await page.getByRole('button',{name:'Clock Out Sekarang'}).isDisabled(),false);
    const watermark=await page.evaluate(()=>window.watermarkText.map(r=>r.text).join(' '));assert.match(watermark,/Mulai istirahat/);assert.match(watermark,/Selesai istirahat/);assert.match(watermark,/Yogyakarta/);
    await page.getByRole('button',{name:'Ajukan izin / sakit',exact:true}).click();const request=page.getByRole('region',{name:'Izin dan sakit saya'});
    await request.getByLabel('Jenis pengajuan').selectOption('SICK');await request.getByLabel('Tanggal mulai',{exact:true}).fill('2026-12-27');await request.getByLabel('Tanggal selesai',{exact:true}).fill('2026-12-27');await request.getByLabel('Alasan pengajuan').fill('Istirahat sesuai anjuran dokter');await request.getByRole('button',{name:'Kirim pengajuan'}).click();
    await request.getByText('Menunggu persetujuan',{exact:true}).waitFor();assert.equal(permissions[0].type,'SICK');await page.screenshot({path:path.join(out,'crew-permission-mobile.png'),fullPage:true});
    role='SUPER_ADMIN';await page.setViewportSize({width:1365,height:900});await login();await nav('Absensi');const inbox=page.getByRole('region',{name:'Pengajuan izin dan sakit'});await inbox.getByText('Istirahat sesuai anjuran dokter').waitFor();await page.screenshot({path:path.join(out,'admin-permission-desktop.png'),fullPage:true});await inbox.getByRole('button',{name:'Setujui',exact:true}).click();await inbox.getByText('Tidak ada pengajuan yang menunggu tinjauan.').waitFor();assert.equal(permissions[0].status,'APPROVED');
    assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'passed',screenshots:out,writes:writes.length}));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
