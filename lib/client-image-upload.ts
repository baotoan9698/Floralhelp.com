"use client";
// Resize locally only when saving. No image bytes leave the device before this call.
export async function uploadProductImage(id: string, file: File, progress: (text: string) => void) {
  progress("Đang thu nhỏ ảnh trên thiết bị…");
  let bitmap: ImageBitmap | undefined;
  let canvas: HTMLCanvasElement | undefined;
  try {
    bitmap = await createImageBitmap(file);
    if (bitmap.width * bitmap.height > 40000000) throw new Error("Ảnh tối đa 40 megapixel.");
    canvas = document.createElement("canvas");
    let size = 1600;
    let blob: Blob | null = null;
    do {
      const ratio = Math.min(1, size / Math.max(bitmap.width, bitmap.height));
      canvas.width = Math.max(1, Math.round(bitmap.width * ratio));
      canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Không xử lý được ảnh trên thiết bị này.");
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      blob = await new Promise<Blob | null>((resolve) => canvas!.toBlob(resolve, "image/webp", 0.8));
      size = Math.floor(size * 0.75);
    } while (blob && blob.size >= 290000 && size >= 100);
    if (!blob || blob.size >= 300000) throw new Error("Chưa thu nhỏ được ảnh. Vui lòng chọn ảnh khác.");
    const body = new FormData(); body.set("image", blob, "image.webp");
    for (let attempt = 0; attempt < 30; attempt++) {
    try { return await new Promise<{ id: string }>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/products/${encodeURIComponent(id)}/images`);
      xhr.timeout = 120000;
      xhr.upload.onprogress = (event) => progress(event.lengthComputable && event.loaded < event.total ? `Đang tải ảnh: ${Math.round(event.loaded / event.total * 100)}%` : "Đang kiểm tra và lưu ảnh…");
      xhr.onerror = () => reject(new Error("Mất kết nối khi tải ảnh."));
      xhr.ontimeout = () => reject(new Error("Tải ảnh quá lâu. Vui lòng thử lại."));
      xhr.onload = () => {
        try { const data = JSON.parse(xhr.responseText); if (xhr.status === 429) { reject(new Error("IMAGE_BUSY")); return; } if (xhr.status !== 201) throw new Error(data.error || "Chưa lưu được ảnh."); resolve(data); }
        catch (error) { reject(error); }
      };
      xhr.send(body);
    }); } catch (error) {
      if (!(error instanceof Error) || error.message !== "IMAGE_BUSY") throw error;
      progress("Đang chờ xử lý ảnh…");
      await new Promise((resolve) => setTimeout(resolve, 2000 + Math.random() * 1000));
    }
    }
    throw new Error("Máy chủ đang bận. Vui lòng lưu lại sau.");
  } finally { bitmap?.close(); if (canvas) { canvas.width = 0; canvas.height = 0; } progress(""); }
}
