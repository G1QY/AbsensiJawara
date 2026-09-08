// Real browser form/media flow with fake camera/GPS and explicit HTTP fixtures.
const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
  const binary=(await import(process.env.CHROMIUM_MODULE)).default;await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args});
  try{
    const page=await browser.newPage({viewport:{width:1365,height:950},permissions:['geolocation'],geolocation:{latitude:-6.9,longitude:107.6,accuracy:20}});const errors=[],submissions=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');const draw=()=>{ctx.fillStyle='#205090';ctx.fillRect(0,0,640,480);};draw();const interval=setInterval(draw,100);window.addEventListener('beforeunload',()=>clearInterval(interval));return canvas.captureStream(10);};
    });
    const locationId='44444444-4444-4444-8444-444444444444';
    await page.route('**/*',async r=>{
      const url=new URL(r.request().url());if(url.origin===origin||url.protocol==='data:')return r.continue();
      let status=200,data={};
      if(url.pathname==='/api/guest-attendance/options')data={stores:[],events:[{id:locationId,event_name:'Event Uji Server',event_date:'2026-08-31'}]};
      else if(url.pathname==='/api/guest-attendance'&&r.request().method()==='POST'){
        const body=r.request().postData();submissions.push(body);assert.match(body,/Event Uji Server|44444444-4444-4444-8444-444444444444/);assert.match(body,/Catatan uji server/);assert.match(body,/name="photo"/);assert.match(body,/name="locationSource"\r\n\r\ngps/);
        if(submissions.length===1){status=503;data={message:'Uji server belum tersedia'};}else {status=201;data={id:'55555555-5555-4555-8555-555555555555',occurred_at:'2026-08-31T06:04:00Z'};}
      }else if(url.hostname==='nominatim.openstreetmap.org')data={display_name:'Lokasi Uji Bandung'};
      else return r.abort();
      await r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(origin);await page.getByRole('button',{name:'Masuk sebagai Guest Crew',exact:true}).click();await page.locator('#guest-name').fill('Guest Uji');await page.locator('#guest-phone').fill('081234567890');await page.getByRole('button',{name:'Lanjut ke Mode Guest',exact:true}).click();
    await page.getByLabel('Lokasi Event / Toko',{exact:true}).selectOption(locationId);
    await page.getByText('Lokasi Uji Bandung',{exact:true}).first().waitFor();
    await page.getByRole('button',{name:'Buka Kamera Selfie'}).click();await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.getByRole('button',{name:'Ambil Gambar Sekarang'}).click();await page.getByAltText('Bukti Kehadiran',{exact:true}).waitFor();
    await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').fill('Catatan uji server');await page.getByRole('button',{name:'Kirim Absensi Lapangan',exact:true}).click();await page.getByText('Uji server belum tersedia',{exact:true}).waitFor();assert.equal(await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').inputValue(),'Catatan uji server');assert.equal(await page.getByAltText('Bukti Kehadiran',{exact:true}).count(),1);
    await page.getByRole('button',{name:'Kirim Absensi Lapangan',exact:true}).click();await page.getByRole('heading',{name:'Absensi Lapangan Berhasil Dikirim'}).waitFor();assert.equal(await page.getByAltText('Bukti Kehadiran',{exact:true}).count(),0);assert.equal(await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').inputValue(),'');
    const key=b=>b.match(/name="submissionKey"\r\n\r\n([^\r]+)/)[1];assert.equal(key(submissions[0]),key(submissions[1]));assert.equal(await page.evaluate(()=>localStorage.getItem('fotosnaps_guest_attendances')),null);assert.deepEqual(errors,[]);
    console.log('PASS guest browser: real options IDs, GPS/camera, failure retains photo/note, retry idempotency key, success only after server acceptance, no new local-only records.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
