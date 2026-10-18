import {PrismaClient} from '@prisma/client';
import webpush from 'web-push';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
if(process.argv.includes('--local'))process.env.DATABASE_URL='file:'+process.cwd().replaceAll('\\','/')+'/prisma/dev.db';
const db=new PrismaClient();
if(process.env.VAPID_PUBLIC_KEY&&process.env.VAPID_PRIVATE_KEY)webpush.setVapidDetails('mailto:admin@floralhelp.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
let running=false;
async function tick(){if(running)return;running=true;try{
 const now=new Date();const shops=await db.shop.findMany({where:{reminderEnabled:true,accessStatus:'active',OR:[{accessUntil:null},{accessUntil:{gt:now}}]},include:{pushDevices:true}});
 for(const shop of shops){
 const until=new Date(now.getTime()+shop.reminderMinutes*60000);
 const date=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(d);
 const orders=await db.order.findMany({where:{shopId:shop.id,status:{in:['pending','preparing']},date:{gte:date(now),lte:date(until)}}});
 for(const order of orders){
 const due=new Date(`${order.date}T${order.time}:00+07:00`);
 if(!Number.isFinite(due.getTime())||due<=now||due>until)continue;
 const scheduleKey=`${order.id}:${order.date}:${order.time}`;
 const title=`Đơn hàng ${order.code} cần được chuẩn bị trước giờ giao cho khách !`,body=`Giao lúc : ${order.time} - ${order.date.split('-').reverse().join('/')} - ${order.customer}`;
 try{await db.deliveryReminder.create({data:{shopId:shop.id,orderId:order.id,scheduleKey,title,body}});}catch(e){if(e.code==='P2002')continue;throw e;}
 for(const device of shop.pushDevices){try{
 await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title,body,url:`/orders/${order.id}`,tag:scheduleKey}),{TTL:Math.min(3600,Math.max(1,Math.floor((due-now)/1000))),timeout:10000});
 }catch(e){if(e.statusCode===404||e.statusCode===410)await db.pushDevice.deleteMany({where:{id:device.id}});else console.error('Push delivery failed',e.statusCode||'network');}}
 }
 }
}catch(e){console.error('Reminder scan failed:',e.message);if(process.argv.includes('--once'))process.exitCode=1;}finally{running=false;}}
await tick();
if(process.argv.includes('--once'))await db.$disconnect();else{console.log('Delivery reminders running every 60 seconds');setInterval(tick,60000);}
