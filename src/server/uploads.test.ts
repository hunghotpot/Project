import { describe, expect, it } from "vitest"
import {
  checkUploadBytes,
  contentTypeForUploadName,
  detectImageType,
  generateUploadName,
  isSafeUploadName,
  UPLOAD_MAX_BYTES,
} from "./uploads"

const bytes = (...b: number[]) => Uint8Array.from(b)
const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46)
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0)
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50)
const text = (s: string) => new TextEncoder().encode(s)

describe("detectImageType (magic bytes)", () => {
  it("nhận đúng JPEG, PNG, WebP", () => {
    expect(detectImageType(JPEG)).toBe("jpeg")
    expect(detectImageType(PNG)).toBe("png")
    expect(detectImageType(WEBP)).toBe("webp")
  })

  it("từ chối nội dung khác dù client đặt đuôi .jpg (HTML, SVG, script, GIF, PDF)", () => {
    expect(detectImageType(text("<html><script>alert(1)</script></html>"))).toBeNull()
    expect(detectImageType(text('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(detectImageType(text("GIF89a......"))).toBeNull()
    expect(detectImageType(text("%PDF-1.7"))).toBeNull()
    expect(detectImageType(text("MZ\x90\x00"))).toBeNull()
  })

  it("RIFF không phải WebP (vd WAV/AVI) bị từ chối", () => {
    const wav = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0, 0x57, 0x41, 0x56, 0x45)
    expect(detectImageType(wav)).toBeNull()
  })

  it("file quá ngắn hoặc rỗng bị từ chối", () => {
    expect(detectImageType(new Uint8Array())).toBeNull()
    expect(detectImageType(bytes(0xff, 0xd8))).toBeNull()
    expect(detectImageType(bytes(0x52, 0x49, 0x46, 0x46))).toBeNull()
  })
})

describe("checkUploadBytes", () => {
  it("chấp nhận ảnh hợp lệ trong giới hạn", () => {
    expect(checkUploadBytes(PNG)).toEqual({ ok: true, type: "png" })
  })

  it("từ chối file rỗng", () => {
    expect(checkUploadBytes(new Uint8Array()).ok).toBe(false)
  })

  it("từ chối file quá lớn (JPEG hợp lệ nhưng vượt giới hạn)", () => {
    const big = new Uint8Array(UPLOAD_MAX_BYTES + 1)
    big.set(JPEG)
    const r = checkUploadBytes(big)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message).toMatch(/quá lớn/)
  })

  it("đúng bằng giới hạn thì được", () => {
    const edge = new Uint8Array(UPLOAD_MAX_BYTES)
    edge.set(JPEG)
    expect(checkUploadBytes(edge)).toEqual({ ok: true, type: "jpeg" })
  })

  it("từ chối nội dung không phải ảnh", () => {
    expect(checkUploadBytes(text("<?php system($_GET['c']); ?>")).ok).toBe(false)
  })
})

describe("generateUploadName / isSafeUploadName", () => {
  it("tên sinh ra là UUID + đuôi theo loại đã xác thực và tự qua kiểm tra", () => {
    for (const [type, ext] of [
      ["jpeg", "jpg"],
      ["png", "png"],
      ["webp", "webp"],
    ] as const) {
      const name = generateUploadName(type)
      expect(name.endsWith(`.${ext}`)).toBe(true)
      expect(isSafeUploadName(name)).toBe(true)
    }
  })

  it("hai lần sinh cho tên khác nhau", () => {
    expect(generateUploadName("png")).not.toBe(generateUploadName("png"))
  })

  it("từ chối tên chứa ../, dấu / hay \\", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000"
    for (const bad of [
      `../${id}.jpg`,
      `..%2F${id}.jpg`,
      `${id}/../x.jpg`,
      `a/${id}.jpg`,
      `..\\${id}.jpg`,
      `/etc/passwd`,
      `${id}.jpg/`,
      `....//${id}.png`,
    ])
      expect(isSafeUploadName(bad), bad).toBe(false)
  })

  it("từ chối tên lạ: không phải UUID, đuôi không cho phép, đuôi kép, hoa/thường, NUL, rỗng", () => {
    const id = "123e4567-e89b-42d3-a456-426614174000"
    for (const bad of [
      "",
      "photo.jpg",
      "index.html",
      `${id}.svg`,
      `${id}.gif`,
      `${id}.jpg.html`,
      `${id}.php.jpg`,
      `${id}.JPG`,
      id.toUpperCase() + ".jpg",
      `${id}.jpg\0`,
      `${id}.jpg `,
      ` ${id}.jpg`,
      `${id}`,
      `.${id}.jpg`,
      `${id}.jpeg`,
    ])
      expect(isSafeUploadName(bad), JSON.stringify(bad)).toBe(false)
  })

  it("không để dấu xuống dòng lọt qua $ của regex", () => {
    expect(isSafeUploadName("123e4567-e89b-42d3-a456-426614174000.jpg\n")).toBe(false)
  })
})

describe("contentTypeForUploadName", () => {
  const id = "123e4567-e89b-42d3-a456-426614174000"
  it("map đuôi → Content-Type", () => {
    expect(contentTypeForUploadName(`${id}.jpg`)).toBe("image/jpeg")
    expect(contentTypeForUploadName(`${id}.png`)).toBe("image/png")
    expect(contentTypeForUploadName(`${id}.webp`)).toBe("image/webp")
  })
  it("tên không hợp lệ → null", () => {
    expect(contentTypeForUploadName("../x.jpg")).toBeNull()
    expect(contentTypeForUploadName(`${id}.svg`)).toBeNull()
  })
})
