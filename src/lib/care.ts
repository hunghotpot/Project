/*
 * DB chưa có trường "chăm sóc" riêng → gợi ý chung theo nhóm chất liệu (suy ra từ Product.material).
 * Khi cần chính xác theo từng sản phẩm, thêm cột careInstructions vào Product và ưu tiên cột đó.
 */

const GROUPS: { test: RegExp; tips: string[] }[] = [
  {
    test: /^da /,
    tips: ["Lau bằng khăn ẩm mềm, không ngâm nước", "Tránh nguồn nhiệt và ánh nắng trực tiếp", "Bảo quản nơi khô ráo, dùng túi vải"],
  },
  {
    test: /thép|nhựa|acetate/,
    tips: ["Lau sạch bằng khăn mềm sau khi dùng", "Tránh hoá chất, nước hoa và nước biển", "Cất trong hộp hoặc túi riêng để tránh trầy xước"],
  },
  {
    test: /lụa|satin|viscose|chiffon|voan|crepe|tencel|ren/,
    tips: ["Giặt tay nhẹ nước lạnh hoặc giặt khô", "Không vắt xoắn, không dùng chất tẩy", "Phơi bóng râm, ủi nhiệt độ thấp"],
  },
  {
    test: /len|wool|dạ|sherpa|dệt kim/,
    tips: ["Giặt tay nước lạnh với xà phòng dịu nhẹ", "Phơi ngang, không treo để tránh giãn", "Không sấy, không ủi trực tiếp"],
  },
  {
    test: /denim/,
    tips: ["Giặt lộn trái bằng nước lạnh, lần đầu giặt riêng", "Hạn chế giặt để giữ màu, không dùng chất tẩy", "Phơi nơi thoáng, tránh nắng gắt"],
  },
  {
    test: /linen|lanh|đũi/,
    tips: ["Giặt nước lạnh hoặc ấm dưới 30°C", "Phơi khi còn hơi ẩm để vải ít nhăn", "Ủi ở nhiệt độ trung bình"],
  },
  {
    test: /polyester|nylon|thun lạnh|spandex/,
    tips: ["Giặt máy chế độ nhẹ, nước lạnh", "Không dùng nước xả vải, không sấy nhiệt cao", "Phơi nơi thoáng mát, ủi nhiệt độ thấp"],
  },
  {
    test: /cotton|kaki|canvas|nỉ|fleece|terry|poplin|oxford|flannel|rib/,
    tips: ["Giặt máy hoặc giặt tay ở nhiệt độ dưới 40°C", "Lộn trái khi giặt, không dùng chất tẩy mạnh", "Phơi nơi thoáng, ủi nhiệt độ trung bình"],
  },
]

const DEFAULT_TIPS = ["Giặt nước lạnh với xà phòng dịu nhẹ", "Không dùng chất tẩy mạnh", "Phơi nơi thoáng mát, tránh nắng gắt"]

export function getCareTips(material: string): string[] {
  const m = material.toLowerCase()
  return (GROUPS.find((g) => g.test.test(m)) ?? { tips: DEFAULT_TIPS }).tips
}
