// Real browser form/media flow with fake camera/GPS and explicit HTTP fixtures.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve('dist');
const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));fs.readFile(file,(e,data)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.jpg')?'image/jpeg':'text/html');res.end(data);});});
(async()=>{
  const binary=process.env.CHROMIUM_MODULE?(await import(process.env.CHROMIUM_MODULE)).default:null;await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(binary?{executablePath:process.env.CHROMIUM_EXECUTABLE||await binary.executablePath(),args:binary.args}:{})});
  try{
    const page=await browser.newPage({viewport:{width:1365,height:950},permissions:['geolocation'],geolocation:{latitude:-6.9,longitude:107.6,accuracy:20}});const errors=[],submissions=[];let addressMode='ok',expectedCoordinates={latitude:-6.9,longitude:107.6};
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{
      window.watermarkText=[];const originalText=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(text,x,y){window.watermarkText.push({text,x,y,width:this.canvas.width,height:this.canvas.height,font:this.font});return originalText.call(this,text,x,y);};
      navigator.mediaDevices.getUserMedia=async()=>{const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;const ctx=canvas.getContext('2d');const draw=()=>{ctx.fillStyle='#205090';ctx.fillRect(0,0,640,480);};draw();const interval=setInterval(draw,100);window.addEventListener('beforeunload',()=>clearInterval(interval));return canvas.captureStream(10);};
    });
    const locationId='44444444-4444-4444-8444-444444444444';
    await page.route('**/*',async r=>{
      const url=new URL(r.request().url());if(url.origin===origin||url.protocol==='data:')return r.continue();
      let status=200,data={};
      if(url.pathname==='/api/guest-attendance/options')data={stores:[],events:[{id:locationId,event_name:'Event Uji Server',event_date:'2026-08-31',event_locations:[{address:'Alamat penugasan Jakarta harus tidak tercetak sebagai GPS'}]}]};
      else if(url.pathname==='/api/guest-attendance'&&r.request().method()==='POST'){
        const body=r.request().postData();submissions.push(body);assert.match(body,/Event Uji Server|44444444-4444-4444-8444-444444444444/);assert.match(body,/Catatan uji server/);assert.match(body,/name="photo"/);assert.match(body,/name="locationSource"\r\n\r\ngps/);
        if(submissions.length===1){status=503;data={message:'Uji server belum tersedia'};}else {status=201;data={id:'55555555-5555-4555-8555-555555555555',occurred_at:'2026-08-31T06:04:00Z'};}
      }else if(url.pathname==='/api/guest-location/reverse'){
        assert.deepEqual(r.request().postDataJSON(),expectedCoordinates);
        if(addressMode==='failed')return r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Layanan alamat belum tersedia.'})});
        data={results:[{address:'Jalan Braga, Babakan Ciamis, Sumur Bandung, Kota Bandung, Jawa Barat 40111, Indonesia',street:'Jalan Braga',source:'OpenStreetMap'}]};
      }else if(url.hostname==='nominatim.openstreetmap.org')throw new Error('Browser tidak boleh memanggil Nominatim langsung');
      else if(url.hostname==='tile.openstreetmap.org')return r.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=','base64')});
      else return r.abort();
      await r.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto(origin);await page.getByRole('button',{name:'Masuk sebagai Guest Crew',exact:true}).click();await page.locator('#guest-name').fill('Guest Uji');await page.locator('#guest-phone').fill('081234567890');await page.getByRole('button',{name:'Lanjut ke Mode Guest',exact:true}).click();
    await page.getByLabel('Lokasi Event / Toko',{exact:true}).selectOption(locationId);
    await page.getByText('-6.900000, 107.600000',{exact:true}).first().waitFor();
    // Guest map must resist mouse drag, wheel, double-click, keyboard and touch.
    const map=page.locator('.leaflet-container').first();await map.scrollIntoViewIfNeeded();
    const state=()=>map.evaluate(el=>({pan:el.querySelector('.leaflet-map-pane').style.transform,tiles:el.querySelector('.leaflet-tile-container')?.style.transform,gps:el.getAttribute('aria-label')}));
    const before=await state(),box=await map.boundingBox();const x=box.x+box.width/2,y=box.y+box.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+70,y+40,{steps:8});await page.mouse.up();
    await map.dblclick({position:{x:80,y:80}});await page.mouse.move(x,y);await page.mouse.wheel(0,-400);await map.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
    const touch=await page.context().newCDPSession(page);
    await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y:y+35}]});await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    assert.deepEqual(await state(),before);assert.equal(await map.locator('.leaflet-control-zoom').count(),0);await touch.detach();
    await page.getByRole('button',{name:'Buka Kamera Selfie'}).click();await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.getByRole('button',{name:'Ambil Gambar Sekarang'}).click();await page.getByAltText('Bukti Kehadiran',{exact:true}).waitFor();
    const watermark=await page.evaluate(()=>window.watermarkText);assert.match(watermark.map(row=>row.text).join(''),/Lokasi GPS: Jalan Braga/);assert.match(watermark.map(row=>row.text).join(''),/GPS saat foto: -6.900000, 107.600000/);assert.doesNotMatch(watermark.map(row=>row.text).join(''),/Alamat penugasan Jakarta/);assert.match(watermark.map(row=>row.text).join(''),/OpenStreetMap contributors/);assert.ok(watermark.every(row=>row.y>=0&&row.y+parseFloat(row.font.match(/(\d+)px/)[1])<=row.height));
    const photo=(await page.getByAltText('Bukti Kehadiran',{exact:true}).getAttribute('src')).split(',')[1];fs.mkdirSync(process.env.QA_OUTPUT_DIR||'/tmp/jawara-update-qa',{recursive:true});fs.writeFileSync((process.env.QA_OUTPUT_DIR||'/tmp/jawara-update-qa')+'/guest-watermark.jpg',Buffer.from(photo,'base64'));
    await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').fill('Catatan uji server');await page.getByRole('button',{name:'Kirim Absensi Lapangan',exact:true}).click();await page.getByText('Uji server belum tersedia',{exact:true}).waitFor();assert.equal(await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').inputValue(),'Catatan uji server');assert.equal(await page.getByAltText('Bukti Kehadiran',{exact:true}).count(),1);
    await page.getByRole('button',{name:'Kirim Absensi Lapangan',exact:true}).click();await page.getByRole('heading',{name:'Absensi berhasil dikirim'}).waitFor();assert.equal(await page.getByAltText('Bukti Kehadiran',{exact:true}).count(),0);assert.equal(await page.getByPlaceholder('Ketik keterangan jika ada kendala di lapangan...').inputValue(),'');
    const dialog=page.getByRole('dialog',{name:'Absensi berhasil dikirim'});
    await dialog.waitFor();assert.equal(await page.evaluate(()=>document.getElementById('root').inert),true);
    assert.equal(await dialog.getByRole('button',{name:'Tutup',exact:true}).evaluate(el=>document.activeElement===el),true);
    await page.setViewportSize({width:375,height:812});const out=process.env.QA_OUTPUT_DIR||'/tmp/jawara-update-qa';fs.mkdirSync(out,{recursive:true});
    await dialog.evaluate(async el=>{await Promise.all(el.getAnimations({subtree:true}).map(animation=>animation.finished));});
    await page.screenshot({path:out+'/guest-success-mobile.png'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    await page.keyboard.press('Tab');assert.equal(await dialog.getByRole('link').evaluate(el=>document.activeElement===el),true);
    await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.getElementById('root').inert),false);
    const key=b=>b.match(/name="submissionKey"\r\n\r\n([^\r]+)/)[1];assert.equal(key(submissions[0]),key(submissions[1]));assert.equal(await page.evaluate(()=>localStorage.getItem('fotosnaps_guest_attendances')),null);assert.deepEqual(errors,[]);
    // Provider failure at a new GPS point must not reuse the previous street.
    addressMode='failed';expectedCoordinates={latitude:-6.95,longitude:107.65};
    await page.context().setGeolocation({...expectedCoordinates,accuracy:20});
    await page.getByRole('button',{name:'Perbarui GPS',exact:true}).click();
    await page.getByText('Nama jalan belum tersedia. Coba cari alamat lagi. Koordinat GPS tetap tercatat.',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Buka Kamera Selfie'}).click();await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
    await page.evaluate(()=>window.watermarkText=[]);
    await page.getByRole('button',{name:'Ambil Gambar Sekarang'}).click();await page.getByAltText('Bukti Kehadiran',{exact:true}).waitFor();
    const fallbackText=await page.evaluate(()=>window.watermarkText.map(row=>row.text).join(''));
    assert.match(fallbackText,/Lokasi GPS: Nama jalan belum tersedia/);assert.match(fallbackText,/-6.950000, 107.650000/);assert.doesNotMatch(fallbackText,/Braga/);
    await page.screenshot({path:out+'/guest-map-mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    expectedCoordinates={latitude:-6.98,longitude:107.68};await page.context().setGeolocation({...expectedCoordinates,accuracy:20});
    await page.getByRole('button',{name:'Kirim Absensi Lapangan',exact:true}).click();
    await page.getByText('Lokasi berubah sejak foto diambil. Ambil ulang foto di lokasi saat ini.',{exact:true}).waitFor();
    assert.equal(submissions.length,2);assert.equal(await page.getByAltText('Bukti Kehadiran',{exact:true}).count(),0);assert.deepEqual(errors,[]);
    console.log('PASS guest browser: GPS street watermark, unavailable address fallback, changed GPS invalidates photo, mobile layout; real options IDs, GPS/camera, failure retains photo/note, retry idempotency key, success only after server acceptance, no new local-only records.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;server.close();});
