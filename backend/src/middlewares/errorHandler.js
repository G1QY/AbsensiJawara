function errorHandler(err,req,res,next){
 const status=err.code==='LIMIT_FILE_SIZE'?413:err.code?.startsWith('LIMIT_')?400:Number.isInteger(err.status)&&err.status>=400&&err.status<=599?err.status:500;
 console.error(JSON.stringify({event:'request_failed',requestId:req.requestId,status,method:req.method}));
 const message=status>=500?'Terjadi kesalahan pada server.':process.env.NODE_ENV==='production'&&status===400?'Permintaan tidak valid.':err.message;
 res.status(status).json({message,requestId:req.requestId});
}
module.exports=errorHandler;
