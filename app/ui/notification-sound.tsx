"use client";
import {useEffect,useState} from 'react';
import {playTing,soundEnabled} from '@/lib/notification-sound';
export default function NotificationSound(){const[enabled,setEnabled]=useState(false),[error,setError]=useState('');useEffect(()=>setEnabled(soundEnabled()),[]);
return <div className="notification-actions"><button type="button" className="secondary" onClick={async()=>{try{localStorage.setItem('floralhelp-sound','on');setEnabled(true);await playTing();setError('');}catch{setError('Chưa phát được âm thanh. Kiểm tra quyền âm thanh của trình duyệt.');}}}>{enabled?'Nghe thử tiếng ting':'Bật tiếng ting / Nghe thử'}</button>{enabled&&<button type="button" className="secondary" onClick={()=>{localStorage.setItem('floralhelp-sound','off');setEnabled(false);}}>Tắt tiếng ting</button>}<small>Tiếng ting phát khi web đang mở. Sau khi mở lại trang, bấm vào trang một lần để trình duyệt cho phép âm thanh.</small>{error&&<p role="alert">{error}</p>}</div>}
