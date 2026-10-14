import { shopSessionState } from "@/lib/auth";
import { changeOrderStatus } from "@/app/actions";

export async function PATCH(request: Request) {
  // Match Server Actions' same-origin protection for cookie-authenticated writes.
  const origin = request.headers.get("origin");
  let originHost;
  try { originHost = origin ? new URL(origin).host : null; } catch { originHost = null; }
  if (!originHost || originHost !== request.headers.get("host")) {
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  }
  const { shop } = await shopSessionState();
  if (!shop) return Response.json({ error: "Phiên đăng nhập không còn hợp lệ." }, { status: 401 });
  let body;
  try { body = await request.json(); }
  catch { return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 }); }
  if (!body || typeof body.id !== "string" || typeof body.status !== "string") {
    return Response.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const result = await changeOrderStatus(body.id, body.status);
  return Response.json(result, { status: result.error ? 400 : 200 });
}
