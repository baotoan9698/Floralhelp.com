"use client";
import {useEffect,useState} from 'react';
import {playTing,unlockSound} from '@/lib/notification-sound';
import NotificationSound from './notification-sound';
import {Bell} from 'lucide-react';
export default function ReminderBell(){const[open,setOpen]=useState(false),[items,setItems]=useState<{id:string;title:string;body:string;orderId:string;readAt:string|null}[]>([]);
useEffect(()=>{let initialized=false;const seen=new Set<string>();
const unlock=()=>{void unlockSound().catch(()=>{});};
const push=(event:MessageEvent)=>{if(event.data?.type==='floralhelp-push')void playTing(event.data.tag).catch(()=>{});};
window.addEventListener('pointerdown',unlock);window.addEventListener('keydown',unlock);navigator.serviceWorker?.addEventListener('message',push);
const load=async()=>{try{const r=await fetch('/api/notifications');if(r.ok){const notices= (await r.json()).notifications;setItems(notices);for(const item of notices){if(initialized&&!seen.has(item.id)&&!item.readAt)void playTing(item.scheduleKey).catch(()=>{});seen.add(item.id);}initialized=true;}}catch{}};void load();const id=setInterval(()=>{if(document.visibilityState==='visible')void load();},30000);return()=>{clearInterval(id);window.removeEventListener('pointerdown',unlock);window.removeEventListener('keydown',unlock);navigator.serviceWorker?.removeEventListener('message',push);};},[]);
return <aside className="reminder-bell"><button type="button" className="secondary" aria-label="Thông báo giao hoa" aria-expanded={open} onClick={()=>setOpen(!open)}><Bell size={20}/>{items.filter(i=>!i.readAt).length||''}</button>{open&&<div className="card reminder-list"><strong>Nhắc giao hoa</strong><NotificationSound />{items.length?items.map(i=><p key={i.id}><a href={`/orders/${i.orderId}`}>{i.title}</a><br/>{i.body}</p>):<p>Chưa có thông báo. Bật nhắc trong Cài đặt shop.</p>}</div>}</aside>}
