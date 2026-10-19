"use client";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Plus, X, Package, ImagePlus, Eye } from "lucide-react";
import type { OrderView, ProductView, OrderItemInput } from "@/lib/validation";
import MoneyInput from "./money-input";
import { saveProduct } from "@/app/actions";
import ProductSuggestionsPopup from "./product-suggestions-popup";
import ProductImagePreview from "./product-image-preview";
import { uploadProductImage } from "@/lib/client-image-upload";
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/gi, "d").toLowerCase().trim();
const money = (value: number) => new Intl.NumberFormat("vi-VN").format(value) + " ₫";
type Row = OrderItemInput & { key: number; priceText: string };
export default function OrderProductFields({ order, products, onPrice, prepareRef }: {
  order: OrderView | "new"; products: ProductView[]; onPrice: (price: number) => void; prepareRef: { current: ((form: FormData) => Promise<void>) | null };
}) {
  const [rows, setRows] = useState<Row[]>(() => (order === "new"
    ? [{ name: "", productId: null, quantity: 1, unitPrice: 0 }]
    : order.items?.length ? order.items : [{ name: order.product, productId: order.productId, quantity: 1, unitPrice: order.price - (order.shippingFee ?? 0) + (order.discount ?? 0) }]
  ).map((item, key) => ({ ...item, key, priceText: order === "new" ? "" : String(item.unitPrice) })));
  const [nextKey, setNextKey] = useState(rows.length);
  const [focused, setFocused] = useState<number | null>(null);
  const [active, setActive] = useState(-1);
  const [addedProducts, setAddedProducts] = useState<ProductView[]>([]);
  const savingKey: number | null = null;
  const [uploadProgress, setUploadProgress] = useState("");
  const [quickError, setQuickError] = useState("");
  const catalog = [...products.filter((product) => !addedProducts.some((item) => item.id === product.id)), ...addedProducts];
  const draftFiles = useRef(new Map<string, { file: File; url: string }>());
  const resolved = useRef(new Map<string, string>());
  useEffect(() => () => { draftFiles.current.forEach(({ url }) => URL.revokeObjectURL(url)); }, []);
  async function quickAdd(row: Row, file?: File) {
    const id = row.productId || `draft-${crypto.randomUUID()}`;
    if (file && row.productId && !addedProducts.some((product) => product.id === id)) return;
    const previous = draftFiles.current.get(id);
    if (file) {
      if (previous) URL.revokeObjectURL(previous.url);
      draftFiles.current.set(id, { file, url: URL.createObjectURL(file) });
    }
    const photo = draftFiles.current.get(id);
    const product: ProductView = { id, name: row.name.trim(), price: row.unitPrice, description: "", archived: false, images: photo ? [{ id: photo.url, slot: 1 }] : [] };
    setAddedProducts((items) => [...items.filter((item) => item.id !== id), product]);
    setRows((items) => items.map((item) => item.key === row.key ? { ...item, productId: id } : item));
    setFocused(null); setQuickError("");
  }
  prepareRef.current = async (form) => {
    const items: OrderItemInput[] = JSON.parse(String(form.get("items")));
    for (const item of items) {
      const draftId = item.productId;
      if (!draftId?.startsWith("draft-")) continue;
      let id = resolved.current.get(draftId);
      if (!id) {
        const data = new FormData(); data.set("name", item.name); data.set("price", String(item.unitPrice)); data.set("description", "");
        const result = await saveProduct(data);
        if (!result.id || result.error) throw new Error(result.error || "Chưa lưu được sản phẩm.");
        id = result.id; resolved.current.set(draftId, id);
      }
      const photo = draftFiles.current.get(draftId);
      if (photo) {
        const result = await uploadProductImage(id, photo.file, setUploadProgress);
        draftFiles.current.delete(draftId); URL.revokeObjectURL(photo.url);
        setAddedProducts((products) => products.map((product) => product.id === draftId ? { ...product, images: [{ id: result.id, slot: 1 }] } : product));
      }
      item.productId = id;
    }
    form.set("items", JSON.stringify(items));
  };
  const listId = useId();
  async function removeQuickImage(row: Row, imageId: string) {
    if (!row.productId || !imageId.startsWith("blob:")) return;
    const photo = draftFiles.current.get(row.productId);
    if (photo) URL.revokeObjectURL(photo.url);
    draftFiles.current.delete(row.productId);
    setAddedProducts((products) => products.map((product) => product.id === row.productId ? { ...product, images: [] } : product));
  }
  const list = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const element = list.current;
    if (!element) return;
    const measure = () => {
      const first = element.children[0] as HTMLElement | undefined;
      if (!first) return;
      const suggestions = first.querySelector<HTMLElement>(".product-suggestions");
      const suggestionHeight = suggestions ? suggestions.offsetHeight + parseFloat(getComputedStyle(suggestions).marginTop) : 0;
      element.style.height = `${(first.offsetHeight - suggestionHeight) * 3}px`;
    };
    const observer = new ResizeObserver(measure);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    measure();
    return () => observer.disconnect();
  }, [rows.length]);
  function commit(next: Row[]) {
    setRows(next); onPrice(next.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0));
  }
  function update(key: number, values: Partial<Row>) { commit(rows.map((row) => row.key === key ? { ...row, ...values } : row)); }
  function choose(key: number, product: ProductView) {
    update(key, { productId: product.id, name: product.name, unitPrice: product.price, priceText: String(product.price) }); setFocused(null); setActive(-1);
  }
  return <section className="order-section order-products">
    <div className="order-section-heading"><h3>Sản phẩm</h3><small>{rows.length} dòng · {rows.reduce((sum, row) => sum + row.quantity, 0)} sản phẩm</small></div>
    <input type="hidden" name="items" value={JSON.stringify(rows.map(({ key: _key, priceText: _priceText, ...item }) => item))} />
    <div ref={list} className={`order-items-scroll${rows.length > 3 ? " is-scrollable" : ""}`} role="region" aria-label="Sản phẩm trong đơn" tabIndex={rows.length > 3 ? 0 : undefined}>
    {rows.map((row, index) => {
      const terms = normalize(row.name).split(/\s+/).filter(Boolean);
      const suggestions = catalog.filter((product) => !product.archived && terms.every((term) => normalize(product.name).includes(term))).slice(0, 8);
      const canQuickAdd = !row.productId && row.name.trim();
      const expanded = focused === row.key && !row.productId;
      const imageId = catalog.find((product) => product.id === row.productId)?.images[0]?.id;
      return <div className="order-item-row" key={row.key}>
        <div className="order-item-search order-item-with-image">
          <div className="order-item-photo">
            {imageId ? <img src={imageId.startsWith("blob:") ? imageId : `/api/images/${imageId}`} alt={row.name} /> : <Package size={22} aria-label="Chưa có ảnh sản phẩm" />}
            {imageId?.startsWith("blob:") && addedProducts.some((product) => product.id === row.productId) && <button type="button" className="quick-image-remove" aria-label={`Xóa ảnh ${row.name}`} title="Xóa ảnh" disabled={savingKey !== null} onClick={() => void removeQuickImage(row, imageId)}><X size={14} /></button>}
            <div className="order-photo-actions">
              {imageId ? <ProductImagePreview id={imageId} name={row.name} iconOnly /> : <button type="button" disabled aria-label="Chưa có ảnh để xem"><Eye size={15} /></button>}
              {(!row.productId || addedProducts.some((product) => product.id === row.productId)) && <label className="order-photo-upload" title="Thêm ảnh sản phẩm"><ImagePlus size={15} /><input type="file" aria-label="Thêm ảnh sản phẩm" accept="image/jpeg,image/png,image/webp" disabled={savingKey !== null || !row.name.trim() || (catalog.find((product) => product.id === row.productId)?.images.length ?? 0) >= 3} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) { if (file.size > 3 * 1024 * 1024) setQuickError("Chọn ảnh tối đa 3 MB."); else void quickAdd(row, file); } }} /></label>}
            </div>
          </div>
          <label>{index === 0 ? "Sản phẩm" : `Sản phẩm ${index + 1}`}
            <input role="combobox" aria-expanded={expanded} aria-controls={expanded ? `${listId}-${row.key}` : undefined}
              aria-autocomplete="list" aria-activedescendant={expanded && active >= 0 ? `${listId}-${row.key}-${active}` : undefined}
              required maxLength={160} autoComplete="off" placeholder="Nhập tên sản phẩm…" value={row.name}
              onFocus={() => { setFocused(row.key); setActive(-1); }} onBlur={() => { setFocused(null); setActive(-1); }}
              onChange={(event) => { update(row.key, { name: event.target.value, productId: null }); setFocused(row.key); setActive(-1); }}
              onKeyDown={(event) => {
                if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setFocused(null); }
                if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setFocused(row.key); setActive((old) => Math.max(-1, Math.min(suggestions.length - 1 + (canQuickAdd ? 1 : 0), old + (event.key === "ArrowDown" ? 1 : -1)))); }
                if (event.key === "Enter") { event.preventDefault(); if (expanded && canQuickAdd && active === 0) void quickAdd(row); else if (expanded && active >= 0 && suggestions[active - (canQuickAdd ? 1 : 0)]) choose(row.key, suggestions[active - (canQuickAdd ? 1 : 0)]); else setFocused(null); }
              }} />
          </label>
          {expanded && <ProductSuggestionsPopup id={`${listId}-${row.key}`} label={`Sản phẩm gợi ý ${index + 1}`}>
            {canQuickAdd && <button type="button" role="option" aria-selected={active === 0} id={`${listId}-${row.key}-0`} className="quick-add-suggestion" disabled={savingKey !== null} onPointerDown={(event) => event.preventDefault()} onClick={() => quickAdd(row)}><Plus size={18} /><span>{savingKey === row.key ? "Đang thêm…" : <>Thêm nhanh sản phẩm: <b>{row.name.trim()}</b></>}</span></button>}
            {suggestions.map((product, option) => <button type="button" role="option" aria-selected={active === option + (canQuickAdd ? 1 : 0)} id={`${listId}-${row.key}-${option + (canQuickAdd ? 1 : 0)}`} key={product.id}
              onPointerDown={(event) => event.preventDefault()} onClick={() => choose(row.key, product)}>
              <span className="suggestion-product-photo">{product.images[0] ? <img src={`/api/images/${product.images[0].id}`} alt="" loading="lazy" /> : <Package size={22} />}</span><span>{product.name}</span><strong>{money(product.price)}</strong>
            </button>)}
            {!suggestions.length && <p>Chưa có sản phẩm tương tự trong danh mục.</p>}
          </ProductSuggestionsPopup>}
        </div>
        <label className="item-price">Đơn giá (₫)<MoneyInput name={`item-price-${row.key}`} value={row.priceText} onChange={(value) => update(row.key, { unitPrice: Number(value), priceText: value })} /></label>
        <label className="item-quantity">Số lượng<input type="number" inputMode="numeric" min={1} max={9999} required value={row.quantity || ""} onChange={(event) => update(row.key, { quantity: Number(event.target.value) })} /></label>
        <div className="item-subtotal"><strong>{money(row.quantity * row.unitPrice)}</strong></div>
        <button type="button" className="icon-button danger-text item-remove" aria-label={`Xóa sản phẩm ${index + 1}`} disabled={rows.length === 1} onClick={() => commit(rows.filter((item) => item.key !== row.key))}><X size={17} /></button>
      </div>;
    })}
    </div>
    {uploadProgress && <p role="status">{uploadProgress}</p>}
    {quickError && <p role="alert">{quickError}</p>}
    <button type="button" className="secondary add-order-product" disabled={rows.length >= 100} onClick={() => {
      commit([...rows, { key: nextKey, name: "", productId: null, quantity: 1, unitPrice: 0, priceText: "" }]); setNextKey(nextKey + 1);
    }}><Plus size={17} />Thêm sản phẩm</button>
  </section>;
}
