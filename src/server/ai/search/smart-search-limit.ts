import "server-only"
import { getAiRateLimiter, type AiRateLimiter } from "../core/rate-limit"

/*
 * Giới hạn tốc độ cho phần vector của tìm kiếm thông minh (docs/ai/05 mục 4). Trang danh sách gọi model embedding mỗi lần khách đổi
 * câu tìm kiếm; không giới hạn thì một người bấm liên tục có thể giữ máy chạy model bận. Vượt giới hạn thì trang vẫn tìm được,
 * chỉ rơi về tìm từ khoá (không lỗi, không chặn trang).
 */

export const SMART_SEARCH_LIMIT_PER_MINUTE = 30
const WINDOW_SECONDS = 60

export const SMART_SEARCH_LIMITED_NOTICE = "Bạn tìm hơi nhanh nên mình tạm dùng tìm kiếm thường, thử lại sau ít giây để dùng tìm kiếm thông minh"

/** Người dùng này còn được dùng vector trong phút hiện tại không (mỗi lần gọi tính một lượt). */
export async function allowSmartSearch(userId: string, limiter: AiRateLimiter = getAiRateLimiter()): Promise<boolean> {
  const r = await limiter.consume(`search:${userId}`, SMART_SEARCH_LIMIT_PER_MINUTE, WINDOW_SECONDS)
  return r.allowed
}
