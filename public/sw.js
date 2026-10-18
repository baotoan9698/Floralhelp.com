self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(clients.claim()));
self.addEventListener('push',event=>{
 let data;try{data=event.data.json();}catch{return;}
 event.waitUntil((async()=>{const windows=await clients.matchAll({type:'window',includeUncontrolled:true});const target=windows.find(client=>client.focused)||windows.find(client=>client.visibilityState==='visible');if(target)target.postMessage({type:'floralhelp-push',tag:data.tag});await self.registration.showNotification(data.title||'Floralhelp',{body:data.body,icon:'/apple-touch-icon.png',tag:data.tag,data:{url:data.url||'/'}});for(const client of windows)client.postMessage({type:'floralhelp-push-delivered',tag:data.tag});})());
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();const url=new URL(event.notification.data?.url||'/',self.location.origin);
 if(url.origin!==self.location.origin)return;
 event.waitUntil(clients.openWindow(url.href));
});
