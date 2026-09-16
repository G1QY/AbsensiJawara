const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist'),out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-dashboard-qa';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;fs.readFile(path.join(root,p==='/'?'index.html':p),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:980}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta'}).format(new Date()),month=today.slice(0,7);
  const user={id:'admin-1',full_name:'Admin Uji',email:'admin@example.test'},crew={id:'crew-1',status:'ACTIVE',crew_type:'CREW_EVENT',base_salary:100000,company_name:'JAWARA',job_title:'Fotografer',user:{full_name:'Crew Uji',email:'crew@example.test'},store_assignments:[],event_assignments:[]};
  let amount=900000,failed=false;
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(!url.pathname.startsWith('/api/'))return route.abort();let data=[];
   if(url.pathname==='/api/auth/login')data={token:'test',refreshToken:'test',user,role:'SUPER_ADMIN'};
   else if(url.pathname==='/api/users/me')data=user;
   else if(url.pathname==='/api/admin-directory')data={branches:[],stores:[],events:[]};
   else if(url.pathname==='/api/crew')data=[crew];
   else if(url.pathname==='/api/admin-attendance')data={registered:[{id:'a',crew_id:crew.id,attendance_date:today,check_in:today+'T01:00:00Z',check_out:today+'T10:00:00Z',status:'PRESENT',review_status:'APPROVED',overtime_status:'NONE',late_minutes:0,overtime_minutes:0}],guest:[]};
   else if(url.pathname==='/api/admin-store-schedules/payroll-context')data={schedules:[],permissions:[]};
   else if(url.pathname==='/api/dashboard/revenue'){
    if(failed)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Omzet event belum dapat dimuat.'})});
    const [y,m]=month.split('-').map(Number);const months=Array.from({length:6},(_,i)=>({month:new Date(Date.UTC(y,m-6+i,1)).toISOString().slice(0,7),revenue:i===5?amount:0,recordedEvents:i===5?1:0,missingEvents:0,unfinishedEvents:0}));data={month,months,current:months[5]};
   }
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.locator('aside').getByRole('button',{name:'Dashboard',exact:true}).click();
  const card=label=>page.getByText(label,{exact:true}).locator('..');
  await card('Omzet Event Bulan Ini').getByText('Rp900.000',{exact:true}).waitFor();
  assert.ok((await card('Estimasi Payroll Bulan Ini').innerText()).includes('Rp100.000'));
  await page.getByRole('img',{name:/Omzet Event per Bulan:.*900.000/}).waitFor();
  assert.equal(await page.getByText('Payroll Final',{exact:true}).count(),0);
  await page.locator('aside').getByRole('button',{name:'Payroll',exact:true}).click();await card('Total Estimasi Payroll').getByText('Rp100.000',{exact:true}).waitFor();
  await page.locator('aside').getByRole('button',{name:'Dashboard',exact:true}).click();await card('Omzet Event Bulan Ini').getByText('Rp900.000',{exact:true}).waitFor();
  amount=1250000;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await card('Omzet Event Bulan Ini').getByText('Rp1.250.000',{exact:true}).waitFor();
  await page.screenshot({path:out+'/dashboard-desktop.png',fullPage:true});await page.setViewportSize({width:375,height:812});await page.screenshot({path:out+'/dashboard-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.getByRole('combobox',{name:'Bahasa aplikasi'}).selectOption('en');await card('Event Revenue This Month').waitFor();await page.getByRole('button',{name:'Open profile menu'}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('heading',{name:'App language',exact:true}).waitFor();await page.getByRole('combobox',{name:'App language'}).last().selectOption('id');await page.getByRole('heading',{name:'Bahasa aplikasi',exact:true}).waitFor();await page.setViewportSize({width:1365,height:980});await page.locator('aside').getByRole('button',{name:'Dashboard',exact:true}).click();await card('Omzet Event Bulan Ini').getByText('Rp1.250.000',{exact:true}).waitFor();
  failed=true;await page.getByRole('button',{name:'Muat ulang',exact:true}).click();await page.getByRole('alert').getByText('Omzet event belum dapat dimuat.',{exact:true}).waitFor();assert.equal(await page.getByText('Rp1.250.000',{exact:true}).count(),0);assert.deepEqual(errors,[]);
  console.log('PASS dashboard: live revenue, chart, payroll parity, reload, mobile and unavailable-source state.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
