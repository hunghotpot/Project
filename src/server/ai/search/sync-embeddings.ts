import "server-only"
import type { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import { embedTexts, hashContent } from "../core/embeddings"
import type { AiConfig } from "../core/env"
import { buildProductDocument, TEMPLATE_VERSION } from "./product-document"

/*
 * Đồng bộ bảng ProductEmbedding với sản phẩm (docs/ai/01-data-for-ai.md mục 4).
 * `contentHash` quyết định có embed lại hay không: dữ liệu không đổi thì bỏ qua, không tốn thời gian.
 * Đây là tác vụ nạp dữ liệu của tầng AI (không phải tool), nên đọc Product thẳng bằng Prisma; mọi sản phẩm đều được embed,
 * kể cả đang ẩn (truy vấn tìm kiếm tự lọc isActive). Xoá sản phẩm thì bản ghi embedding tự xoá theo (ON DELETE CASCADE).
 * Cột vector chỉ đọc/ghi được bằng SQL thô vì Prisma Client không có kiểu `vector`.
 */

const productSelect = {
  id: true,
  name: true,
  brand: true,
  gender: true,
  material: true,
  style: true,
  occasion: true,
  season: true,
  tags: true,
  description: true,
  category: { select: { name: true } },
  variants: { select: { color: true } },
} satisfies Prisma.ProductSelect

type ProductRow = Prisma.ProductGetPayload<{ select: typeof productSelect }>

function documentOf(p: ProductRow, config: AiConfig) {
  const content = buildProductDocument({
    name: p.name,
    categoryName: p.category.name,
    brand: p.brand,
    gender: p.gender,
    material: p.material,
    style: p.style,
    occasion: p.occasion,
    season: p.season,
    tags: p.tags,
    description: p.description,
    colors: p.variants.map((v) => v.color),
  })
  return { productId: p.id, content, contentHash: hashContent(content, config.embeddingModel, TEMPLATE_VERSION) }
}

type Doc = ReturnType<typeof documentOf>

const toVectorLiteral = (v: number[]) => `[${v.join(",")}]`

async function upsertEmbedding(doc: Doc, vector: number[], config: AiConfig): Promise<void> {
  await db.$executeRaw`
    INSERT INTO "ProductEmbedding" ("productId", "embedding", "content", "contentHash", "model", "dimensions", "templateVersion", "embeddedAt")
    VALUES (${doc.productId}, ${toVectorLiteral(vector)}::vector, ${doc.content}, ${doc.contentHash}, ${config.embeddingModel}, ${config.embeddingDimensions}, ${TEMPLATE_VERSION}, now())
    ON CONFLICT ("productId") DO UPDATE SET
      "embedding" = EXCLUDED."embedding",
      "content" = EXCLUDED."content",
      "contentHash" = EXCLUDED."contentHash",
      "model" = EXCLUDED."model",
      "dimensions" = EXCLUDED."dimensions",
      "templateVersion" = EXCLUDED."templateVersion",
      "embeddedAt" = now()`
}

export type SyncOneResult = "embedded" | "skipped" | "missing"

/** Đồng bộ một sản phẩm. "missing": sản phẩm không còn (embedding đã tự xoá theo). */
export async function syncOneProduct(productId: string, config: AiConfig): Promise<SyncOneResult> {
  const product = await db.product.findUnique({ where: { id: productId }, select: productSelect })
  if (!product) return "missing"
  const doc = documentOf(product, config)
  const existing = await db.productEmbedding.findUnique({ where: { productId }, select: { contentHash: true } })
  if (existing?.contentHash === doc.contentHash) return "skipped"
  const [vector] = await embedTexts([doc.content], config)
  await upsertEmbedding(doc, vector, config)
  return "embedded"
}

export interface SyncAllOptions {
  /** Embed lại cả sản phẩm có hash khớp. */
  force?: boolean
  /** Số văn bản gửi mỗi lượt gọi embedding. */
  batchSize?: number
  /** Chỉ xử lý các sản phẩm này (mặc định: tất cả). */
  productIds?: string[]
  onProgress?: (done: number, total: number) => void
}

export interface SyncSummary {
  total: number
  embedded: number
  skipped: number
}

/**
 * Đồng bộ nhiều sản phẩm theo lô; chạy lại an toàn (idempotent). Lỗi ở một lô (Ollama tắt, quá hạn) làm dừng cả lượt,
 * phần đã ghi vẫn giữ nên chạy lại sẽ tiếp tục từ chỗ còn thiếu.
 */
export async function syncAllProducts(config: AiConfig, options: SyncAllOptions = {}): Promise<SyncSummary> {
  const { force = false, batchSize = 16, productIds, onProgress } = options
  const products = await db.product.findMany({
    where: productIds ? { id: { in: productIds } } : undefined,
    select: productSelect,
    orderBy: { createdAt: "asc" },
  })
  const docs = products.map((p) => documentOf(p, config))
  const existing = await db.productEmbedding.findMany({
    where: productIds ? { productId: { in: productIds } } : undefined,
    select: { productId: true, contentHash: true },
  })
  const hashOf = new Map(existing.map((e) => [e.productId, e.contentHash]))
  const stale = force ? docs : docs.filter((d) => hashOf.get(d.productId) !== d.contentHash)

  let done = 0
  for (let i = 0; i < stale.length; i += batchSize) {
    const batch = stale.slice(i, i + batchSize)
    const vectors = await embedTexts(batch.map((d) => d.content), config)
    for (let j = 0; j < batch.length; j++) await upsertEmbedding(batch[j], vectors[j], config)
    done += batch.length
    onProgress?.(done, stale.length)
  }
  return { total: docs.length, embedded: stale.length, skipped: docs.length - stale.length }
}
