const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-accounts';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;fs.readFile(path.resolve(__dirname,'../dist',p==='/'?'index.html':p.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args}:{})});
 try{
 const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);let currentRole='SUPER_ADMIN';
 const user={id:id(1),full_name:'Super Uji',email:'super@example.test'};
 const branches=[{id:id(10),name:'Pasir Kaliki',city_name:'Bandung'},{id:id(11),name:'Kosambi',city_name:'Bandung'},{id:id(12),name:'Blok M',city_name:'Jakarta'}];
 const account=(n,name,role,archived=false)=>({id:id(n),full_name:name,email:name.toLowerCase()+'@example.test',is_active:!archived,user_roles:[{role:{code:role,name:role}}],head_store_scopes:[],crew:[{id:id(n+20),crew_type:'CREW_STORE',status:archived?'INACTIVE':'ACTIVE',deleted_at:archived?'2026-09-01':null}]});
 let available=true;
 let accounts=[{...account(1,'Super','SUPER_ADMIN'),crew:[]},account(2,'CrewUji','CREW_STORE'),account(3,'ArsipUji','CREW_STORE',true)];
 const attendance=[{id:id(50),attendance_date:'2026-09-18',status:'PRESENT',check_in:'2026-09-18T02:00:00Z',check_out:'2026-09-18T11:00:00Z',late_minutes:0,overtime_status:'APPROVED',overtime_minutes:60,store_schedule:{start_time:'09:00:00',end_time:'17:00:00',late_tolerance_minutes:0},crew:{company_name:'JAWARA',job_title:'Crew',user:{full_name:'TepatUji'}}},{id:id(51),attendance_date:'2026-09-18',status:'LATE',check_in:'2026-09-18T06:31:19Z',check_out:'2026-09-18T06:31:27Z',late_minutes:2,overtime_status:'NONE',overtime_minutes:0,store_schedule:{start_time:'13:30:00',end_time:'13:45:00'},crew:{user:{full_name:'TelatUji'}}}];
 const crewRow=()=>({id:id(22),user_id:id(2),employee_code:'BDG-S1-1',crew_type:'CREW_STORE',status:'ACTIVE',base_salary:0,branch_id:id(10),branch:branches[0],user:{...accounts[1],phone_number:'',head_store_scopes:accounts[1].head_store_scopes},store_assignments:[],event_assignments:[]});
 await page.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname;if(u.origin===origin)return r.continue();if(!p.startsWith('/api/'))return r.abort();let data=[];if(req.method()!=='GET')writes.push({path:p,method:req.method(),body:req.postDataJSON()});
 if(p==='/api/auth/login')data={token:'fixture',refreshToken:'fixture',user,role:currentRole};
 else if(p==='/api/users/me')data=user;
 else if(p==='/api/admin-directory')data={branches,stores:[],events:[]};
 else if(p==='/api/accounts')data=accounts;
 else if(p.startsWith('/api/accounts/')&&req.method()==='PATCH'){const body=req.postDataJSON();accounts[1].user_roles=[{role:{code:body.role,name:body.role}}];accounts[1].head_store_scopes=[{city_name:'Bandung'}];data={role:body.role};}
 else if(p.startsWith('/api/crew/')&&req.method()==='DELETE'){accounts=accounts.filter(a=>a.crew[0]?.id!==p.split('/').pop());data={message:'deleted'};}
 else if(p==='/api/crew')data=[crewRow()];
 else if(p.endsWith('/reveal-password'))data=available?{available:true,password:'FixtureOnly42!'}:{available:false,message:'Belum tersedia. Password lama tidak memiliki salinan.'};
 else if(p.startsWith('/api/crew/')&&req.method()==='GET')data=crewRow();
 else if(p.startsWith('/api/crew/')&&req.method()==='PATCH')data={id:id(22)};
 else if(p==='/api/reports/attendance')data=attendance;
 else if(p==='/api/head-store')data={city:'Bandung',from:'2026-09-18',to:'2026-09-18',branches:branches.slice(0,2),stores:[{id:id(30),branch_id:id(10),name:'Store Braga',status:'ACTIVE',location_kind:'STORE'},{id:id(31),branch_id:id(11),name:'Store Kosambi',status:'ACTIVE',location_kind:'STORE'}],crew:[{id:id(21),full_name:'Crew Bandung',branch_id:id(10),status:'ACTIVE',company_name:'JAWARA',job_title:'Crew',stores:[{id:id(30),name:'Store Braga',branch_id:id(10)}]}],attendance:attendance.map(a=>({...a,full_name:a.crew.user.full_name,branch_id:id(10),store_name:'Store Braga',start_time:a.store_schedule.start_time,end_time:a.store_schedule.end_time}))};
 await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
 const login=async()=>{await page.goto(origin);await page.locator('input[type=email]').waitFor({timeout:8000}).catch(async e=>{console.error({errors,body:await page.locator('body').innerText()});throw e;});await page.locator('input[type=email]').fill('test@example.test');await page.locator('input[type=password]').fill('testing-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Log in',exact:true}).waitFor({state:'hidden'});await page.locator('aside').first().waitFor({state:'attached'});};
 const nav=async name=>{if(await page.getByRole('button',{name:'Buka menu',exact:true}).isVisible())await page.getByRole('button',{name:'Buka menu',exact:true}).click();await page.locator('aside:visible').getByRole('button',{name,exact:true}).click();};
 await login();await nav('Kelola Crew');await page.getByRole('button',{name:'Detail',exact:true}).click();let dialog=page.getByRole('dialog');assert.equal(await dialog.getByRole('button',{name:'Tampilkan password'}).count(),0);await dialog.getByRole('button',{name:'Tutup dialog'}).click();
 await nav('Akun & Hak Akses');await page.getByRole('button',{name:'Password akun',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');
 assert.equal(writes.filter(w=>w.path.endsWith('/reveal-password')).length,0);
 await dialog.getByRole('button',{name:'Tampilkan password',exact:true}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label="Password akun"]')?.value==='FixtureOnly42!');
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));assert.equal(await dialog.getByLabel('Password akun',{exact:true}).inputValue(),'••••••••');
 available=false;await dialog.getByRole('button',{name:'Tampilkan password',exact:true}).click();await dialog.getByText('Belum tersedia.',{exact:false}).waitFor();available=true;
 await dialog.getByRole('button',{name:'Tutup dialog'}).click();await page.getByRole('row').filter({hasText:'CrewUji'}).getByRole('button',{name:'Ubah role',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Role akun',{exact:true}).selectOption('HEAD_STORE');await dialog.getByLabel('Kota cakupan').selectOption({label:'Bandung'});await dialog.getByRole('button',{name:'Simpan role'}).click();await dialog.waitFor({state:'hidden'});
 assert.deepEqual(writes.filter(w=>w.path.endsWith('/role')).at(-1).body,{role:'HEAD_STORE',branchId:id(11),division:''});
 await nav('Kelola Crew');await page.getByRole('button',{name:'Detail',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Edit',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Edit Crew'}).waitFor();assert.equal(await dialog.locator('select').first().isDisabled(),true);await dialog.getByRole('button',{name:'Simpan Crew',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await nav('Akun & Hak Akses');await page.getByRole('row').filter({hasText:'CrewUji'}).getByRole('button',{name:'Ubah role',exact:true}).click();dialog=page.getByRole('dialog');await dialog.getByLabel('Role akun',{exact:true}).selectOption('EVENT_MANAGER');await dialog.getByRole('button',{name:'Simpan role'}).click();await dialog.waitFor({state:'hidden'});
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Password akun',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:out+'/password-mobile.png'});
 await dialog.getByRole('button',{name:'Tampilkan password'}).click();await page.waitForFunction(()=>document.querySelector('input[aria-label="Password akun"]')?.value==='FixtureOnly42!');await dialog.getByRole('button',{name:'Tutup dialog'}).click();await page.getByRole('button',{name:'Password akun',exact:true}).filter({visible:true}).click();dialog=page.getByRole('dialog');assert.equal(await dialog.getByLabel('Password akun',{exact:true}).inputValue(),'••••••••');
 await page.setViewportSize({width:1365,height:900});currentRole='EVENT_MANAGER';await login();assert.equal(await page.getByRole('button',{name:'Akun & Hak Akses',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Kelola Crew',exact:true}).count(),0);assert.equal(await page.getByRole('button',{name:'Tampilkan password'}).count(),0);
 assert.deepEqual(errors,[]);console.log('PASS: password reveal on demand in Accounts, hide on blur/close, unavailable password, Super Admin only, Head Store/Event Manager role changes, profile edits preserve role, mobile layout.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
