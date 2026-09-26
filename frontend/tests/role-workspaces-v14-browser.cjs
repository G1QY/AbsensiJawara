const dbPath=require.resolve('../../backend/src/config/supabaseClient');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{}};
const {calculate:calculatePayroll,DEFAULT_POLICY}=require('../../backend/src/modules/payroll/payroll.service');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-v14';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;fs.readFile(path.resolve(__dirname,'../dist',p==='/'?'index.html':p.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()),month=today.slice(0,7);
 let currentRole='SUPER_ADMIN',division='',targetRole='CREW_STORE',targetDivision='',schedules=[],available=true;
 const user=()=>({id:id(1),full_name:'Personel Uji',email:'uji@example.test',division});
 const branches=[{id:id(10),code:'BDG',name:'Kantor Pusat',city_name:'Bandung'}];
 const crew=()=>({id:id(22),crew_type:targetRole==='CREW_EVENT'?'CREW_EVENT':'CREW_STORE',employee_code:'STAFF-2',status:'ACTIVE',division:targetDivision,company_name:'JAWARA',job_title:'',base_salary:2000000,branch_id:id(10),branch:branches[0],user:{id:id(2),full_name:'Staff Uji',email:'staff@example.test',phone_number:'',user_roles:[{role:{code:targetRole,name:targetRole}}]},store_assignments:[{id:id(3),status:'ACTIVE',start_date:'2026-01-01',end_date:null,store:{id:id(4),name:'Kantor Pusat',branch_id:id(10)}}],event_assignments:[]});
 const attendance={id:id(50),crew_id:id(22),attendance_date:today,check_in:today+'T02:00:00Z',check_out:today+'T11:00:00Z',status:'PRESENT',review_status:'PENDING',overtime_status:'NONE',late_minutes:0,overtime_minutes:0,crew:{employee_code:'STAFF-2',company_name:'JAWARA',job_title:'',user:{id:id(2),full_name:'Staff Uji',email:'staff@example.test',phone_number:'',user_roles:[{role:{code:'OFFICE_STAFF'}}]}},store_schedule:{schedule_date:today,start_time:'09:00:00',end_time:'18:00:00'},store_assignment:{store:{name:'Kantor Pusat',location_kind:'OFFICE',branch:branches[0]}},inPhoto:'https://photos.example.test/attendance/in.jpg',outPhoto:'https://photos.example.test/attendance/out.jpg'};
 const event={id:id(70),company_name:'JAWARA',event_name:'Event Selesai',event_code:'DONE-1',event_date:today,start_time:'09:00',end_time:'18:00',client_name:'Uji',status:'COMPLETED',pic:{user:{full_name:'Staff Uji'}},event_locations:[{address:'Bandung'}],event_assignments:[{id:id(71),crew_id:id(22),status:'ENDED',position:'PIC',crew:crew(),event_schedules:[]},{id:id(72),crew_id:id(23),status:'ENDED',position:'Crew',crew:{...crew(),id:id(23)},event_schedules:[]}]};
 await page.route('**/*',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname;if(u.origin===origin)return r.continue();if(!p.startsWith('/api/'))return r.abort();let data=[];
  if(req.method()!=='GET')writes.push({path:p,body:req.postDataJSON()});
  if(p==='/api/auth/login')data={token:'fixture',refreshToken:'fixture',user:user(),role:currentRole};
  else if(p==='/api/users/me')data=user();
  else if(p==='/api/admin-directory')data={branches,stores:[{id:id(4),code:'HQ',name:'Kantor Pusat',location_kind:'OFFICE',status:'ACTIVE',branch_id:id(10),latitude:0,longitude:0}],events:[]};
  else if(p==='/api/crew')data=[crew()];
  else if(p.endsWith('/reveal-password'))data=available?{available:true,password:'FixtureOnly42!'}:{available:false,message:'Belum tersedia.'};
  else if(p.endsWith('/reset-password')){available=true;data={};}
  else if(p.startsWith('/api/crew/'))data=crew();
  else if(p==='/api/accounts')data=[{...crew().user,is_active:true,head_store_scopes:[],crew:[crew()]}];
  else if(p.endsWith('/role')){const body=req.postDataJSON();targetRole=body.role;targetDivision=body.division;data={role:targetRole};}
  else if(p.startsWith('/api/admin-store-schedules/crew/'))data={assignment:{id:id(3),start_date:'2026-01-01',end_date:null,store:{name:'Kantor Pusat'}},schedules};
  else if(p==='/api/admin-store-schedules/holidays')data={holidays:[],warnings:[]};
  else if(p.startsWith('/api/admin-store-schedules')&&req.method()==='POST'){const body=req.postDataJSON();const row={id:id(6),schedule_date:body.scheduleDate||body.startDate,start_time:body.startTime,end_time:body.endTime,shift_number:body.shiftNumber,late_tolerance_minutes:body.lateToleranceMinutes,overtime_preapproved:body.overtimePreapproved};schedules=[row];data=p==='/api/admin-store-schedules'?row:{created:1,crewCount:1,skippedHoliday:0,skippedExisting:0,skippedEvent:0,skippedDay:0,skippedOverlap:0,schedules};}
  else if(p==='/api/admin-attendance')data={registered:[attendance],guest:[]};
  else if(p.endsWith('/review')){attendance.review_status=req.postDataJSON().decision;data={message:'Tersimpan'};}
  else if(p.startsWith('/api/admin-attendance/'))data=attendance;
  else if(p==='/api/admin-events')data=[event];
  else if(p==='/api/payroll'||p==='/api/payroll/me')data={month,revision:'a'.repeat(32),configured:true,policy:DEFAULT_POLICY,rows:calculatePayroll({policy:DEFAULT_POLICY,people:[{...crew(),full_name:'Staff Uji',role:targetRole,user_id:id(2),join_date:'2020-01-01'}]},month)};
  else if(p==='/api/admin-store-schedules/payroll-context')data={schedules:[],permissions:[]};
  else if(p==='/api/dashboard/revenue'){const[y,m]=month.split('-').map(Number);const months=Array.from({length:6},(_,i)=>({month:new Date(Date.UTC(y,m-6+i,1)).toISOString().slice(0,7),revenue:i===5?950000:0,recordedEvents:i===5?1:0,missingEvents:0,unfinishedEvents:0}));data={month,months,current:months[5],events:[{name:event.event_name,date:today,revenue:950000}]};}
  else if(p==='/api/head-store')data={city:'Bandung',from:today,to:today,branches,stores:[],crew:[],attendance:[]};
  else if(p==='/api/crew-store/workspace')data={crew:{...crew(),division},assignment:{id:id(3),store:{id:id(4),name:'Kantor Pusat',status:'ACTIVE',branch:branches[0]}},schedules:[{id:id(5),schedule_date:today,start_time:'09:00',end_time:'18:00',late_tolerance_minutes:0}],attendance:[{...attendance,review_status:'PENDING'}],permissions:[]};
  else if(p==='/api/attendance/today')data={crewId:id(22),date:today,hasSchedule:true,context:{type:'STORE',storeAssignmentId:id(3),storeScheduleId:id(5),scheduledStart:'09:00',scheduledEnd:'18:00',locationName:'Kantor Pusat'},attendance:null};
  else if(p==='/api/attendance/calendar')data={days:[],holidays:[],holidayDataAvailable:true};
  else if(p==='/api/attendance')data=[{...attendance,review_status:'PENDING'}];
  await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 const login=async()=>{await page.goto(origin);await page.locator('input[type=email]').fill('uji@example.test');await page.locator('input[type=password]').fill('fixture-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Log in',exact:true}).waitFor({state:'hidden'});await page.locator('aside').first().waitFor({state:'attached'});};
 const nav=async name=>{if(await page.getByRole('button',{name:'Buka menu',exact:true}).isVisible())await page.getByRole('button',{name:'Buka menu',exact:true}).click();await page.locator('aside:visible').getByRole('button',{name,exact:true}).click();};
 await login();await page.getByRole('button',{name:'Detail',exact:true}).click();let dialog=page.getByRole('dialog');
 assert.equal(await dialog.getByRole('button',{name:'Ubah role',exact:true}).count(),0);
 assert.equal(await dialog.getByRole('button',{name:'Tampilkan password',exact:true}).count(),0);
 assert.equal(await dialog.getByRole('button',{name:'Atur Password',exact:true}).count(),0);
 await dialog.getByRole('button',{name:'Tutup dialog'}).click();
 await nav('Akun & Hak Akses');await page.getByRole('button',{name:'Ubah role',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');
 await dialog.getByLabel('Role akun',{exact:true}).selectOption('HEAD_OFFICE');await dialog.getByLabel('Divisi',{exact:true}).selectOption('Finance');await dialog.getByRole('button',{name:'Simpan role'}).click();await dialog.waitFor({state:'hidden'});assert.equal(writes.at(-1).body.division,'Finance');
 await page.getByRole('button',{name:'Password akun',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');assert.equal(writes.filter(w=>w.path.endsWith('/reveal-password')).length,0);
 await dialog.getByRole('button',{name:'Tampilkan password',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label="Password akun"]')?.value==='FixtureOnly42!');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await dialog.getByLabel('Password akun',{exact:true}).inputValue(),'••••••••');
 available=false;await dialog.getByRole('button',{name:'Tampilkan password',exact:true}).click();await dialog.getByText('Belum tersedia.',{exact:false}).waitFor();
 await dialog.getByRole('button',{name:'Atur Password',exact:true}).click();await dialog.getByLabel('Password baru',{exact:true}).fill('FixtureResetOnly42!');await dialog.getByRole('button',{name:'Simpan password baru',exact:true}).click();await dialog.getByText('Password baru tersimpan.',{exact:false}).waitFor();assert.equal(writes.at(-1).body.newPassword,'FixtureResetOnly42!');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/password-account-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
 await dialog.getByRole('button',{name:'Tutup dialog'}).click();await page.getByRole('button',{name:'Password akun',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('Password akun',{exact:true}).inputValue(),'••••••••');await dialog.getByRole('button',{name:'Tutup dialog'}).click();await page.screenshot({path:out+'/accounts-mobile.png'});
 for(const [role,title,d]of [['HEAD_OFFICE','Ringkasan Head Office','Finance'],['OFFICE_STAFF','Agenda Kantor','Marketing'],['PRODUCTION_STAFF','Shift Produksi','Packing']]){
  currentRole=role;division=d;await page.setViewportSize({width:1365,height:900});await login();await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.getByRole('heading',{name:'Pekerjaan Saya',exact:true}).waitFor();await page.screenshot({path:out+'/'+role.toLowerCase()+'.png',fullPage:true});
  assert.equal(await page.getByRole('button',{name:'Kelola Crew',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Akun & Hak Akses',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Payroll',exact:true}).count(),0);
  await nav('Absensi Saya');await page.getByRole('button',{name:'Clock In Sekarang',exact:true}).waitFor();await nav('Riwayat Saya');await page.getByText('Menunggu admin',{exact:true}).first().waitFor();
  await page.setViewportSize({width:390,height:844});await nav('Dashboard');await page.getByRole('heading',{name:title,exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/'+role.toLowerCase()+'-mobile.png',fullPage:true});
 }
 currentRole='EVENT_MANAGER';targetRole='CREW_EVENT';division='';await page.setViewportSize({width:1365,height:900});await login();await page.locator('main').getByRole('heading',{name:'Dashboard Event',exact:true}).waitFor();await page.getByRole('heading',{name:'Agenda Event',exact:true}).waitFor();
 for(const name of ['Kelola Crew','Audit Log','Laporan','Akun & Hak Akses','Payroll'])assert.equal(await page.locator('aside:visible').getByRole('button',{name,exact:true}).count(),0,name);
 await page.getByRole('group',{name:'Status Event Bulan Ini',exact:true}).getByRole('button').filter({hasText:'Selesai'}).click();await page.getByText(today+' · Event Selesai',{exact:true}).waitFor();await page.screenshot({path:out+'/event-manager-desktop.png',fullPage:true});
 await nav('Crew Event');await page.getByRole('heading',{name:'Staff Uji',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'+ Tambah Crew',exact:true}).count(),0);assert.equal(await page.getByText('Rp2.000.000',{exact:true}).count(),0);
 await nav('Rekap Event');await page.getByText('2 crew · PIC: Staff Uji',{exact:true}).waitFor();
 await nav('Kelola Event');await page.getByRole('row').filter({hasText:'Event Selesai'}).waitFor();
 await nav('Absensi Event');await page.locator('main').getByRole('heading',{name:'Absensi Event',exact:true}).waitFor();
 await nav('Absensi Saya');await page.getByRole('button',{name:'Clock In Sekarang',exact:true}).waitFor();
 await page.setViewportSize({width:390,height:844});await nav('Dashboard Event');await page.getByRole('heading',{name:'Agenda Event',exact:true}).waitFor();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/event-manager-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS V14: event-only workspace and navigation, role-specific staff dashboards, unchanged Finance permissions, account role/division/password controls moved out of crew details, password reset/reveal/hide, desktop and mobile.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
