"use client";
import { useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Eye } from "lucide-react";
import { useState } from "react";

export default function ProductImagePreview({ id, name, iconOnly = false }: { id: string; name: string; iconOnly?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [opened, setOpened] = useState(false);
  const attachDialog = useCallback((element: HTMLDialogElement | null) => {
    dialog.current = element;
    if (element && !element.open) element.showModal();
  }, []);
  const close = () => { dialog.current?.close(); setOpened(false); };
  return <>
    <button type="button" className="product-image-trigger" aria-label={`Xem ảnh ${name}`} onClick={() => setOpened(true)}>
      {iconOnly ? <Eye size={15} /> : <img src={id.startsWith("blob:") ? id : `/api/images/${id}`} alt={name} loading="lazy" draggable={false} />}
    </button>
    {opened && createPortal(<dialog ref={attachDialog} onPointerDown={(event) => event.stopPropagation()} onPointerMove={(event) => event.stopPropagation()} onPointerUp={(event) => event.stopPropagation()} onPointerCancel={(event) => event.stopPropagation()} className="product-image-dialog" aria-label={`Ảnh ${name}`} onClose={() => setOpened(false)} onClick={(event) => { event.stopPropagation(); if (event.target === event.currentTarget) close(); }}>
      <button type="button" className="image-preview-close" aria-label="Đóng ảnh" onClick={close} autoFocus><X size={22} /></button>
      <img src={id.startsWith("blob:") ? id : `/api/images/${id}`} alt={name} />
    </dialog>, document.body)}
  </>;
}
