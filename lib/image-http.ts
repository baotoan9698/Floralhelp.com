import "server-only";
export const imageHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie",
  "X-Content-Type-Options": "nosniff",
};
export function sameOrigin(request: Request) {
  const internal = new URL(request.url);
  const host = request.headers.get("host") || internal.host;
  const protocol = request.headers.get("x-forwarded-proto") === "https" ? "https:" : internal.protocol;
  // Build a new origin: assigning URL.host without a port retains an existing
  // internal :3000 port, incorrectly rejecting HTTPS requests through nginx.
  try {
    const target = new URL(`${protocol}//${host}`);
    return request.headers.get("origin") === target.origin;
  } catch { return false; }
}
export async function boundedForm(request: Request) {
  const max = 3 * 1024 * 1024 + 64 * 1024;
  if (Number(request.headers.get("content-length")) > max || !request.body)
    throw new Error("SIZE");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new Error("SIZE");
    }
    chunks.push(value);
  }
  return new Response(new Uint8Array(Buffer.concat(chunks)), {
    headers: { "Content-Type": request.headers.get("content-type") || "" },
  }).formData();
}
