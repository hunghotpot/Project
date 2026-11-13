import "server-only"
import { Prisma } from "@prisma/client"
import { db } from "@/server/db"
import type { ChatLogRow } from "./log"

/*
 * Lưu nhật ký lượt chat vào bảng `AiChatLog`. Ghi nhật ký KHÔNG BAO GIỜ làm hỏng hoặc làm chậm câu trả lời:
 * lỗi DB chỉ được cảnh báo ra console. Hạn lưu (purge) theo docs/ai/05 mục 7: nội dung và tham số xoá sớm, số liệu giữ lâu hơn.
 */

export type ChatLogSink = (row: ChatLogRow) => Promise<void>

export const writeChatLog: ChatLogSink = async (row) => {
  try {
    await db.aiChatLog.create({
      data: {
        ...row,
        tools: row.tools as Prisma.InputJsonValue,
        params: row.params === null ? Prisma.DbNull : (row.params as Prisma.InputJsonValue),
      },
    })
  } catch (e) {
    console.warn("[ai] không ghi được nhật ký chat:", e instanceof Error ? e.message : e)
  }
}

export const TEXT_RETENTION_DAYS = 14
export const ROW_RETENTION_DAYS = 90

const daysAgo = (days: number, now: Date) => new Date(now.getTime() - days * 86_400_000)

/** Xoá toàn văn và tham số cũ hơn `textDays`, xoá hẳn dòng cũ hơn `rowDays`. Trả số dòng bị đụng tới. */
export async function purgeChatLogs(opts: { textDays?: number; rowDays?: number; now?: Date } = {}) {
  const now = opts.now ?? new Date()
  const scrubbed = await db.aiChatLog.updateMany({
    where: { createdAt: { lt: daysAgo(opts.textDays ?? TEXT_RETENTION_DAYS, now) }, OR: [{ userText: { not: null } }, { replyText: { not: null } }, { params: { not: Prisma.DbNull } }] },
    data: { userText: null, replyText: null, params: Prisma.DbNull },
  })
  const deleted = await db.aiChatLog.deleteMany({ where: { createdAt: { lt: daysAgo(opts.rowDays ?? ROW_RETENTION_DAYS, now) } } })
  return { scrubbed: scrubbed.count, deleted: deleted.count }
}
