import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { getAdminUser, NOT_ADMIN_MESSAGE } from "@/server/auth/admin"
import {
  checkUploadBytes,
  generateUploadName,
  UPLOAD_DIR,
  UPLOAD_MAX_BYTES,
  UPLOAD_MAX_FILES,
  uploadUrl,
  type UploadImageType,
} from "@/server/uploads"

export const runtime = "nodejs"

// Phần multipart ngoài dung lượng file (boundary, tên trường…): dư ra để không từ chối nhầm; file thật vẫn bị chặn riêng ở dưới.
const BODY_OVERHEAD = 256 * 1024
const MAX_BODY_BYTES = UPLOAD_MAX_FILES * UPLOAD_MAX_BYTES + BODY_OVERHEAD

const fail = (status: number, message: string) => NextResponse.json({ message }, { status })

/** Chặn form từ trang khác: nếu trình duyệt gửi Origin thì phải cùng host với yêu cầu. */
function isSameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin")
  if (!origin) return true
  try {
    return new URL(origin).host === (req.headers.get("host") ?? new URL(req.url).host)
  } catch {
    return false
  }
}

/*
 * POST multipart, trường "files" (tối đa UPLOAD_MAX_FILES ảnh): chỉ Admin.
 * Mọi file được kiểm hết rồi mới ghi (một file lỗi thì không ghi file nào). Loại file quyết định bởi magic bytes,
 * tên file do server sinh; Content-Type/tên/đuôi của client bị bỏ qua hoàn toàn.
 * Trả { url (ảnh đầu), urls: ["/uploads/<uuid>.<ext>", ...] } theo đúng thứ tự gửi lên.
 */
export async function POST(req: Request) {
  // getAdminUser() là cổng đầu tiên: chưa đăng nhập, khách hay bị khoá đều bị từ chối trước khi đọc thân yêu cầu.
  const admin = await getAdminUser()
  if (!admin) return fail(403, NOT_ADMIN_MESSAGE)
  if (!isSameOrigin(req)) return fail(403, "Yêu cầu không hợp lệ")

  const declared = Number(req.headers.get("content-length"))
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return fail(413, "Dữ liệu tải lên quá lớn")

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return fail(400, "Dữ liệu tải lên không hợp lệ")
  }

  const files = form.getAll("files").filter((v): v is File => typeof v !== "string")
  if (files.length === 0) return fail(400, "Chưa chọn ảnh nào")
  if (files.length > UPLOAD_MAX_FILES) return fail(400, `Mỗi lần chỉ tải tối đa ${UPLOAD_MAX_FILES} ảnh`)

  const checked: { buf: Uint8Array; type: UploadImageType }[] = []
  for (const file of files) {
    if (file.size > UPLOAD_MAX_BYTES) return fail(413, `Ảnh quá lớn (tối đa ${Math.round(UPLOAD_MAX_BYTES / (1024 * 1024))}MB mỗi ảnh)`)
    const buf = new Uint8Array(await file.arrayBuffer())
    const r = checkUploadBytes(buf)
    if (!r.ok) return fail(415, r.message)
    checked.push({ buf, type: r.type })
  }

  await mkdir(UPLOAD_DIR, { recursive: true })
  const urls: string[] = []
  for (const { buf, type } of checked) {
    const name = generateUploadName(type)
    // flag "wx": không bao giờ ghi đè file có sẵn. path.join an toàn vì `name` là UUID + đuôi do server sinh.
    await writeFile(path.join(UPLOAD_DIR, name), buf, { flag: "wx" })
    urls.push(uploadUrl(name))
  }
  return NextResponse.json({ url: urls[0], urls }, { status: 201 })
}
