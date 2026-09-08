require('dotenv').config();
const {validateEnvironment,connectSecurityStore}=require('./security/http');
async function start(){
 validateEnvironment();
 await connectSecurityStore();
 const app=require('./app');
 const stopEventClock=require('./services/eventAutoStart').startEventClock(require('./config/supabaseClient')); 
 const server=app.listen(process.env.PORT||4000,process.env.HOST||'127.0.0.1',()=>console.log('FotoSnaps backend ready'));
 server.requestTimeout=30000;server.headersTimeout=15000;
 const stop=()=>{stopEventClock();server.close(()=>process.exit(0));};process.on('SIGTERM',stop);process.on('SIGINT',stop);
}
start().catch(()=>{console.error('Startup gagal. Periksa konfigurasi production dan koneksi security store.');process.exit(1);});
