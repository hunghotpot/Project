import { z } from "zod"

// Ô tìm kiếm ở header: chuyển sang /products?q=...
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
})

export type SearchQuery = z.infer<typeof searchQuerySchema>
