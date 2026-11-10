import "server-only"
import { NextResponse } from "next/server"
import type { ZodType } from "zod"
import { CartError, type CartErrorCode } from "@/server/services/cart.service"

const STATUS: Record<CartErrorCode, number> = {
  INVALID_QUANTITY: 400,
  VARIANT_NOT_FOUND: 404,
  ITEM_NOT_FOUND: 404,
  OUT_OF_STOCK: 409,
  INSUFFICIENT_STOCK: 409,
}

export function jsonError(code: string, message: string, status: number, available?: number) {
  return NextResponse.json({ error: { code, message, available } }, { status })
}

export const unauthenticated = () => jsonError("UNAUTHENTICATED", "Vui lòng đăng nhập để dùng giỏ hàng", 401)

/** Chạy handler, đổi CartError thành JSON lỗi có mã + thông báo tiếng Việt để client hiện toast. */
export async function withCartErrors(run: () => Promise<Response>): Promise<Response> {
  try {
    return await run()
  } catch (e) {
    if (e instanceof CartError) return jsonError(e.code, e.message, STATUS[e.code], e.available)
    throw e
  }
}

/** Đọc + validate JSON body; trả về Response lỗi 400 nếu không hợp lệ. */
export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { error: Response }> {
  const raw: unknown = await req.json().catch(() => null)
  const parsed = schema.safeParse(raw)
  if (parsed.success) return { data: parsed.data }
  return { error: jsonError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", 400) }
}

