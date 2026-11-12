import { beforeEach, describe, expect, it, vi } from "vitest"

const getAdminUser = vi.fn()
const mkdir = vi.fn()
const writeFile = vi.fn()

vi.mock("@/server/auth/admin", () => ({
  getAdminUser: () => getAdminUser(),
  NOT_ADMIN_MESSAGE: "Bạn không có quyền thực hiện thao tác này",
}))
vi.mock("node:fs/promises", () => ({
  mkdir: (...a: unknown[]) => mkdir(...a),
  writeFile: (...a: unknown[]) => writeFile(...a),
}))

import { POST } from "./route"

const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46])
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0])

const file = (bytes: Uint8Array | string, name: string, type: string) =>
  new File([typeof bytes === "string" ? bytes : (bytes as BlobPart)], name, { type })

function request(files: File[], headers: Record<string, string> = {}) {
  const form = new FormData()
  for (const f of files) form.append("files", f)
  return new Request("http://localhost/api/admin/uploads", { method: "POST", body: form, headers })
}

describe("POST /api/admin/uploads", () => {
  beforeEach(() => {
    getAdminUser.mockReset()
    mkdir.mockReset()
    writeFile.mockReset()
    getAdminUser.mockResolvedValue({ id: "admin-1", role: "ADMIN" })
  })

  it("khách / chưa đăng nhập bị từ chối và không ghi file", async () => {
    getAdminUser.mockResolvedValue(null)
    const res = await POST(request([file(JPEG, "a.jpg", "image/jpeg")]))
    expect(res.status).toBe(403)
    expect(writeFile).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()
  })

  it("Admin: ghi file với tên UUID do server sinh, bỏ qua tên client", async () => {
    const res = await POST(request([file(JPEG, "../../evil.php", "image/jpeg"), file(PNG, "x.jpg", "text/html")]))
    expect(res.status).toBe(201)
    const body = (await res.json()) as { url: string; urls: string[] }
    expect(body.urls).toHaveLength(2)
    expect(body.urls[0]).toMatch(/^\/uploads\/[0-9a-f-]{36}\.jpg$/)
    expect(body.urls[1]).toMatch(/^\/uploads\/[0-9a-f-]{36}\.png$/) // đuôi theo nội dung thật, không theo tên .jpg của client
    expect(body.url).toBe(body.urls[0])
    expect(writeFile).toHaveBeenCalledTimes(2)
    for (const call of writeFile.mock.calls) {
      expect(String(call[0])).not.toContain("evil")
      expect(call[2]).toEqual({ flag: "wx" })
    }
  })

  it("file giả ảnh (nội dung HTML, đuôi .jpg) bị từ chối, không ghi file nào", async () => {
    const res = await POST(request([file(JPEG, "ok.jpg", "image/jpeg"), file("<script>alert(1)</script>", "fake.jpg", "image/jpeg")]))
    expect(res.status).toBe(415)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it("quá số ảnh cho phép bị từ chối", async () => {
    const res = await POST(request(Array.from({ length: 5 }, (_, i) => file(JPEG, `${i}.jpg`, "image/jpeg"))))
    expect(res.status).toBe(400)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it("không có file nào bị từ chối", async () => {
    const res = await POST(request([]))
    expect(res.status).toBe(400)
  })

  it("Content-Length khai báo quá lớn bị chặn trước khi đọc thân", async () => {
    const res = await POST(request([file(JPEG, "a.jpg", "image/jpeg")], { "content-length": String(100 * 1024 * 1024) }))
    expect(res.status).toBe(413)
    expect(writeFile).not.toHaveBeenCalled()
  })

  it("Origin khác host bị từ chối", async () => {
    const res = await POST(request([file(JPEG, "a.jpg", "image/jpeg")], { origin: "https://evil.example", host: "localhost" }))
    expect(res.status).toBe(403)
    expect(writeFile).not.toHaveBeenCalled()
  })
})
