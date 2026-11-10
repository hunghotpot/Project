import { create } from "zustand"

// Cờ "đang chuyển URL bộ lọc": useProductFilters ghi, lưới sản phẩm đọc để làm mờ trong lúc chờ server.
export const useFilterPending = create<{ pending: boolean; setPending: (v: boolean) => void }>((set) => ({
  pending: false,
  setPending: (pending) => set({ pending }),
}))
