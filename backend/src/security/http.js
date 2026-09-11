const crypto = require('node:crypto');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {rateLimit,ipKeyGenerator} = require('express-rate-limit');
const {RedisStore} = require('rate-limit-redis');
const {createClient} = require('redis');
let redis;
function validateEnvironment(env=process.env){
 if(env.NODE_ENV!=='production')return;
 for(const key of ['CORS_ORIGIN','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','REDIS_URL'])if(!env[key]||/YOUR_|xxxxx/i.test(env[key]))throw new Error(`Konfigurasi production wajib: ${key}`);
 for(const origin of env.CORS_ORIGIN.split(',').map(s=>s.trim())){const u=new URL(origin);if(u.protocol!=='https:'||u.origin!==origin)throw new Error('CORS_ORIGIN production harus origin HTTPS tanpa wildcard/path.');}
 if(env.ENABLE_DEV_OTP==='true')throw new Error('OTP development dilarang di production.');
 if(new URL(env.SUPABASE_URL).protocol!=='https:')throw new Error('Supabase wajib HTTPS.');
 for(const key of Object.keys(env))if(/^(VITE_|NEXT_PUBLIC_).*(SECRET|SERVICE_ROLE|PRIVATE_KEY|PASSWORD)/i.test(key))throw new Error('Secret tidak boleh memiliki prefix publik.');
}
async function connectSecurityStore(){if(!process.env.REDIS_URL)return;redis=createClient({url:process.env.REDIS_URL,socket:{reconnectStrategy:retries=>Math.min(retries*100,3000)}});redis.on('error',()=>console.error(JSON.stringify({event:'security_store_unavailable'})));await redis.connect();}
function limiter(name,limit,windowMs,keyGenerator){return rateLimit({windowMs,limit,standardHeaders:'draft-7',legacyHeaders:false,passOnStoreError:false,message:{message:'Terlalu banyak permintaan. Coba kembali nanti.'},...(keyGenerator?{keyGenerator}:{}),...(redis?{store:new RedisStore({prefix:`fotosnaps:${name}:`,sendCommand:(...args)=>redis.sendCommand(args)})}:{})});}
function inputGuard(value,depth=0){
 if(depth>15)throw Object.assign(new Error('Input terlalu dalam.'),{status:400});
 if(typeof value==='string'&&(value.length>250000||value.includes('\0')))throw Object.assign(new Error('Input tidak valid.'),{status:400});
 if(value&&typeof value==='object'){if(Array.isArray(value)&&value.length>2000)throw Object.assign(new Error('Terlalu banyak item.'),{status:400});for(const key of Object.keys(value)){if(['__proto__','prototype','constructor'].includes(key))throw Object.assign(new Error('Field tidak valid.'),{status:400});inputGuard(value[key],depth+1);}}
}
function installSecurity(app,{production=process.env.NODE_ENV==='production',origins=(process.env.CORS_ORIGIN||'http://localhost:5173,http://localhost:8443').split(',').map(s=>s.trim()),limit=6000}={}){
 app.disable('x-powered-by');app.set('trust proxy',process.env.TRUST_PROXY_CIDRS?process.env.TRUST_PROXY_CIDRS.split(',').map(s=>s.trim()):false);
 app.use((req,res,next)=>{req.requestId=crypto.randomUUID();res.setHeader('X-Request-ID',req.requestId);res.setHeader('Cache-Control','no-store');if(/(?:^|\/)\.(?!well-known(?:\/|$))|\.(?:sql|bak|log|map)$/i.test(req.path))return res.status(404).json({message:'Endpoint tidak ditemukan.'});if(production&&req.path!=='/health'&&!req.secure)return res.status(400).json({message:'HTTPS wajib digunakan.'});next();});
 app.use(helmet());
 app.use((req,res,next)=>{if(req.headers.origin&&!origins.includes(req.headers.origin))return res.status(403).json({message:'Origin tidak diizinkan.'});next();});
 app.use(cors({origin:origins,credentials:false,methods:['GET','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:['Authorization','Content-Type','X-FotoSnaps-Request','X-Jawara-Request'],exposedHeaders:['Retry-After','X-Request-ID']}));
 app.use('/api',(req,res,next)=>{const hasRequestHeader=req.get('X-FotoSnaps-Request')==='1'||req.get('X-Jawara-Request')==='1';if(!['GET','HEAD','OPTIONS'].includes(req.method)&&!hasRequestHeader)return res.status(403).json({message:'Header keamanan request wajib tersedia.'});next();});
 app.use('/api',limiter('edge',limit,60000));
 app.use(express.json({limit:'256kb',strict:true}));
 app.use((req,res,next)=>{try{inputGuard(req.body);inputGuard(req.query);next();}catch(e){next(e);}});
 app.use('/api/auth',(req,res,next)=>{for(const field of ['email','password','otp','newPassword','resetToken'])if(req.body?.[field]!==undefined&&(typeof req.body[field]!=='string'||req.body[field].length>2048))return res.status(400).json({message:'Input autentikasi tidak valid.'});next();});
 app.use(['/api/auth/login','/api/auth/forgot-password','/api/auth/verify-otp','/api/auth/reset-password'],limiter('auth-ip',120,15*60000));
 app.use(['/api/auth/login','/api/auth/forgot-password','/api/auth/verify-otp','/api/auth/reset-password'],limiter('auth-account',10,15*60000,req=>crypto.createHash('sha256').update(typeof req.body?.email==='string'?req.body.email.trim().toLowerCase():ipKeyGenerator(req.ip)).digest('hex')));
 app.use('/api/guest-attendance',limiter('guest',120,60000));
}
function userLimits(req,res,next){const middleware=userLimits.instance||(userLimits.instance=limiter('user',240,60000,req=>req.user.id));return middleware(req,res,next);}
function uploadLimits(req,res,next){if(!req.is('multipart/form-data'))return next();const middleware=uploadLimits.instance||(uploadLimits.instance=limiter('upload',30,60000,req=>req.user.id));return middleware(req,res,next);}
module.exports={installSecurity,validateEnvironment,connectSecurityStore,userLimits,uploadLimits,inputGuard};
