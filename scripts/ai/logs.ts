import { db } from "@/server/db"
import { purgeChatLogs, ROW_RETENTION_DAYS, TEXT_RETENTION_DAYS } from "@/server/ai/core/log-store"

/*
 * npm run ai:logs                  20 lượt gần nhất
 * npm run ai:logs -- --bad         chỉ lượt có vấn đề (fallback, error, cổng kiểm chứng phải thử lại, tool lỗi)
 * npm run ai:logs -- --last 50     đổi số lượt
 * npm run ai:logs -- --stats       tổng hợp 24 giờ qua (số lượt, tỉ lệ lỗi, độ trễ p50/p95, token)
 * npm run ai:logs -- --purge       xoá toàn văn/tham số quá 14 ngày và dòng quá 90 ngày
 * Mức log do AI_LOG_LEVEL quyết định lúc chat (0 chỉ số liệu, 1 thêm tham số tool, 2 thêm toàn văn): lượt đã ghi ở mức thấp thì không xem lại được chi tiết.
 */

const arg = (name: string) => process.argv.includes(name)
const argValue = (name: string) => process.argv[process.argv.indexOf(name) + 1]

const pct = (sorted: number[], p: number) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0)

async function main() {
  if (arg("--purge")) {
    const r = await purgeChatLogs()
    console.log(`Đã xoá toàn văn/tham số ${r.scrubbed} lượt (quá ${TEXT_RETENTION_DAYS} ngày), xoá hẳn ${r.deleted} lượt (quá ${ROW_RETENTION_DAYS} ngày).`)
    return
  }

  if (arg("--stats")) {
    const rows = await db.aiChatLog.findMany({ where: { createdAt: { gt: new Date(Date.now() - 86_400_000) } }, select: { status: true, latencyMs: true, ttftMs: true, tokensIn: true, tokensOut: true, retries: true } })
    if (rows.length === 0) return console.log("Chưa có lượt chat nào trong 24 giờ qua.")
    const byStatus = Object.entries(Object.groupBy(rows, (r) => r.status)).map(([k, v]) => `${k}: ${v?.length}`).join(", ")
    const lat = rows.map((r) => r.latencyMs).sort((a, b) => a - b)
    const ttft = rows.flatMap((r) => (r.ttftMs === null ? [] : [r.ttftMs])).sort((a, b) => a - b)
    console.log(`24 giờ qua: ${rows.length} lượt (${byStatus})`)
    console.log(`Độ trễ hoàn tất p50 ${pct(lat, 0.5)} ms, p95 ${pct(lat, 0.95)} ms | chữ đầu tiên p50 ${pct(ttft, 0.5)} ms`)
    console.log(`Token: vào ${rows.reduce((a, r) => a + r.tokensIn, 0)}, ra ${rows.reduce((a, r) => a + r.tokensOut, 0)} | lượt phải thử lại: ${rows.filter((r) => r.retries > 0).length}`)
    return
  }

  const take = Number(argValue("--last")) || 20
  const rows = await db.aiChatLog.findMany({
    where: arg("--bad") ? { OR: [{ status: { in: ["fallback", "error"] } }, { retries: { gt: 0 } }] } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  })
  if (rows.length === 0) return console.log("Không có dòng nhật ký nào.")
  for (const r of rows.reverse()) {
    const tools = (r.tools as { name: string; ok: boolean; code?: string }[]).map((t) => (t.ok ? t.name : `${t.name}✗${t.code ?? ""}`)).join(", ") || "(không gọi tool)"
    console.log(`\n${r.createdAt.toLocaleString("vi-VN")} [mức ${r.level}] ${r.status}${r.claim ? ` claim=${r.claim}` : ""}${r.retries ? ` thử lại ${r.retries}` : ""} | ${r.latencyMs} ms (chữ đầu ${r.ttftMs ?? "-"} ms) | token ${r.tokensIn}/${r.tokensOut}`)
    console.log(`  tool: ${tools}`)
    if (r.params) for (const p of r.params as { name: string; input: unknown }[]) console.log(`    ${p.name} ${JSON.stringify(p.input)}`)
    if (r.error) console.log(`  lỗi: ${r.error}`)
    if (r.userText) console.log(`  khách: ${r.userText}`)
    if (r.replyText) console.log(`  trợ lý: ${r.replyText}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
