"use client";
import { useRef, useState } from "react";
import { Flower2 } from "lucide-react";
import type { ProductView } from "@/lib/validation";
export default function ProductGallery({ product }: {
  product: ProductView;
}) {
  const track = useRef<HTMLDivElement>(null);
  const gesture = useRef({ x: 0, y: 0, moved: false });
  const [active, setActive] = useState(0);
  function go(index: number) {
    const element = track.current;
    if (!element) return;
    element.scrollTo({ left: index * element.clientWidth, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }
  return <div className="product-gallery" role="region" aria-label={`Ảnh sản phẩm ${product.name}`}>
    <div className="product-images"
      onPointerDown={(event) => { gesture.current = { x: event.clientX, y: event.clientY, moved: false }; }}
      onPointerMove={(event) => { if (Math.abs(event.clientX - gesture.current.x) + Math.abs(event.clientY - gesture.current.y) > 8) gesture.current.moved = true; }}
      onPointerCancel={() => { gesture.current.moved = true; }}
      onClickCapture={(event) => { if (gesture.current.moved) { event.preventDefault(); event.stopPropagation(); } }}
      ref={track} tabIndex={product.images.length > 1 ? 0 : undefined}
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault(); go(Math.max(0, Math.min(product.images.length - 1, active + (event.key === "ArrowRight" ? 1 : -1))));
        }
      }}
      onScroll={(event) => { const el = event.currentTarget; setActive(Math.round(el.scrollLeft / Math.max(1, el.clientWidth))); }}>
      {product.images.length ? product.images.map((image, i) => <div key={image.id}>
        <img src={`/api/images/${image.id}`} alt={`${product.name} — ảnh ${i + 1}`} loading="lazy" draggable={false} />
      </div>) : <div className="product-placeholder"><Flower2 size={40} strokeWidth={1} /></div>}
    </div>
    {product.images.length > 1 && <div className="product-gallery-dots" aria-label="Chọn ảnh">
      {product.images.map((image, i) => <button key={image.id} type="button" aria-label={`Xem ảnh ${i + 1} của ${product.name}`} aria-pressed={active === i} onClick={() => go(i)}><span /></button>)}
    </div>}
  </div>;
}
