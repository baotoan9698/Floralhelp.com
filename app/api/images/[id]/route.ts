import { currentShop } from "@/lib/auth";
import { shopData } from "@/lib/shop-data";
import { readImage, deleteStoredImage } from "@/lib/image-storage";
import { imageHeaders, sameOrigin } from "@/lib/image-http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await currentShop()))
    return new Response(null, { status: 401, headers: imageHeaders });
  const data = await shopData();
  const image = await data.findImage((await params).id);
  if (!image) return new Response(null, { status: 404, headers: imageHeaders });
  const headers = { ...imageHeaders, "Cache-Control": "private, no-cache", ETag: `"${image.id}"` };
  if (_request.headers.get("if-none-match") === headers.ETag) return new Response(null, { status: 304, headers });
  try {
    const bytes = await readImage(
      data.shop.id,
      image.storageKey,
      image.storageDriver,
    );
    return new Response(new Uint8Array(bytes), {
      headers: { ...headers, "Content-Type": "image/webp" },
    });
  } catch {
    return new Response(null, { status: 503, headers: imageHeaders });
  }
}
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Yêu cầu không hợp lệ." },
      { status: 403, headers: imageHeaders },
    );
  if (!(await currentShop()))
    return Response.json(
      { error: "Vui lòng đăng nhập." },
      { status: 401, headers: imageHeaders },
    );
  const data = await shopData();
  const image = await data.findImage((await params).id);
  if (!image)
    return Response.json(
      { error: "Không tìm thấy ảnh." },
      { status: 404, headers: imageHeaders },
    );
  try {
    await deleteStoredImage(
      data.shop.id,
      image.storageKey,
      image.storageDriver,
    );
    await data.deleteImage(image.id);
    return Response.json({ error: "" }, { headers: imageHeaders });
  } catch {
    return Response.json(
      { error: "Chưa xóa được ảnh. Vui lòng thử lại." },
      { status: 503, headers: imageHeaders },
    );
  }
}
