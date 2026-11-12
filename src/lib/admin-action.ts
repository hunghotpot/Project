/** Kết quả chuẩn của mọi Server Action Admin: UI chỉ cần hiện `message` (toast) và dựa vào `ok`. */
export type AdminActionResult = { ok: true; message: string } | { ok: false; message: string }
