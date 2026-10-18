import Link from "next/link";
import { serverMetrics, bytes } from "@/lib/admin-metrics";
export const dynamic = "force-dynamic";
export default async function ServerPage() {
 const m=await serverMetrics();
 const cards=[['CPU',`${m.cpu} vCPU`],['Tải trung bình 1 / 5 / 15 phút',m.platform==='win32'?'Không hỗ trợ trên Windows':m.load.map(n=>n.toFixed(2)).join(' / ')],['RAM đã dùng / tổng',`${bytes(m.memory-m.freeMemory)} / ${bytes(m.memory)}`],['RAM tiến trình website',bytes(m.processMemory)],['Ổ đĩa đã dùng / tổng',m.disk?`${bytes(m.disk.total-m.disk.free)} / ${bytes(m.disk.total)}`:'Chưa đo được'],['Ổ đĩa còn trống',m.disk?bytes(m.disk.free):'Chưa đo được'],['Database PostgreSQL',bytes(m.database)],['Server chạy liên tục',`${Math.floor(m.uptime/86400)} ngày ${Math.floor(m.uptime%86400/3600)} giờ`]];
 return <main className="admin-page"><h1>Thông số server</h1><nav className="admin-tabs"><Link href="/admin">Quản trị shop</Link><Link href="/admin/server" aria-current="page">Thông số server</Link></nav><p>Cập nhật khi tải lại trang · {m.time.toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})}</p><div className="admin-metric-grid">{cards.map(([label,value])=><article className="card" key={label}><small>{label}</small><strong>{value}</strong></article>)}</div><p>Thông số của máy đang chạy website ({m.platform}). Load average là số tác vụ chờ/chạy, không phải phần trăm CPU. RAM hệ điều hành có thể bao gồm bộ nhớ đệm. Database gồm dữ liệu và index; log, backup và ảnh nằm trong dung lượng ổ đĩa.</p></main>;
}
