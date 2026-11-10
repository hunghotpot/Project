import { z } from "zod"

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; message?: string; fieldErrors?: Record<string, string> }

/** Như fieldErrorsFrom nhưng cho schema lồng nhau: khoá là đường dẫn đầy đủ, vd "shipping.address.street". */
export function fieldErrorsByPath(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".")
    if (key && !(key in out)) out[key] = issue.message
  }
  return out
}

/** Gom lỗi Zod thành { tên field: thông báo đầu tiên } để form hiện đúng từng ô. */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [field, messages] of Object.entries(z.flattenError(error).fieldErrors)) {
    const first = (messages as string[] | undefined)?.[0]
    if (first) out[field] = first
  }
  return out
}
