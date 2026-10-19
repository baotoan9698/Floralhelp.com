"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Flower2,
  Pencil,
  Archive,
  RotateCcw,
  X,
  Trash2,
  ImagePlus,
} from "lucide-react";
import { saveProduct, archiveProduct } from "../actions";
import type { ProductView } from "@/lib/validation";
import MoneyInput from "./money-input";
import { uploadProductImage } from "@/lib/client-image-upload";
const money = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(value) + " ₫";
const imageUploadsVisible = true;
export default function Products({ products }: { products: ProductView[] }) {
  const [editing, setEditing] = useState<ProductView | "new" | null>(null);
  const [price, setPrice] = useState("0");
  const [query, setQuery] = useState("");
  const [archived, setArchived] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, start] = useTransition();
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const savedId = useRef("");
  const [deletedImages, setDeletedImages] = useState<string[]>([]);
  const [savedImages, setSavedImages] = useState(0);
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  const modal = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (editing) modal.current?.showModal();
    else modal.current?.close();
  }, [editing]);
  function open(value: ProductView | "new") {
    setFiles([]); setDeletedImages([]);
    savedId.current = value === "new" ? "" : value.id;
    setSavedImages(value === "new" ? 0 : value.images.length);
    setError("");
    setPrice(value === "new" ? "0" : String(value.price));
    setEditing(value);
  }
  function saveWithImages(form: FormData) {
    setError("");
    start(async () => {
      try {
        form.set("id", savedId.current);
        const result = await saveProduct(form);
        if (result.error || !result.id) { setError(result.error); return; }
        savedId.current = result.id;
        for (const id of deletedImages) {
          const response = await fetch(`/api/images/${id}`, { method: "DELETE" });
          if (!response.ok && response.status !== 404) throw new Error("Chưa xóa được ảnh. Vui lòng lưu lại để thử lại.");
          setDeletedImages((ids) => ids.filter((value) => value !== id));
        }
        for (const file of files) {
          await uploadProductImage(result.id, file, setUploadProgress);
          setFiles((current) => current.filter((item) => item !== file));
          setSavedImages((count) => count + 1);
        }
        setEditing(null);
        setFiles([]);
        setNotice("Đã lưu sản phẩm và ảnh đã chọn.");
        router.refresh();
      } catch (error) {
        setError(`${savedId.current ? "Sản phẩm đã lưu. " : ""}${error instanceof Error ? error.message : "Chưa thể lưu."} Bạn có thể bấm lưu để thử lại các ảnh còn lại.`);
        router.refresh();
      }
    });
  }
  function run(work: () => Promise<{ error: string }>, done: () => void) {
    setError("");
    start(async () => {
      try {
        const result = await work();
        if (result.error) setError(result.error);
        else {
          done();
          router.refresh();
        }
      } catch {
        setError("Không thể cập nhật sản phẩm. Vui lòng thử lại.");
      }
    });
  }
  async function upload(productId: string, file?: File) {
    const product = products.find((product) => product.id === productId);
    if (!file || !product) return;
    open(product);
    if (file.size > 3 * 1024 * 1024) { setError("Chọn ảnh tối đa 3 MB."); return; }
    setFiles([file]);
  }
  async function removeImage(id: string) {
    const product = products.find((product) => product.images.some((image) => image.id === id));
    if (!product) return;
    open(product); setDeletedImages([id]); setSavedImages(product.images.length - 1);
  }
  const shown = products.filter(
    (p) =>
      p.archived === archived &&
      p.name.toLocaleLowerCase("vi").includes(query.toLocaleLowerCase("vi")),
  );
  return (
    <section className="products-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">DANH MỤC RIÊNG CỦA SHOP</span>
          <h1>Sản phẩm</h1>
          <p>Sản phẩm và ảnh chỉ hiển thị trong shop của bạn.</p>
        </div>
        <button className="primary" onClick={() => open("new")}>
          <Plus size={18} />
          Thêm sản phẩm
        </button>
      </div>
      <div className="catalog-tools">
        <label className="search">
          <input
            aria-label="Tìm sản phẩm"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm tên sản phẩm…"
          />
        </label>
        <div className="filters">
          <button
            className={!archived ? "active" : ""}
            onClick={() => setArchived(false)}
          >
            Đang bán
          </button>
          <button
            className={archived ? "active" : ""}
            onClick={() => setArchived(true)}
          >
            Đã ẩn
          </button>
        </div>
      </div>
      {notice && (
        <p className="notice" role="status">
          {notice}
        </p>
      )}
      {error && !editing && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {!shown.length ? (
        <div className="empty card">
          <Flower2 size={34} />
          <h3>Chưa có sản phẩm phù hợp</h3>
          <p>Thêm sản phẩm của shop, rồi tải tối đa 3 ảnh cho mỗi sản phẩm.</p>
        </div>
      ) : (
        <div className="product-grid">
          {shown.map((product) => (
            <article className="card product-card" key={product.id}>
              <div className="product-images">
                {product.images.length ? (
                  product.images.map((image, i) => (
                    <div key={image.id}>
                      <img
                        src={`/api/images/${image.id}`}
                        alt={`${product.name} — ảnh ${i + 1}`}
                        loading="lazy"
                      />
                      <button
                        className="icon-button"
                        aria-label={`Xóa ảnh ${i + 1} của ${product.name}`}
                        disabled={uploading}
                        onClick={() => removeImage(image.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="product-placeholder">
                    <Flower2 size={40} strokeWidth={1} />
                  </div>
                )}
              </div>
              <div className="product-info">
                <h2>{product.name}</h2>
                <strong>{money(product.price)}</strong>
                {product.description && <p>{product.description}</p>}
                <div className="product-buttons">
                  <button className="secondary" onClick={() => open(product)}>
                    <Pencil size={15} />
                    Sửa
                  </button>
                  <button
                    className="icon-button"
                    disabled={pending}
                    aria-label={`${product.archived ? "Hiện" : "Ẩn"} sản phẩm ${product.name}`}
                    onClick={() =>
                      run(
                        () => archiveProduct(product.id, !product.archived),
                        () =>
                          setNotice(
                            product.archived
                              ? "Đã mở bán lại sản phẩm."
                              : "Đã ẩn sản phẩm; các đơn cũ vẫn được giữ.",
                          ),
                      )
                    }
                  >
                    {product.archived ? (
                      <RotateCcw size={17} />
                    ) : (
                      <Archive size={17} />
                    )}
                  </button>
                </div>
                {imageUploadsVisible && !product.archived && product.images.length < 3 && (
                  <label className="upload-label">
                    <span className="upload-icon"><ImagePlus size={21} /></span>
                    <span className="upload-copy"><strong>{uploading
                      ? "Đang xử lý ảnh…"
                      : "Thêm ảnh sản phẩm"}</strong><small>JPG, PNG, WebP · Tối đa 3 MB/ảnh</small></span>
                    <span className="upload-count">{product.images.length}/3</span>
                    <input
                      aria-label={`Thêm ảnh cho ${product.name}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={uploading}
                      onChange={(e) => {
                        void upload(product.id, e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
      <dialog
        ref={modal}
        aria-labelledby="product-modal-title"
        onCancel={(e) => {
          if (pending) e.preventDefault();
          else setEditing(null);
        }}
      >
        <div className="modal-head">
          <h2 id="product-modal-title">
            {editing === "new" ? "Thêm sản phẩm" : "Sửa sản phẩm"}
          </h2>
          <button
            className="icon-button"
            disabled={pending}
            aria-label="Đóng"
            onClick={() => setEditing(null)}
          >
            <X />
          </button>
        </div>
        {editing && (
          <form
            key={editing === "new" ? "new" : editing.id}
            onSubmit={(e) => {
              e.preventDefault();
              const form = new FormData(e.currentTarget);
              saveWithImages(form);
            }}
          >
            <input
              type="hidden"
              name="id"
              value={editing === "new" ? "" : editing.id}
            />
            <label>
              Tên sản phẩm
              <input
                name="name"
                required
                maxLength={160}
                defaultValue={editing === "new" ? "" : editing.name}
              />
            </label>
            <label>
              Giá sản phẩm (₫)
              <MoneyInput name="price" value={price} onChange={setPrice} />
            </label>
            <label>
              Mô tả
              <textarea
                name="description"
                maxLength={2000}
                rows={3}
                defaultValue={editing === "new" ? "" : editing.description}
              />
            </label>
            {imageUploadsVisible && <div className="product-photo-picker">
              <label className="upload-label">
                <span className="upload-icon"><ImagePlus size={21} /></span>
                <span className="upload-copy"><strong>Chọn ảnh sản phẩm</strong><small>JPG, PNG, WebP · Tối đa 3 MB/ảnh</small></span>
                <span className="upload-count">{savedImages + files.length}/3</span>
                <input type="file" aria-label="Chọn ảnh sản phẩm" multiple accept="image/jpeg,image/png,image/webp" disabled={pending || savedImages + files.length >= 3}
                  onChange={(e) => {
                    const selected = Array.from(e.target.files ?? []);
                    e.target.value = "";
                    if (selected.length + files.length + savedImages > 3) { setError("Mỗi sản phẩm tối đa 3 ảnh."); return; }
                    if (selected.some((file) => !["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 3 * 1024 * 1024)) { setError("Chọn JPG, PNG hoặc WebP, tối đa 3 MB mỗi ảnh."); return; }
                    setError(""); setFiles((current) => [...current, ...selected]);
                  }} />
              </label>
              <small>Ảnh được tải lên khi lưu sản phẩm.</small>
              {savedImages > 0 && <small>Đã lưu {savedImages} ảnh. Ảnh thay đổi khi bấm lưu.</small>}
              <div className="photo-previews">{editing !== "new" && editing.images.filter((image) => !deletedImages.includes(image.id)).map((image) => <div key={image.id}><img src={`/api/images/${image.id}`} alt={editing.name} /><button type="button" className="secondary" disabled={pending} onClick={() => { setDeletedImages((ids) => [...ids, image.id]); setSavedImages((count) => count - 1); }}>Bỏ ảnh</button></div>)}{files.map((file, i) => <div key={`${file.name}-${i}`}>
                {previews[i] && <img src={previews[i]} alt={`Ảnh đã chọn ${i + 1}`} />}
                <button type="button" className="secondary" disabled={pending} onClick={() => setFiles((current) => current.filter((_, index) => index !== i))}>Bỏ ảnh {i + 1}</button>
              </div>)}</div>
            </div>}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                disabled={pending}
                onClick={() => setEditing(null)}
              >
                Hủy
              </button>
              <button className="primary" disabled={pending}>
                {pending ? (uploadProgress || "Đang lưu…") : "Lưu sản phẩm"}
              </button>
            </div>
          </form>
        )}
      </dialog>
    </section>
  );
}
