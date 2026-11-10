import { create } from "zustand"

// Trạng thái đóng/mở của cart drawer (icon giỏ ở header mở, thêm sản phẩm xong cũng mở).
export const useCartUi = create<{ open: boolean; setOpen: (open: boolean) => void }>((set) => ({
  open: false,
  setOpen: (open) => set({ open }),
}))
