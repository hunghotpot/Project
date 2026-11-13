import "server-only"
import { createOllama } from "ollama-ai-provider-v2"
import type { AiConfig } from "./env"

/*
 * Chọn model chat, model rẻ và model embedding từ cấu hình. Đổi nhà cung cấp chỉ sửa file này.
 * Ollama mặc định dùng API gốc ở `<AI_BASE_URL>/api`.
 */
export function createAiModels(config: AiConfig) {
  const ollama = createOllama({ baseURL: `${config.baseUrl}/api` })
  return {
    chat: ollama(config.chatModel),
    fast: ollama(config.fastModel),
    embedding: ollama.embedding(config.embeddingModel),
  }
}

/**
 * Tắt chế độ suy nghĩ. Model đã chọn là `qwen3:4b-instruct` (không suy nghĩ): đo 2026-11-13 trên RTX 3050 6 GB, chọn tool
 * 0,4–1,1 giây, trích bộ lọc 2–5 giây. Bản `qwen3:4b` thường luôn suy nghĩ: bật thì chậm (trích bộ lọc 49–109 giây),
 * `think: false` thì lời suy luận tiếng Anh lẫn vào văn bản. Truyền qua `providerOptions` của generateText / streamText.
 */
export const CHAT_PROVIDER_OPTIONS = {
  // num_ctx: mặc định của Ollama là 4096 token, không đủ cho chỉ dẫn + kiến thức truy xuất + lịch sử (Ollama âm thầm cắt bớt
  // phần đầu prompt nếu vượt, tức mất cả chỉ dẫn hệ thống). 8192 vừa với RTX 3050 6 GB (kiểm `ollama ps` còn 100% GPU).
  ollama: { think: false, options: { num_ctx: 8192 } },
}
