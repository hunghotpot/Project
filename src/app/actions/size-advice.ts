"use server"

import { sizeAdviceInputSchema } from "@/lib/validators/ai"
import { getCurrentUser } from "@/server/auth/session"
import { adviseSizeForProduct, type SizeAdviceResult } from "@/server/ai/advisor/size.service"

export type SizeAdviceActionResult = ({ ok: true } & SizeAdviceResult) | { ok: false; message: string }

// Trợ lý chỉ dành cho người đã đăng nhập. Chỉ đọc bảng size và tồn kho của sản phẩm, tính bằng code, không gọi LLM.
export async function getSizeAdviceAction(input: unknown): Promise<SizeAdviceActionResult> {
  const user = await getCurrentUser()
  if (!user) return { ok: false, message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." }

  const parsed = sizeAdviceInputSchema.safeParse(input)
  if (!parsed.success) return { ok: false, message: "Số đo chưa hợp lệ, bạn kiểm tra lại giúp mình nhé." }

  const result = await adviseSizeForProduct(parsed.data)
  if (!result) return { ok: false, message: "Không tìm thấy sản phẩm này." }
  return { ok: true, ...result }
}
