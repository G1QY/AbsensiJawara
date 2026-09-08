function shouldStart(event, now=Date.now()) {
 if(event.status!=='SCHEDULED'||!event.event_date||!event.start_time)return false;
 const start=Date.parse(`${event.event_date}T${event.start_time}+07:00`);
 return Number.isFinite(start)&&start<=now;
}
async function refreshScheduledEvents(db,now=Date.now()) {
 const today=new Date(now+7*3600000).toISOString().slice(0,10);
 let lastId=null;
 for(;;){
  let query=db.from('events').select('id,status,event_date,start_time').eq('status','SCHEDULED').lte('event_date',today).order('id').limit(500);
  if(lastId)query=query.gt('id',lastId);
  const {data,error}=await query;if(error)throw error;
  if(!data?.length)break;
  for(const event of data.filter(event=>shouldStart(event,now))){
   const result=await db.from('events').update({status:'ONGOING'}).eq('id',event.id).eq('status','SCHEDULED').eq('event_date',event.event_date).eq('start_time',event.start_time);
   if(result.error)throw result.error;
  }
  lastId=data.at(-1).id;if(data.length<500)break;
 }
}
function startEventClock(db){
 let running=false;
 const tick=async()=>{if(running)return;running=true;try{await refreshScheduledEvents(db);}catch{console.error('Sinkronisasi status event gagal; akan dicoba kembali.');}finally{running=false;}};
 void tick();const timer=setInterval(tick,15000);timer.unref();return()=>clearInterval(timer);
}
module.exports={shouldStart,refreshScheduledEvents,startEventClock};
