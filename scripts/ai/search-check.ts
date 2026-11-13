import { getAiStatus } from "@/server/ai/core/env"
import { searchProducts } from "@/server/ai/search/search.service"
import { listProducts } from "@/server/services/catalog.service"
import { db } from "@/server/db"
import { SEARCH_CASES, type ProductFacts } from "@/test/ai/search-queries"

/*
 * npm run ai:search-check            chấm 15 truy vấn mẫu (docs/ai/02 mục 7) trên Ollama thật và DB hiện tại
 * npm run ai:search-check -- --keyword   chỉ dùng tìm từ khoá (không gọi embedding), để so sánh
 * Cần Ollama chạy, đã `npm run ai:embed`. Không nằm trong `npm test` vì gọi model thật.
 */
const keywordOnly = process.argv.includes("--keyword")
const TOP = 5

async function factsOf(ids: string[]): Promise<Map<string, ProductFacts>> {
  const rows = await db.product.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      tags: true,
      gender: true,
      basePrice: true,
      season: true,
      occasion: true,
      style: true,
      material: true,
      category: { select: { slug: true } },
      variants: { select: { size: true, color: true, stock: true } },
    },
  })
  return new Map(
    rows.map((r) => [r.id, { ...r, price: r.basePrice, categorySlug: r.category.slug } satisfies ProductFacts]),
  )
}

async function main(): Promise<number> {
  const status = getAiStatus()
  const config = keywordOnly || !status.enabled ? null : status.config
  if (!keywordOnly && !status.enabled) console.warn(`AI đang tắt (${status.reason}), chạy bằng từ khoá.`)
  console.log(`Chế độ: ${config ? `semantic (${config.embeddingModel})` : "từ khoá"}\n`)

  let passed = 0
  let precisionSum = 0
  let violations = 0
  let baselinePassed = 0
  const times: number[] = []

  for (const c of SEARCH_CASES) {
    const started = Date.now()
    const found = await searchProducts(c.query, { pageSize: TOP, config })
    const ms = Date.now() - started
    times.push(ms)

    const ids = found.result.items.map((i) => i.id)
    const facts = await factsOf(ids)
    const top = ids.map((id) => facts.get(id)).filter((p): p is ProductFacts => !!p)
    const bad = top.filter((p) => !c.hard(p))
    const good = top.filter((p) => c.good(p))
    const ok = bad.length === 0 && good.length > 0
    if (ok) passed++
    violations += bad.length
    precisionSum += top.length ? good.length / top.length : 0

    // Nền so sánh: tìm từ khoá hiện tại với cả câu.
    const base = await listProducts({ q: c.query, pageSize: TOP }, { includeUnisex: true })
    const baseFacts = await factsOf(base.items.map((i) => i.id))
    const baseGood = base.items.map((i) => baseFacts.get(i.id)).filter((p): p is ProductFacts => !!p && c.good(p))
    if (baseGood.length > 0) baselinePassed++

    console.log(`${ok ? "ĐẠT " : "SAI  "} #${c.id} "${c.query}"  ${ms}ms  trả ${top.length}, đúng ý ${good.length}, vi phạm cứng ${bad.length}${found.relaxed.length ? `, nới: ${found.relaxed.join("; ")}` : ""}`)
    for (const p of top) console.log(`        ${c.good(p) ? "+" : c.hard(p) ? "." : "!"} ${p.name} [${p.gender}] ${p.price.toLocaleString("vi-VN")}đ`)
  }

  times.sort((a, b) => a - b)
  const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)]
  console.log(`\nPass@5: ${passed}/${SEARCH_CASES.length} (ngưỡng 12)`)
  console.log(`Precision@5 trung bình: ${(precisionSum / SEARCH_CASES.length).toFixed(2)} (ngưỡng 0,7)`)
  console.log(`Vi phạm lọc cứng trong top-5: ${violations} (ngưỡng 0)`)
  console.log(`Nền từ khoá (cả câu): ${baselinePassed}/${SEARCH_CASES.length} câu có ít nhất 1 sản phẩm đúng ý`)
  console.log(`Độ trễ: p50 ${times[Math.floor(times.length / 2)]}ms, p95 ${p95}ms (ngưỡng 3000ms)`)
  return 0
}

main()
  .then((code) => {
    process.exitCode = code
  })
  .catch((e) => {
    console.error("search-check lỗi:", e instanceof Error ? e.stack ?? e.message : e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
