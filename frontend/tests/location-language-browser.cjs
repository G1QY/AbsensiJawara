// Verify UI state and persistence using explicit HTTP and Maps SDK fixtures.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist'),out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-location-qa';fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://localhost').pathname;fs.readFile(path.join(root,p==='/'?'index.html':p),(err,data)=>{if(err){res.writeHead(404);return res.end();}res.setHeader('Content-Type',p.endsWith('.js')?'application/javascript':p.endsWith('.css')?'text/css':p.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;
 const browser=await chromium.launch({headless:true,...(binary?{executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args}:{})});
 try{
  const page=await browser.newPage({viewport:{width:1365,height:950}}),errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   window.mapCalls=[];window.searchMode='places';
   const point=(lat,lng)=>({lat:()=>lat,lng:()=>lng});
   class Map {constructor(el,options){window.mapInstance=this;this.position=options.center;this.listeners={};el.textContent='Peta uji';window.mapCalls.push('map');}addListener(name,fn){this.listeners[name]=fn;}panTo(p){this.position=p;}}
   class Marker{constructor(options){this.position=options.position;this.listeners={};window.markerInstance=this;}setPosition(p){this.position=p;}setMap(){}addListener(name,fn){this.listeners[name]=fn;}}
   class Geocoder{async geocode(request){window.mapCalls.push(request);if(window.searchMode==='delay'){await new Promise(resolve=>window.finishSearch=resolve);return {results:[{formatted_address:'Stale address',geometry:{location:point(-1,100)}}]};}if(window.searchMode==='denied')throw {code:'REQUEST_DENIED'};if(request.location)return {results:[{formatted_address:'Jl. Braga, Bandung',geometry:{location:point(-6.91,107.61)}}]};return {results:[]};}}
   window.google={maps:{Map,Marker,Geocoder,event:{clearInstanceListeners(){}},importLibrary:async()=>({Place:{searchByText:async request=>{window.mapCalls.push(request);if(window.searchMode==='denied')throw {code:'PERMISSION_DENIED'};return {places:[{formattedAddress:'Kopi Toko Tua, Jl. Braga, Bandung',location:point(-6.917,107.609)},{formattedAddress:'Kopi Toko Tua, Jakarta',location:point(-6.244,106.8)}]};}}})}};
  });
  const user={id:'admin',full_name:'Admin Uji',email:'admin@example.test'},store={id:'store-1',name:'Roll Film',code:'RF',company_name:'Kopi Toko Tua',branch_id:'b',location_kind:'STORE',status:'ACTIVE',address:'Blok M, Jakarta',latitude:-6.2448705,longitude:106.8009281,radius_meters:50};
  await page.route('**/*',async route=>{const url=new URL(route.request().url());if(url.origin===origin)return route.continue();if(!url.pathname.startsWith('/api/'))return route.abort();let data=[];
   if(url.pathname==='/api/auth/login')data={token:'test',refreshToken:'test',user,role:'SUPER_ADMIN'};
   else if(url.pathname==='/api/users/me')data=user;
   else if(url.pathname==='/api/admin-directory')data={branches:[{id:'b',name:'Braga',city_name:'Bandung'}],stores:[store],events:[],archivedStores:[]};
   else if(url.pathname.startsWith('/api/admin-directory/stores/')&&route.request().method()==='PATCH'){writes.push(route.request().postDataJSON());data={};}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(origin);await page.locator('#email').fill(user.email);await page.locator('#password').fill('test-password');await page.getByRole('button',{name:'Log in',exact:true}).click();
  await page.getByRole('button',{name:'Cabang, Store & Kantor',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('button',{name:'Edit',exact:true}).click();
  const input=page.getByRole('textbox',{name:'Cari alamat atau nama tempat',exact:true});assert.equal(await input.count(),1);assert.equal((await page.evaluate(()=>window.mapCalls)).length,0);
  await input.fill('Kopi Toko Tua, Braga, Bandung');await dialog.getByRole('button',{name:'Simpan Store',exact:true}).click();assert.equal(writes.length,0);
  await page.getByRole('button',{name:'Cari',exact:true}).click();await page.getByRole('list',{name:'Hasil pencarian alamat'}).waitFor();await page.getByRole('button',{name:'Kopi Toko Tua, Jl. Braga, Bandung',exact:true}).click();
  assert.equal(await input.inputValue(),'Kopi Toko Tua, Jl. Braga, Bandung');assert.deepEqual(await page.evaluate(()=>window.mapInstance.position),{lat:-6.917,lng:107.609});
  // Switch language while the unsaved store form is open. The values must survive.
  await page.getByRole('combobox',{name:'Bahasa aplikasi'}).selectOption('en');assert.equal(await page.locator('html').getAttribute('lang'),'en');
  const englishInput=page.getByRole('textbox',{name:'Search address or place name',exact:true});assert.equal(await englishInput.inputValue(),'Kopi Toko Tua, Jl. Braga, Bandung');await page.screenshot({path:out+'/store-location-english.png',animations:'disabled'});await dialog.getByRole('button',{name:'Save Store',exact:true}).click();
  await dialog.getByText('Data saved.',{exact:true}).waitFor();assert.equal(writes.length,1);assert.equal(writes[0].latitude,-6.917);assert.equal(writes[0].longitude,107.609);assert.equal(writes[0].status,'ACTIVE');assert.equal(writes[0].name,'Roll Film');
  assert.equal(await page.getByRole('button',{name:/Confirm address for selected point/}).count(),0);
  await dialog.getByRole('button',{name:'Edit',exact:true}).click();await page.getByRole('combobox',{name:'App language'}).selectOption('id');
  // Reject an old response after the address changes during an in-flight request.
  await input.fill('Permintaan lama');await page.evaluate(()=>window.searchMode='delay');await page.getByRole('button',{name:'Cari',exact:true}).click();await page.waitForFunction(()=>!!window.finishSearch);await input.fill('Alamat terbaru');await page.evaluate(()=>window.finishSearch());await page.getByRole('button',{name:'Simpan Store',exact:true}).click();assert.equal(writes.length,1);assert.equal(await input.inputValue(),'Alamat terbaru');
  await page.evaluate(()=>window.searchMode='denied');await page.getByRole('button',{name:'Cari',exact:true}).click();await page.getByRole('alert').filter({hasText:'Pencarian ditolak Google'}).waitFor();
  // Explicit pin selection clears an old address, and manual confirmation keeps the selected point.
  await page.evaluate(()=>window.mapInstance.listeners.click({latLng:{lat:()=>-6.92,lng:()=>107.62}}));assert.equal(await input.inputValue(),'');await input.fill('Alamat manual Bandung');await page.getByRole('button',{name:/Konfirmasi alamat untuk titik pilihan/}).click();await dialog.getByRole('button',{name:'Simpan Store',exact:true}).click();await dialog.getByText('Data tersimpan.',{exact:true}).waitFor();assert.equal(writes[1].latitude,-6.92);assert.equal(writes[1].longitude,107.62);
  await dialog.getByRole('button',{name:'Edit',exact:true}).click();await page.setViewportSize({width:375,height:812});await page.screenshot({path:out+'/store-location-mobile.png',animations:'disabled'});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await dialog.getByRole('button',{name:'Tutup dialog'}).click();await page.getByRole('combobox',{name:'Bahasa aplikasi'}).selectOption('en');await page.reload();assert.equal(await page.locator('html').getAttribute('lang'),'en');await page.getByRole('combobox',{name:'App language'}).waitFor();
  await page.getByRole('combobox',{name:'App language'}).selectOption('id');assert.equal(await page.evaluate(()=>localStorage.getItem('jawara_language')),'id');assert.deepEqual(errors,[]);
  console.log('PASS maps and language: single input, no eager requests, Places selection, coherent save, stale/denied responses, manual pin, reset, preserved form and wire values, language persistence, mobile.');
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
