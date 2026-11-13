import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { OCCASIONS } from "../../../../prisma/seed-data/vocab"
import { knowledgeDocument, KNOWLEDGE_FILES, parseKnowledgeMarkdown } from "./knowledge-parser"

const DIR = join(process.cwd(), "docs", "ai", "knowledge")

describe("parseKnowledgeMarkdown", () => {
  const md = `# Tiêu đề file

Lời dẫn bị bỏ.

## Đoạn một
<!-- meta: {"materials":["linen"],"seasons":["hè"],"basis":"tra-cuu"} -->
Nội dung dòng 1.

Nội dung dòng 2.

## Đoạn hai
<!-- meta: {} -->
Chỉ một dòng.
`

  it("tách theo ##, đọc meta JSON, giữ xuống dòng trong nội dung", () => {
    expect(parseKnowledgeMarkdown("x.md", "care", md)).toEqual([
      {
        source: "x.md",
        type: "care",
        title: "Đoạn một",
        content: "Nội dung dòng 1.\n\nNội dung dòng 2.",
        metadata: { materials: ["linen"], seasons: ["hè"], basis: "tra-cuu" },
      },
      { source: "x.md", type: "care", title: "Đoạn hai", content: "Chỉ một dòng.", metadata: {} },
    ])
  })

  it("chịu được xuống dòng kiểu Windows", () => {
    expect(parseKnowledgeMarkdown("x.md", "faq", md.replace(/\n/g, "\r\n"))).toHaveLength(2)
  })

  it.each([
    ["thiếu meta", "## A\nNội dung không có meta"],
    ["meta không phải JSON", "## A\n<!-- meta: {không phải json} -->\nNội dung"],
    ["khoá meta lạ (gõ sai)", '## A\n<!-- meta: {"occassions":["đi làm"]} -->\nNội dung'],
    ["giá trị meta sai kiểu", '## A\n<!-- meta: {"seasons":["mùa-lạ"]} -->\nNội dung'],
    ["đoạn rỗng", "## A\n<!-- meta: {} -->\n\n"],
    ["trùng tiêu đề", "## A\n<!-- meta: {} -->\nx\n## A\n<!-- meta: {} -->\ny"],
  ])("ném lỗi nêu rõ file và tiêu đề: %s", (_name, bad) => {
    expect(() => parseKnowledgeMarkdown("loi.md", "care", bad)).toThrow(/loi\.md/)
  })
})

describe("kho kiến thức thật (docs/ai/knowledge)", () => {
  const all = KNOWLEDGE_FILES.flatMap(({ file, type }) => parseKnowledgeMarkdown(file, type, readFileSync(join(DIR, file), "utf8")))

  it("đọc được toàn bộ file, không đoạn nào lỗi quy ước", () => {
    expect(all.length).toBeGreaterThanOrEqual(90)
    for (const { file } of KNOWLEDGE_FILES) expect(all.some((c) => c.source === file), file).toBe(true)
  })

  it("mỗi đoạn có nội dung đủ ý và không quá dài để đưa vào prompt", () => {
    for (const c of all) {
      expect(c.content.length, `${c.source} › ${c.title}`).toBeGreaterThan(40)
      expect(c.content.length, `${c.source} › ${c.title}`).toBeLessThan(1500)
    }
  })

  it("meta.occasions chỉ dùng giá trị trong OCCASIONS và mỗi dịp chuẩn có một đoạn riêng", () => {
    const allowed = new Set<string>(OCCASIONS)
    for (const c of all) for (const o of c.metadata.occasions ?? []) expect(allowed.has(o), `${c.title}: ${o}`).toBe(true)
    const covered = new Set(all.filter((c) => c.source === "occasions.md").map((c) => c.title))
    expect(OCCASIONS.filter((o) => !covered.has(o))).toEqual([])
  })

  it("chunk chính sách không nhắc những điều chưa có (không bịa số ngày đổi trả)", () => {
    const policy = all.filter((c) => c.type === "policy").map((c) => c.content).join("\n")
    expect(policy).not.toMatch(/\d+\s*ngày/)
  })

  it("văn bản embed gồm tiêu đề rồi nội dung", () => {
    expect(knowledgeDocument({ title: "T", content: "C" })).toBe("T\nC")
  })
})
