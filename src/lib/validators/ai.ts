import { z } from "zod"

/*
 * Zod schema cho tầng AI (docs/ai/03-rag-advisor.md, 04-tool-calling.md). Hiện mới có đầu vào tư vấn size;
 * các schema còn lại (searchIntent, outfit, uiAction...) sẽ thêm vào đây khi làm tới.
 */

// Khoảng hợp lệ cũng là khoảng của form nhập số đo ở UI (size-info-card).
const measure = (min: number, max: number) => z.number().min(min).max(max).optional()

export const sizeAdviceInputSchema = z.object({
  productSlug: z.string().trim().min(1).max(100),
  heightCm: measure(100, 230),
  weightKg: measure(25, 250),
  chestCm: measure(60, 160),
  waistCm: measure(45, 160),
  hipCm: measure(60, 170),
  fit: z.enum(["tight", "regular", "loose"]).default("regular"),
})

export type SizeAdviceRequest = z.input<typeof sizeAdviceInputSchema>
