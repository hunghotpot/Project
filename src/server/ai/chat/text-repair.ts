/*
 * Sửa lỗi model: qwen3:4b-instruct thỉnh thoảng bỏ mất chữ "m" ở đầu câu trả lời, nên khách thấy "ình không thể…" thay vì "mình không thể…",
 * có khi lặp thành "ình mình chưa có…". Đã đo (2026-11-14): Ollama THỰC SỰ gửi "ình" làm mẩu đầu tiên (không phải lỗi ghép luồng hay thư viện nối),
 * khoảng 1/5 lượt với một câu từ chối ngắn; gọi thẳng API với prompt đơn giản thì 12/12 đúng. "ình" không bao giờ là từ mở đầu hợp lệ trong
 * tiếng Việt nên sửa an toàn. Chỉ xử lý mẩu chữ ĐẦU TIÊN của câu trả lời.
 */

/** "ình" đứng riêng (không dính chữ cái sau): phần còn lại của "mình" đã mất chữ "m". */
const BROKEN_LEAD = /^ình(?!\p{L})/u

/** Sửa phần đầu của một đoạn chữ: "ình mình…" bỏ "ình " thừa, "ình …" thành "mình …". Không đụng chữ khác. */
export function repairLeadingFragment(text: string): string {
  if (/^ình\s+mình(?!\p{L})/u.test(text)) return text.replace(/^ình\s+/u, "")
  if (BROKEN_LEAD.test(text)) return `m${text}`
  return text
}

/**
 * Sửa trên luồng chữ: mẩu đầu tiên có dấu hiệu hỏng thì giữ lại chờ mẩu kế tiếp để nhìn được dạng lặp "ình mình", rồi phát bản đã sửa.
 * `push` trả chữ cần phát ngay ("" = đang giữ lại); `flush` gọi khi hết luồng để không bỏ sót mẩu đang giữ.
 */
export function createLeadRepair() {
  let state: "unchecked" | "held" | "done" = "unchecked"
  let held = ""
  return {
    push(delta: string): string {
      if (state === "done") return delta
      if (state === "held") {
        state = "done"
        return repairLeadingFragment(held + delta)
      }
      if (!delta.trim()) return delta
      if (BROKEN_LEAD.test(delta)) {
        state = "held"
        held = delta
        return ""
      }
      state = "done"
      return delta
    },
    flush(): string {
      if (state !== "held") return ""
      state = "done"
      return repairLeadingFragment(held)
    },
  }
}
