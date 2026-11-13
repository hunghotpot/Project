/*
 * Hiển thị chữ của trợ lý: model hay viết **đậm** kiểu markdown dù khung chat không render markdown, nên dấu `**` hiện nguyên ra.
 * Chỉ hỗ trợ đúng một thứ là **đậm**; mọi thứ khác vẫn là chữ thuần (không bao giờ HTML, nên không có đường chèn mã).
 */

export interface TextSegment {
  text: string
  bold: boolean
}

/**
 * Tách chữ thành các đoạn thường/đậm. `**x**` đã đóng thành đoạn đậm; dấu `**` còn dư (đóng thiếu khi câu đang được gõ dở, hoặc
 * model viết lệch) bị bỏ để khách không thấy dấu sao nhấp nháy. Đoạn đậm không xuyên qua xuống dòng.
 */
export function splitBold(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  for (const piece of text.split(/(\*\*[^*\n]+\*\*)/g)) {
    if (!piece) continue
    if (/^\*\*[^*\n]+\*\*$/.test(piece)) segments.push({ text: piece.slice(2, -2), bold: true })
    else {
      const plain = piece.replace(/\*\*/g, "")
      if (plain) segments.push({ text: plain, bold: false })
    }
  }
  return segments
}
