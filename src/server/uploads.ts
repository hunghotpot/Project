import "server-only"
import { randomUUID } from "node:crypto"
import path from "node:path"

/*
 * Tải ảnh sản phẩm của Admin vào public/uploads.
 * File này chỉ gồm HÀM THUẦN (nhận diện loại file, kiểm tên, sinh tên) và hằng số để test được không cần DOM/ổ đĩa;
 * việc đọc/ghi file nằm ở route handler (src/app/api/admin/uploads, src/app/uploads/[name]).
 * Nguyên tắc: không tin Content-Type, đuôi file hay tên file do client gửi. Loại file chỉ được quyết định bởi
 * chữ ký byte đầu file; tên file lưu trên đĩa do server sinh.
 */

export const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads")

/** Dung lượng tối đa mỗi ảnh. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024
/** Số ảnh tối đa mỗi lần tải (khớp MAX_PRODUCT_IMAGES của sản phẩm). */
export const UPLOAD_MAX_FILES = 4

export type UploadImageType = "jpeg" | "png" | "webp"

export const UPLOAD_EXTENSION: Record<UploadImageType, string> = { jpeg: "jpg", png: "png", webp: "webp" }
export const UPLOAD_CONTENT_TYPE: Record<UploadImageType, string> = { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" }

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length && signature.every((b, i) => bytes[offset + i] === b)

/** Nhận diện bằng magic bytes: JPEG (FF D8 FF), PNG (89 50 4E 47 0D 0A 1A 0A), WebP ("RIFF" + 4 byte cỡ + "WEBP"). Khác → null. */
export function detectImageType(bytes: Uint8Array): UploadImageType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg"
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png"
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return "webp"
  return null
}

export type UploadCheck = { ok: true; type: UploadImageType } | { ok: false; message: string }

/** Kiểm một file đã đọc vào bộ nhớ: không rỗng, không quá lớn, nội dung thật sự là JPEG/PNG/WebP. */
export function checkUploadBytes(bytes: Uint8Array, maxBytes = UPLOAD_MAX_BYTES): UploadCheck {
  if (bytes.length === 0) return { ok: false, message: "File ảnh rỗng" }
  if (bytes.length > maxBytes) return { ok: false, message: `Ảnh quá lớn (tối đa ${Math.round(maxBytes / (1024 * 1024))}MB mỗi ảnh)` }
  const type = detectImageType(bytes)
  if (!type) return { ok: false, message: "Chỉ nhận ảnh JPG, PNG hoặc WebP hợp lệ" }
  return { ok: true, type }
}

/** Tên file lưu trên đĩa: UUID do server sinh + đuôi theo loại ĐÃ xác thực. Không dùng bất kỳ chuỗi nào từ client. */
export function generateUploadName(type: UploadImageType, uuid: string = randomUUID()): string {
  return `${uuid}.${UPLOAD_EXTENSION[type]}`
}

// Chỉ đúng dạng server sinh ra: UUID chữ thường + một trong ba đuôi. Không cho phép `/`, `\`, `..`, khoảng trắng, NUL…
const UPLOAD_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/

export function isSafeUploadName(name: string): boolean {
  return UPLOAD_NAME.test(name)
}

/** Content-Type theo đuôi của tên ĐÃ qua isSafeUploadName; null nếu tên không hợp lệ. */
export function contentTypeForUploadName(name: string): string | null {
  const m = UPLOAD_NAME.exec(name)
  if (!m) return null
  return m[1] === "jpg" ? UPLOAD_CONTENT_TYPE.jpeg : m[1] === "png" ? UPLOAD_CONTENT_TYPE.png : UPLOAD_CONTENT_TYPE.webp
}

/** URL công khai của file đã lưu. */
export const uploadUrl = (name: string) => `/uploads/${name}`
