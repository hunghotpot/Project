import { z } from "zod"

// Số sản phẩm tối đa cho một section trên trang chủ.
export const sectionLimitSchema = z.number().int().min(1).max(48)
