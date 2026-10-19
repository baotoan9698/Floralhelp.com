import { acquireImageSlot } from "@/lib/image-capacity";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { currentShop } from "@/lib/auth";
import { shopData } from "@/lib/shop-data";
import { putImage, deleteStoredImage } from "@/lib/image-storage";
import { boundedForm, sameOrigin, imageHeaders } from "@/lib/image-http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return Response.json({ error: "Yêu cầu không hợp lệ." }, { status: 403 });
  if (!(await currentShop()))
    return Response.json({ error: "Vui lòng đăng nhập." }, { status: 401 });
  const data = await shopData();
  const { id } = await params;
  const product = await data.findProduct(id);
  if (!product || product.archived)
    return Response.json(
      { error: "Không tìm thấy sản phẩm." },
      { status: 404 },
    );
  const slots = await data.imageSlots(id);
  const slot = [1, 2, 3].find((n) => !slots.some((s) => s.slot === n));
  if (!slot)
    return Response.json(
      { error: "Mỗi sản phẩm tối đa 3 ảnh." },
      { status: 409 },
    );
  const release = acquireImageSlot();
  if (!release) return Response.json({ error: "Máy chủ đang xử lý ảnh khác. Vui lòng thử lưu lại sau vài giây." }, { status: 429, headers: { "Retry-After": "2" } });
  let normalized: Buffer;
  try {
    const form = await boundedForm(request);
    const file = form.get("image");
    if (!(file instanceof File) || !file.size || file.size > 3 * 1024 * 1024)
      throw new Error("SIZE");
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 40000000 });
    const metadata = await image.metadata();
    if (
      !["jpeg", "png", "webp"].includes(metadata.format || "") ||
      (metadata.pages || 1) > 1
    )
      throw new Error("FORMAT");
    // Reduce resolution only as needed; never crop or distort the original.
    let size = 1600;
    do {
      normalized = await sharp(input, { limitInputPixels: 40000000 })
        .rotate()
        .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80, effort: 1 })
        .toBuffer();
      size = Math.floor(size * 0.75);
    } while (normalized.length >= 300000 && size >= 100);
    if (normalized.length >= 300000) throw new Error("SIZE");
  } catch {
    return Response.json(
      { error: "Chọn ảnh JPG, PNG hoặc WebP, tối đa 3 MB và 40 megapixel." },
      { status: 400 },
    );
  }
  finally { release(); }
  const key = `shops/${data.shop.id}/products/${id}/${randomUUID()}.webp`;
  let driver: string | undefined;
  try {
    driver = await putImage(data.shop.id, key, normalized);
    const image = await data.createImage({
      productId: id,
      slot,
      storageKey: key,
      storageDriver: driver,
    });
    return Response.json(
      { id: image.id },
      { status: 201, headers: imageHeaders },
    );
  } catch (error) {
    if (driver)
      await deleteStoredImage(data.shop.id, key, driver).catch(() => {});
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return Response.json(
        { error: "Ảnh vừa được cập nhật. Vui lòng tải lại và thử lại." },
        { status: 409 },
      );
    return Response.json(
      { error: "Chưa lưu được ảnh. Kiểm tra kết nối kho ảnh hoặc thử lại." },
      { status: 503 },
    );
  }
}
