const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-audit';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname;fs.readFile(path.resolve(__dirname,'../dist',p==='/'?'index.html':p.slice(1)),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':'text/html');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:await binary.executablePath(),args:binary.args}:{})});
 try {
  const page=await browser.newPage({viewport:{width:1365,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(10000);
  const user={id:'admin',full_name:'JAWARA',email:'admin@example.test'};
  const rows=[
   {id:'1',action:'ACCOUNT_ROLE_CHANGED',entity_type:'users',entity_name:'Gilang',new_data:{role:'HEAD_STORE',city:'Bandung'},old_data:{roles:['CREW_STORE']}},
   {id:'2',action:'PAYROLL_ADJUSTMENT',entity_type:'payroll',entity_name:'Selsa',new_data:{period:'2026-09-01'}},
   {id:'3',action:'STORE_SCHEDULE_RANGE_CREATED',entity_type:'store_schedules',entity_name:'Jadwal 5 karyawan',new_data:{startDate:'2026-09-01',endDate:'2026-09-30',crewCount:5,created:150,shiftNumber:2}},
   {id:'4',action:'CREW_PASSWORD_REVEAL_REQUEST',entity_type:'crew',entity_name:'Aila',new_data:{password:'SHOULD_NOT_RENDER'}},
  ].map(r=>({...r,created_at:'2026-09-26T18:50:00Z',actor_name:user.full_name,actor:user,actor_user_id:user.id}));
  await page.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===origin)return route.continue();let data=[];if(u.pathname==='/api/auth/login')data={token:'test',refreshToken:'test',user,role:'SUPER_ADMIN'};else if(u.pathname==='/api/users/me')data=user;else if(u.pathname==='/api/audit-logs')data=rows;else if(u.pathname==='/api/admin-directory')data={branches:[],stores:[],events:[]};await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});});
  await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Log in',exact:true}).click();await page.getByRole('button',{name:'Audit Log',exact:true}).click();
  const table=page.locator('table:visible');await table.getByText('Mengubah role akun',{exact:true}).waitFor();await table.getByText('Crew Store → Head Store · Bandung',{exact:true}).waitFor();assert.equal(await table.getByText(user.email,{exact:true}).count(),4);assert.equal(await page.getByText('SHOULD_NOT_RENDER',{exact:true}).count(),0);
  await table.getByText('Kode aktivitas',{exact:true}).first().click();await table.getByText('ACCOUNT_ROLE_CHANGED',{exact:true}).waitFor();
  await page.screenshot({path:out+'/audit-desktop.png'});
  const search=page.getByRole('textbox',{name:'Cari aktivitas audit'});await search.fill('Selsa');assert.equal(await table.locator('tbody tr').count(),1);await table.getByText('Periode: 2026-09',{exact:true}).waitFor();
  await search.fill('');await page.getByRole('combobox',{name:'Filter tindakan'}).selectOption('STORE_SCHEDULE_RANGE_CREATED');assert.equal(await table.locator('tbody tr').count(),1);await table.getByText('2026-09-01 → 2026-09-30 · Shift 2 · 5 karyawan · 150 jadwal',{exact:true}).waitFor();
  await page.getByRole('combobox',{name:'Filter tindakan'}).selectOption('');await page.setViewportSize({width:390,height:844});await page.screenshot({path:out+'/audit-mobile.png'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.locator('article:visible').count(),4);
  await search.fill('not-found');await page.getByText('Belum ada data yang sesuai.',{exact:true}).waitFor();await search.fill('');
  await page.getByRole('combobox',{name:'Bahasa aplikasi'}).selectOption('en');await page.locator('article:visible').getByText('Changed account role',{exact:true}).waitFor();assert.deepEqual(errors,[]);
  console.log('PASS audit: readable actions, role changes, period/range details, actor email, safe fields, technical code, search/filter, mobile, English.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
