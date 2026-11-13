import { afterAll, describe, expect, it } from "vitest"
import { db } from "@/server/db"
import type { AiConfig } from "../core/env"
import { suggestOutfit, wantedFrom } from "./outfit.service"

/*
 * Test tích hợp trên PostgreSQL thật (dữ liệu seed, CHỈ ĐỌC): kiểm các bất biến của bộ đồ thay vì tên sản phẩm cụ thể, để không vỡ khi
 * seed đổi. Không gọi Ollama: bước truy xuất kiến thức được giả.
 */

afterAll(() => db.$disconnect())

const config = {} as AiConfig
const noKnowledge = { retrieve: async () => [] }

async function check(view: Extract<Awaited<ReturnType<typeof suggestOutfit>>, { ok: true }>["view"]) {
  const products = await db.product.findMany({
    where: { slug: { in: view.items.map((i) => i.slug) } },
    select: { slug: true, isActive: true, gender: true, basePrice: true, variants: { select: { stock: true, color: true } } },
  })
  expect(products).toHaveLength(view.items.length) // mọi món đều là sản phẩm thật
  for (const item of view.items) {
    const p = products.find((x) => x.slug === item.slug)!
    expect(p.isActive).toBe(true)
    expect(p.variants.some((v) => v.stock > 0)).toBe(true) // còn hàng
    // Màu hiển thị là màu còn hàng thật của sản phẩm.
    const color = item.variantLabel.split(" · ")[0]
    expect(p.variants.some((v) => v.color === color && v.stock > 0)).toBe(true)
    expect(item.price).toBe(p.basePrice)
  }
  expect(new Set(view.items.map((i) => i.slug)).size).toBe(view.items.length) // không trùng món
  expect(view.totalPrice).toBe(view.items.reduce((sum, i) => sum + i.price, 0)) // tổng do code cộng
  return products
}

describe("wantedFrom (hiểu yêu cầu bằng code)", () => {
  it("lấy giới tính, dịp, mùa, ngân sách, size từ câu của khách", () => {
    const w = wantedFrom(["phối bộ đồ đi làm cho nam mùa đông dưới 2 triệu size M"])
    expect(w).toMatchObject({ gender: "men", budget: 1_999_999, size: "M" })
    expect(w.occasions).toContain("đi làm")
    expect(w.seasons).toContain("đông")
  })

  it("điều kiện không có ở câu mới thì lấy ở câu trước (nói dịp trước, giới tính sau)", () => {
    const w = wantedFrom(["Phối đồ đi làm", "nữ"])
    expect(w.gender).toBe("women")
    expect(w.occasions).toContain("đi làm")
  })

  it("câu mới nói lại điều kiện thì thắng câu cũ", () => {
    expect(wantedFrom(["phối đồ cho nam", "thôi phối cho nữ đi"]).gender).toBe("women")
  })

  it("không nói gì: không có giới tính (để hỏi lại)", () => {
    expect(wantedFrom(["phối đồ giúp mình"]).gender).toBeUndefined()
  })
})

describe("suggestOutfit (dữ liệu seed thật)", () => {
  it("chưa biết nam hay nữ: NEED_GENDER, không đoán", async () => {
    const r = await suggestOutfit({ userTexts: ["Phối đồ đi làm"] }, null, noKnowledge)
    expect(r).toMatchObject({ ok: false, code: "NEED_GENDER" })
  })

  it("nam đi làm: có áo và quần, chỉ sản phẩm nam hoặc unisex, còn hàng, tổng tiền đúng", async () => {
    const r = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam"] }, null, noKnowledge)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const products = await check(r.view)
    const slots = r.view.items.map((i) => i.slot)
    expect(slots).toContain("top")
    expect(slots).toContain("bottom")
    expect(r.view.occasion).toBe("đi làm")
    expect(r.view.title).toContain("nam")
    for (const p of products) expect(["MEN", "UNISEX"]).toContain(p.gender)
  })

  it("nữ dự tiệc: món chính là váy đầm (kho có váy), chỉ sản phẩm nữ hoặc unisex", async () => {
    const r = await suggestOutfit({ userTexts: ["phối đồ dự tiệc cho nữ"] }, null, noKnowledge)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const products = await check(r.view)
    expect(r.view.items.map((i) => i.slot)).toContain("dress")
    // Chân váy không phải bộ hoàn chỉnh: không bao giờ đứng ở ô váy đầm.
    for (const item of r.view.items.filter((i) => i.slot === "dress")) expect(item.name).not.toMatch(/chân váy/i)
    for (const p of products) expect(["WOMEN", "UNISEX"]).toContain(p.gender)
  })

  it("nhớ dịp ở câu trước khi khách chỉ nói giới tính ở câu sau", async () => {
    const r = await suggestOutfit({ userTexts: ["Phối đồ đi làm", "nữ"] }, null, noKnowledge)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.view.occasion).toBe("đi làm")
  })

  it("mùa đông: có áo khoác hoặc báo thiếu áo khoác (không nhồi món khác)", async () => {
    const r = await suggestOutfit({ userTexts: ["phối đồ mùa đông cho nam"] }, null, noKnowledge)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.view.items.some((i) => i.slot === "outer") || r.view.missingSlots.includes("áo khoác")).toBe(true)
  })

  it("ngân sách: bộ trả về không vượt ngân sách; ngân sách quá thấp thì OVER_BUDGET", async () => {
    const ok = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam dưới 1 triệu"] }, null, noKnowledge)
    if (ok.ok) expect(ok.view.totalPrice).toBeLessThanOrEqual(999_999)
    else expect(ok.code).toBe("OVER_BUDGET")
    const tooLow = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam dưới 50k"] }, null, noKnowledge)
    expect(tooLow).toMatchObject({ ok: false, code: "OVER_BUDGET" })
  })

  it("món khách đã chọn sẵn luôn nằm trong bộ; giới tính theo món đó", async () => {
    const top = await db.product.findFirstOrThrow({
      where: { isActive: true, gender: "WOMEN", category: { slug: "ao-so-mi-nu" }, variants: { some: { stock: { gt: 0 } } } },
      select: { slug: true, name: true },
    })
    const r = await suggestOutfit({ userTexts: ["phối thêm cho món này"], anchorSlug: top.slug }, null, noKnowledge)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    await check(r.view)
    expect(r.view.items.map((i) => i.slug)).toContain(top.slug)
    expect(r.view.title).toContain(top.name.slice(0, 20))
    expect(r.view.items.some((i) => i.reason?.includes("Sản phẩm bạn đã chọn"))).toBe(true)
  })

  it("món chọn sẵn không tồn tại hoặc hết hàng: ANCHOR_NOT_FOUND", async () => {
    expect(await suggestOutfit({ userTexts: ["phối đồ"], anchorSlug: "khong-co-san-pham-nay" }, null, noKnowledge)).toMatchObject({
      ok: false,
      code: "ANCHOR_NOT_FOUND",
    })
  })

  it("size khách nói: mọi món đều còn size đó ở màu được chọn", async () => {
    const r = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam size M"] }, null, noKnowledge)
    if (!r.ok) return
    for (const item of r.view.items) {
      const color = item.variantLabel.split(" · ")[0]
      const p = await db.product.findUniqueOrThrow({ where: { slug: item.slug }, select: { variants: { select: { color: true, size: true, stock: true } } } })
      expect(p.variants.some((v) => v.color === color && v.size === "M" && v.stock > 0)).toBe(true)
      expect(item.variantLabel).toContain("size M")
    }
  })

  it("ghi nguồn kiến thức phối đồ khi truy xuất được; lỗi truy xuất thì bỏ qua, bộ đồ vẫn hợp lệ", async () => {
    const withSources = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam"] }, config, {
      retrieve: async () => [{ source: "styling.md", type: "styling", title: "Phối đồ đi làm", content: "x", metadata: {}, distance: 0.3 }],
    })
    expect(withSources.ok && withSources.view.knowledgeSources).toEqual(["Phối đồ đi làm"])

    const warn = console.warn
    console.warn = () => {}
    try {
      const failing = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nam"] }, config, {
        retrieve: async () => {
          throw new Error("embed hỏng")
        },
      })
      expect(failing.ok && failing.view.knowledgeSources).toEqual([])
    } finally {
      console.warn = warn
    }
  })

  it("kết quả ổn định: gọi hai lần cho cùng một bộ", async () => {
    const a = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nữ"] }, null, noKnowledge)
    const b = await suggestOutfit({ userTexts: ["phối đồ đi làm cho nữ"] }, null, noKnowledge)
    expect(a.ok && b.ok && a.view.items.map((i) => i.slug)).toEqual(b.ok && a.ok ? b.view.items.map((i) => i.slug) : undefined)
  })
})
