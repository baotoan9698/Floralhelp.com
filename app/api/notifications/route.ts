import { currentShop } from '@/lib/auth';
import { db } from '@/lib/db';
import { sameOrigin } from '@/lib/image-http';
import webpush from 'web-push';
import { z } from 'zod';
export const runtime='nodejs';
export async function GET() {
 const shop=await currentShop();if(!shop)return Response.json({error:'Vui lòng đăng nhập.'},{status:401});
 const notifications=await db.deliveryReminder.findMany({where:{shopId:shop.id},orderBy:{createdAt:'desc'},take:30});
 return Response.json({enabled:shop.reminderEnabled,minutes:shop.reminderMinutes,publicKey:process.env.VAPID_PUBLIC_KEY||'',notifications},{headers:{'Cache-Control':'no-store'}});
}
export async function POST(request:Request) {
 if(!sameOrigin(request))return Response.json({error:'Yêu cầu không hợp lệ.'},{status:403});
 const shop=await currentShop();if(!shop)return Response.json({error:'Vui lòng đăng nhập.'},{status:401});
 try {
 const input=await request.json();
 if(input.action==='settings') {
 const data=z.object({enabled:z.boolean(),minutes:z.number().int().min(1).max(10080)}).parse(input);
 await db.shop.update({where:{id:shop.id},data:{reminderEnabled:data.enabled,reminderMinutes:data.minutes}});
 } else if(input.action==='subscribe') {
 const sub=z.object({endpoint:z.string().url().max(2048),keys:z.object({p256dh:z.string().min(16).max(200),auth:z.string().min(8).max(100)})}).parse(input.subscription);
 const url=new URL(sub.endpoint);
 const hosts=['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'];
 const allowed=(url.hostname==='jmt17.google.com'&&url.pathname.startsWith('/fcm/send/'))||hosts.includes(url.hostname)||url.hostname.endsWith('.notify.windows.com')||url.hostname.endsWith('.push.apple.com');
 if(url.protocol!=='https:'||url.port||url.username||url.password||!allowed)throw Error(`Dịch vụ push chưa được hỗ trợ: ${url.hostname}. Vui lòng gửi tên miền này để kiểm tra.`);
 const existing=await db.pushDevice.findUnique({where:{endpoint:sub.endpoint}});
 if(existing&&existing.shopId!==shop.id)throw Error('Hãy tắt thông báo của tài khoản cũ trên thiết bị này trước.');
 if(!existing&&await db.pushDevice.count({where:{shopId:shop.id}})>=20)throw Error('Tối đa 20 thiết bị mỗi shop.');
 await db.pushDevice.upsert({where:{endpoint:sub.endpoint},create:{shopId:shop.id,endpoint:sub.endpoint,...sub.keys},update:sub.keys});
 } else if(input.action==='unsubscribe') {
 await db.pushDevice.deleteMany({where:{shopId:shop.id,endpoint:String(input.endpoint)}});
 } else if(input.action==='read') {
 await db.deliveryReminder.updateMany({where:{shopId:shop.id,readAt:null},data:{readAt:new Date()}});
 } else if(input.action==='test') {
 const key=`push-test:${shop.id}`;
 const previous=await db.authAttempt.findUnique({where:{key}});
 if(previous&&previous.resetsAt>new Date())return Response.json({error:'Đợi 30 giây trước khi gửi thử lại.'},{status:429});
 await db.authAttempt.upsert({where:{key},create:{key,resetsAt:new Date(Date.now()+30000)},update:{resetsAt:new Date(Date.now()+30000)}});
 if(!process.env.VAPID_PRIVATE_KEY||!process.env.VAPID_PUBLIC_KEY)throw Error('Chưa cấu hình khóa Web Push.');
 webpush.setVapidDetails('mailto:admin@floralhelp.com',process.env.VAPID_PUBLIC_KEY,process.env.VAPID_PRIVATE_KEY);
 const device=await db.pushDevice.findFirst({where:{shopId:shop.id,endpoint:String(input.endpoint)}});
 if(!device)throw Error('Bật thông báo trên thiết bị này trước.');
 await webpush.sendNotification({endpoint:device.endpoint,keys:{p256dh:device.p256dh,auth:device.auth}},JSON.stringify({title:'Floralhelp · Thông báo thử',body:'Thiết bị đã sẵn sàng nhận nhắc giao hoa.',url:'/',tag:z.string().uuid().parse(input.testId)}),{TTL:60,timeout:10000});
 } else throw Error('Thao tác không hợp lệ.');
 return Response.json({ok:true});
 }catch(error){return Response.json({error:error instanceof z.ZodError?'Kiểm tra thông tin đã nhập.':error instanceof Error?error.message:'Chưa thực hiện được.'},{status:400});}
}
