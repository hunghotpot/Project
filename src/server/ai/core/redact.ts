/*
 * Che thông tin cá nhân và bí mật trước khi đưa vào prompt hoặc log (docs/ai/05-safety-and-guardrails.md mục 5).
 * Hai lớp: bỏ hẳn các trường nhạy cảm theo tên, và che email, số điện thoại, token trong mọi chuỗi còn lại.
 * Đây là lưới an toàn; nguồn dữ liệu của tool vẫn phải trả DTO rút gọn ngay từ đầu.
 */

/** Tên trường bị bỏ hẳn (không phân biệt hoa thường, khớp một phần tên). */
const SENSITIVE_KEY = /password|passwordhash|token|secret|authorization|cookie|api[-_]?key|email|phone|fullname|street|ward|district|province|address|note/i

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
// Số điện thoại Việt Nam: 0xxxxxxxxx hoặc +84xxxxxxxxx, cho phép dấu cách, chấm, gạch ngang giữa các số.
const PHONE = /(?<![\d])(?:\+?84|0)(?:[\s.-]?\d){8,10}(?![\d])/g
const BEARER = /Bearer\s+[A-Za-z0-9._~+/=-]+/gi
const ENV_SECRET = /\b(?:VNP|JWT|CRON|AI)_[A-Z_]+\b(?:\s*[=:]\s*\S+)?/g

const MAX_TEXT_CHARS = 600
const MAX_DEPTH = 6

export function redactText(text: string, maxChars = MAX_TEXT_CHARS): string {
  const masked = text
    .replace(BEARER, "Bearer [ẩn]")
    .replace(ENV_SECRET, "[ẩn]")
    .replace(EMAIL, "[email]")
    .replace(PHONE, "[sđt]")
  return masked.length > maxChars ? `${masked.slice(0, maxChars)}…` : masked
}

function walk(value: unknown, depth: number): unknown {
  if (typeof value === "string") return redactText(value)
  if (value === null || typeof value !== "object") return value
  if (value instanceof Date) return value.toISOString()
  if (depth >= MAX_DEPTH) return undefined
  if (Array.isArray(value)) return value.map((v) => walk(v, depth + 1))
  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(key)) continue
    out[key] = walk(v, depth + 1)
  }
  return out
}

/**
 * Bản sao an toàn để đưa vào prompt: bỏ trường nhạy cảm, che email/SĐT/token trong chuỗi, cắt chuỗi dài (600 ký tự),
 * đổi Date thành chuỗi ISO, cắt độ sâu quá 6 tầng.
 */
export function redactForPrompt<T>(value: T): T {
  return walk(value, 0) as T
}
