import "server-only";
import { readFile, stat, statfs } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { cpus, totalmem, freemem, uptime, loadavg, platform } from "node:os";
import { db } from "./db";
import { requireAdmin } from "./admin-auth";
export const planLabels: Record<string,string> = { trial: "Dùng thử", paid: "Trả phí", legacy: "Chưa phân loại" };
export const bytes = (n: number | null) => n === null ? "Chưa đo được" : n < 1048576 ? `${(n/1024).toFixed(1)} KiB` : n < 1073741824 ? `${(n/1048576).toFixed(1)} MiB` : `${(n/1073741824).toFixed(2)} GiB`;
export async function shopStorage(ids: string[]) {
  await requireAdmin();
  const result = new Map(ids.map(id => [id, { images: 0, data: null as number | null, missing: 0 }]));
  const images = await db.productImage.findMany({where:{shopId:{in:ids}},select:{shopId:true,storageKey:true,storageDriver:true}});
  const root=resolve('.private-storage');
  for(const image of images) {
    const item=result.get(image.shopId)!;
    const path=resolve(root,image.storageKey);
    if(image.storageDriver!=='local'||!path.startsWith(root+sep)) {item.missing++;continue;}
    try {item.images+=(await stat(path)).size;} catch {item.missing++;}
  }
  if(process.env.DATABASE_URL?.startsWith('postgres')) {
    // Fixed identifiers only. Logical row sizes exclude shared indexes, WAL and backups.
    const tables=['Order','OrderItem','OrderPayment','OrderHistory','Customer','Product','ProductImage','CashEntry','Session','AdminEvent'];
    const query=tables.map(table=>`SELECT "shopId", SUM(pg_column_size(t))::bigint AS size FROM "${table}" t GROUP BY "shopId"`).join(' UNION ALL ');
    const rows=await db.$queryRawUnsafe<{shopId:string;size:bigint}[]>(`SELECT "shopId", SUM(size)::bigint AS size FROM (${query} UNION ALL SELECT id AS "shopId", pg_column_size(s)::bigint AS size FROM "Shop" s) x GROUP BY "shopId"`);
    for(const item of result.values())item.data=0;
    for(const row of rows)if(result.has(row.shopId))result.get(row.shopId)!.data=Number(row.size);
  }
  return result;
}
export async function serverMetrics() {
  await requireAdmin();
  let disk=null, database:number|null=null;
  try {const value=await statfs(process.cwd());disk={total:value.blocks*value.bsize,used:(value.blocks-value.bfree)*value.bsize,free:value.bavail*value.bsize,reserved:Math.max(0,value.bfree-value.bavail)*value.bsize};}catch{}
  let availableMemory = freemem();
  if (platform() === 'linux') {
    try {const match=(await readFile('/proc/meminfo','utf8')).match(/^MemAvailable:\s+(\d+) kB/m);if(match)availableMemory=Number(match[1])*1024;}catch{}
  }
  try {if(process.env.DATABASE_URL?.startsWith('postgres')) {const rows=await db.$queryRaw<{size:bigint}[]>`SELECT pg_database_size(current_database()) AS size`;database=Number(rows[0].size);}}catch{}
  return {cpu:cpus().length,memory:totalmem(),freeMemory:availableMemory,uptime:uptime(),load:loadavg(),platform:platform(),disk,database,processMemory:process.memoryUsage().rss,time:new Date()};
}
