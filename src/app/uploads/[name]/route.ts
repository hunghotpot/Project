import { readFile } from "node:fs/promises"
import path from "node:path"
import { contentTypeForUploadName, isSafeUploadName, UPLOAD_DIR } from "@/server/uploads"

export const runtime = "nodejs"

const notFound = () => new Response("Not found", { status: 404 })

/*
 * Phục vụ ảnh đã tải lên. Next production chỉ phát file trong public/ có từ lúc khởi động nên ảnh mới tải phải qua route này.
 * `name` phải khớp đúng dạng server sinh (UUID + jpg/png/webp), nên không thể thoát khỏi thư mục uploads.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params
  const contentType = isSafeUploadName(name) ? contentTypeForUploadName(name) : null
  if (!contentType) return notFound()

  let data: Buffer
  try {
    data = await readFile(path.join(UPLOAD_DIR, name))
  } catch {
    return notFound()
  }
  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(data.length),
      // Tên là UUID, nội dung không đổi → cache dài và immutable được.
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
}
