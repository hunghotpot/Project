import { beforeEach, describe, expect, it, vi } from "vitest"

const { readFile } = vi.hoisted(() => ({ readFile: vi.fn() }))
vi.mock("node:fs/promises", () => ({ readFile, default: { readFile } }))

import { GET } from "./route"

const ID = "123e4567-e89b-42d3-a456-426614174000"
const call = (name: string) => GET(new Request("http://localhost/uploads/x"), { params: Promise.resolve({ name }) })

describe("GET /uploads/[name]", () => {
  beforeEach(() => readFile.mockReset())

  it("phục vụ file hợp lệ với Content-Type và cache đúng", async () => {
    readFile.mockResolvedValue(Buffer.from([1, 2, 3]))
    const res = await call(`${ID}.webp`)
    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("image/webp")
    expect(res.headers.get("cache-control")).toContain("immutable")
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
    expect(String(readFile.mock.calls[0][0])).toMatch(/uploads/)
  })

  it("tên lạ / chứa ../ bị 404 và không đọc đĩa", async () => {
    for (const bad of ["../package.json", "..%2Fpackage.json", "a.jpg", `${ID}.svg`, `${ID}.jpg/../x`, ""]) {
      expect((await call(bad)).status).toBe(404)
    }
    expect(readFile).not.toHaveBeenCalled()
  })

  it("file không tồn tại → 404", async () => {
    readFile.mockRejectedValueOnce(new Error("ENOENT"))
    const res = await call(`${ID}.jpg`)
    expect(res.status).toBe(404)
  })
})
