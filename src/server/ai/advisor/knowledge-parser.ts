import { knowledgeMetaSchema, type KnowledgeMeta, type KnowledgeType } from "@/lib/validators/ai"

/*
 * Đọc kho kiến thức Markdown (docs/ai/knowledge/*.md, quy ước ở README trong thư mục đó) thành các đoạn để nạp vào DB.
 * Mỗi `##` là một đoạn; dòng ngay dưới tiêu đề là `<!-- meta: {...} -->`. Hàm thuần, không đụng file hay DB.
 * Sai quy ước (thiếu meta, meta sai, trùng tiêu đề, đoạn rỗng) thì ném lỗi nêu rõ file và tiêu đề: để lỗi lộ khi nạp,
 * không để một đoạn hỏng lặng lẽ vào kho.
 */

/** File nguồn và loại đoạn tương ứng. README.md không phải nội dung. */
export const KNOWLEDGE_FILES: { file: string; type: KnowledgeType }[] = [
  { file: "care.md", type: "care" },
  { file: "size-guide.md", type: "faq" },
  { file: "policy.md", type: "policy" },
  { file: "styling.md", type: "styling" },
  { file: "occasions.md", type: "styling" },
]

export interface KnowledgeChunkInput {
  /** Tên file nguồn, ví dụ "care.md". Cùng với `title` xác định đoạn. */
  source: string
  type: KnowledgeType
  title: string
  content: string
  metadata: KnowledgeMeta
}

const META_LINE = /^<!--\s*meta:\s*(\{.*\})\s*-->\s*$/

export function parseKnowledgeMarkdown(source: string, type: KnowledgeType, markdown: string): KnowledgeChunkInput[] {
  const chunks: KnowledgeChunkInput[] = []
  const seen = new Set<string>()

  // Phần trước `##` đầu tiên (tiêu đề `#` và lời dẫn của file) bị bỏ.
  const sections = markdown.replace(/\r\n/g, "\n").split(/^## /m).slice(1)
  for (const section of sections) {
    const [titleLine, ...rest] = section.split("\n")
    const title = titleLine.trim()
    const where = `${source} › "${title}"`
    if (!title) throw new Error(`${source}: có mục ## không có tiêu đề`)
    if (seen.has(title)) throw new Error(`${where}: tiêu đề bị trùng trong cùng file`)
    seen.add(title)

    const lines = rest.map((l) => l.trimEnd())
    const firstIndex = lines.findIndex((l) => l.trim() !== "")
    const match = firstIndex >= 0 ? META_LINE.exec(lines[firstIndex].trim()) : null
    if (!match) throw new Error(`${where}: dòng ngay dưới tiêu đề phải là <!-- meta: {...} -->`)

    let metadata: KnowledgeMeta
    try {
      metadata = knowledgeMetaSchema.parse(JSON.parse(match[1]))
    } catch (e) {
      throw new Error(`${where}: meta không hợp lệ (${e instanceof Error ? e.message.split("\n")[0] : "lỗi"})`)
    }

    const content = lines
      .slice(firstIndex + 1)
      .join("\n")
      .trim()
    if (!content) throw new Error(`${where}: đoạn không có nội dung`)
    chunks.push({ source, type, title, content, metadata })
  }
  return chunks
}

/** Văn bản đem embed: tiêu đề tự mô tả đi cùng nội dung để vector bắt đúng chủ đề (docs/ai/03 mục 1). */
export const knowledgeDocument = (c: Pick<KnowledgeChunkInput, "title" | "content">) => `${c.title}\n${c.content}`
