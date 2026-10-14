import { shopSessionState, deleteSession } from "@/lib/auth";
export const dynamic = "force-dynamic";
export async function GET() {
  const { shop, reason } = await shopSessionState(true);
  if (!shop) await deleteSession();
  return Response.json({ active: !!shop, reason, accessUntil: shop?.accessUntil?.toISOString() ?? null }, { headers: { "Cache-Control": "private, no-store" } });
}
