// Local fixture-only browser test. No production login or database mutations.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const out=process.env.QA_OUTPUT_DIR||path.resolve(__dirname,'../../.temp/crew-location-qa');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;fs.readFile(path.resolve(__dirname,'../dist',p==='/'?'index.html':p.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  try {
    const context=await browser.newContext({viewport:{width:1365,height:900},permissions:['geolocation','camera'],geolocation:{latitude:-7.7956,longitude:110.3695,accuracy:20}});
    const page=await context.newPage(),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(15000);
    let role='SUPER_ADMIN',attendance=null,addressFailure=false;
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
      else if(p==='/api/attendance/today')data={crewId:crew.id,locationMode:crew.attendance_location_mode,hasSchedule:true,context:{type:'STORE',storeAssignmentId:id(4),storeScheduleId:id(5),scheduledStart:'09:00',scheduledEnd:'18:00',locationName:'Kantor Bandung'},attendance};
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
    const login=async()=>{await page.goto(origin);await page.locator('input[type=email]').fill(user().email);await page.locator('input[type=password]').fill('fixture-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Log in',exact:true}).waitFor({state:'hidden'});await page.getByText(/Selamat datang,/).waitFor();};
    const nav=async name=>{const menu=page.getByRole('button',{name:'Buka menu',exact:true});if(await menu.isVisible()){await menu.click();await page.locator('aside.translate-x-0').getByRole('button',{name,exact:true}).click();}else await page.locator('aside:visible').getByRole('button',{name,exact:true}).click();};
    const edit=async()=>{await page.getByRole('button',{name:'Detail',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Edit',exact:true}).click();return page.getByRole('dialog');};
    await login();await nav('Kelola Crew');
    const avatar=page.getByRole('img',{name:'Foto profil Diaz Uji'});await avatar.waitFor();await page.waitForFunction(()=>document.querySelector('img[alt="Foto profil Diaz Uji"]')?.naturalWidth>0);
    await page.screenshot({path:path.join(out,'crew-list-desktop.png')});
    let dialog=await edit();await dialog.getByLabel('Jenis Crew',{exact:true}).selectOption('OFFICE');
    assert.equal(await dialog.getByLabel('Store / Kantor Penugasan').getByRole('option',{name:'Store Bandung',exact:true}).count(),0);
    await dialog.getByLabel('Store / Kantor Penugasan').selectOption(id(12));await dialog.getByLabel('Lokasi absensi',{exact:true}).selectOption('ANYWHERE');
    await page.screenshot({path:path.join(out,'crew-office-desktop.png')});
    await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'crew-office-mobile.png')});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await dialog.getByRole('button',{name:'Simpan Crew',exact:true}).click();await dialog.waitFor({state:'hidden'});
    assert.equal(writes[0].crewType,'CREW_STORE');assert.equal(writes[0].assignmentKind,'OFFICE');assert.equal(writes[0].attendanceLocationMode,'ANYWHERE');
    await page.screenshot({path:path.join(out,'crew-list-mobile.png')});
    const card=page.getByRole('article',{name:'Diaz Uji'});await card.waitFor();
    assert.equal(await card.getByRole('img',{name:'Foto profil Diaz Uji'}).count(),1);
    await card.getByText('Semua lokasi — GPS tetap dicatat',{exact:true}).waitFor();await card.screenshot({path:path.join(out,'crew-card-mobile.png')});
    dialog=await edit();assert.equal(await dialog.getByLabel('Jenis Crew',{exact:true}).inputValue(),'OFFICE');assert.equal(await dialog.getByLabel('Lokasi absensi',{exact:true}).inputValue(),'ANYWHERE');
    role='OFFICE_STAFF';await login();await nav('Absensi Saya');
    await page.getByText('Absensi semua lokasi aktif.',{exact:false}).waitFor();await page.screenshot({path:path.join(out,'attendance-mobile.png')});
    await page.getByRole('button',{name:'Clock In Sekarang',exact:true}).click();
    // A denied GPS permission must not upload a photo; retry stays usable.
    await context.clearPermissions();await context.grantPermissions(['camera']);
    await page.getByRole('button',{name:'Ambil foto',exact:true}).click();
    await page.getByRole('alert').getByText(/Izin lokasi ditolak/).waitFor();
    assert.equal(writes.filter(w=>w.attendance).length,0);
    await context.grantPermissions(['camera','geolocation']);
    await page.getByRole('button',{name:'Ambil foto',exact:true}).click();
    await page.getByRole('heading',{name:'Hasil Clock In',exact:true}).waitFor();const watermark=await page.evaluate(()=>window.watermarkText);
    const text=watermark.map(r=>r.text).join('');
    assert.match(text,/Lokasi GPS: Jalan Malioboro/);assert.match(text,/GPS saat foto: -7.795600, 110.369500/);assert.match(text,/Penugasan: Kantor Bandung/);assert.doesNotMatch(text,/OpenStreetMap contributors/);
    assert.ok(watermark.every(r=>r.x>=0&&r.x+r.measured<=r.width&&r.y>=0&&r.y+parseFloat(r.font.match(/(\d+)px/)[1])<=r.height));
    await page.getByRole('button',{name:/Lanjut Bekerja/}).click();
    // Reload clears the client cache so the next photo exercises provider failure.
    addressFailure=true;await login();await nav('Absensi Saya');
    await page.getByRole('button',{name:'Clock Out Sekarang',exact:true}).click();await page.getByRole('button',{name:'Ambil foto',exact:true}).click();
    await page.getByRole('heading',{name:'Hasil Clock Out',exact:true}).waitFor();
    const fallback=await page.evaluate(()=>window.watermarkText.map(r=>r.text).join(''));
    assert.match(fallback,/Lokasi GPS: Alamat belum tersedia/);assert.match(fallback,/-7.795600, 110.369500/);assert.doesNotMatch(fallback,/Malioboro/);
    assert.equal(writes.filter(w=>w.attendance).length,2);assert.deepEqual(errors,[]);
    console.log('PASS: list avatar, office filtering/persistence, ANYWHERE persistence, desktop/mobile layout, live camera and GPS clock in/out.');
  } finally {await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
