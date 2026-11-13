import type { ProductGender, ProductSort } from "@/lib/validators/product-filter"

/*
 * Từ điển đồng nghĩa, lóng và viết tắt tiếng Việt cho thời trang (docs/ai/02-semantic-search.md mục 5).
 * Chạy bằng code TRƯỚC bước LLM trích ý định: gợi ý thêm cho LLM, không phải bộ lọc cứng.
 * Mọi giá trị phải thuộc từ vựng thật của kho (test vi-synonyms.test.ts kiểm tra). Chưa nối vào luồng tìm kiếm.
 */

export type SynonymSeason = "xuân" | "hè" | "thu" | "đông"

export interface SynonymHint {
  /** Khoá nhóm sản phẩm (PRODUCT_GROUPS trong seed), chưa gắn giới tính. */
  category?: string
  gender?: ProductGender
  occasion?: string[]
  season?: SynonymSeason[]
  /** Token style trong DB (STYLE_LABEL). */
  style?: string[]
  /** Từ khoá chất liệu (văn bản tự do, không phải giá trị lọc cứng). */
  material?: string[]
  /** Tên màu tiếng Việt như trong kho. */
  color?: string[]
  sort?: Exclude<ProductSort, "price_desc">
  inStock?: true
  /** Khách muốn nhiều món phối cùng nhau (chuyển sang Mix & Match). */
  outfit?: true
  /** Kho chưa có loại này; lý do ngắn để báo khách. */
  outOfScope?: string
  /** Ý nghĩa còn lại đưa vào văn bản embedding. */
  semantic?: string[]
}

export interface SynonymEntry {
  terms: string[]
  hint: SynonymHint
}

export const VI_SYNONYMS: SynonymEntry[] = [
  // ───────── Loại đồ ─────────
  { terms: ["áo phông", "áo thun", "tee", "t-shirt", "tshirt"], hint: { category: "ao-thun" } },
  { terms: ["polo", "áo polo", "áo cá sấu"], hint: { category: "ao-thun", semantic: ["áo polo cá sấu"] } },
  { terms: ["sơ mi", "áo sơ mi", "somi"], hint: { category: "ao-so-mi" } },
  { terms: ["áo khoác", "khoác", "jacket", "coat"], hint: { category: "ao-khoac" } },
  { terms: ["bomber", "áo bomber"], hint: { category: "ao-khoac", semantic: ["bomber"] } },
  { terms: ["hoodie", "áo nỉ", "sweater", "sweatshirt"], hint: { semantic: ["hoodie áo nỉ"] } },
  { terms: ["blazer", "vest", "áo vest", "vét", "áo vét"], hint: { semantic: ["blazer vest"] } },
  { terms: ["quần bò", "quần jean", "quần jeans", "jean", "jeans", "qjean"], hint: { category: "quan-jeans" } },
  { terms: ["quần âu", "quần tây", "âu phục"], hint: { category: "quan-tay-kaki", style: ["formal"], semantic: ["quần tây công sở"] } },
  { terms: ["kaki", "quần kaki", "chinos", "kaki chinos"], hint: { category: "quan-tay-kaki" } },
  { terms: ["quần short", "quần đùi", "short", "quần ngố"], hint: { category: "quan-tay-kaki", season: ["hè"], semantic: ["quần short"] } },
  { terms: ["jogger", "quần jogger", "quần nỉ", "quần thun"], hint: { category: "quan-tay-kaki", semantic: ["quần jogger lưng thun"] } },
  { terms: ["đầm", "váy", "váy liền", "đầm liền", "váy đầm"], hint: { category: "vay-dam", gender: "women" } },
  { terms: ["chân váy", "chân váy bút chì", "skirt"], hint: { category: "quan-tay-kaki", gender: "women", semantic: ["chân váy"] } },
  { terms: ["áo dài", "áo dài cách tân"], hint: { category: "vay-dam", gender: "women", semantic: ["áo dài cách tân"] } },
  { terms: ["phụ kiện", "accessory", "accessories"], hint: { category: "phu-kien" } },
  { terms: ["thắt lưng", "dây nịt", "belt", "nịt"], hint: { category: "phu-kien", semantic: ["thắt lưng"] } },
  { terms: ["mũ", "nón", "cap", "bucket", "mũ lưỡi trai"], hint: { category: "phu-kien", semantic: ["mũ"] } },
  { terms: ["túi", "túi tote", "balo", "ba lô", "túi xách"], hint: { category: "phu-kien", semantic: ["túi balo"] } },
  { terms: ["khăn", "khăn choàng", "khăn quàng", "scarf"], hint: { category: "phu-kien", semantic: ["khăn"] } },
  { terms: ["kính", "kính mát", "kính râm"], hint: { category: "phu-kien", semantic: ["kính mát"] } },
  { terms: ["trang sức", "dây chuyền", "vòng cổ", "hoa tai", "khuyên tai"], hint: { category: "phu-kien", semantic: ["trang sức"] } },
  { terms: ["croptop", "áo lửng", "hở eo"], hint: { category: "ao-thun", gender: "women", semantic: ["croptop áo lửng"] } },
  { terms: ["hai dây", "2 dây", "ba lỗ", "sát nách", "tank"], hint: { semantic: ["áo hai dây ba lỗ"] } },
  { terms: ["áo len", "cardigan", "dệt kim"], hint: { material: ["len"], semantic: ["áo len dệt kim"] } },
  { terms: ["áo giữ nhiệt", "giữ nhiệt"], hint: { season: ["đông"], semantic: ["giữ nhiệt"] } },

  // ───────── Giới tính, người nhận ─────────
  // Mục unisex đứng trước nam/nữ: khi câu có cả "nam nữ", giá trị đơn đầu tiên thắng.
  { terms: ["unisex", "nam nữ", "nam và nữ", "đồ đôi", "áo đôi", "đồ cặp", "couple"], hint: { gender: "unisex", semantic: ["mặc chung nam nữ"] } },
  { terms: ["nam", "đồ nam", "cho nam", "nam giới", "đàn ông", "bạn trai", "cho chồng", "cho bạn trai", "cho bố", "cho ba", "cho anh", "cho em trai"], hint: { gender: "men" } },
  { terms: ["nữ", "đồ nữ", "cho nữ", "phái nữ", "bạn gái", "cho vợ", "cho bạn gái", "cho mẹ", "cho chị", "cho em gái"], hint: { gender: "women" } },

  // ───────── Dịp mặc (khớp OCCASIONS) ─────────
  { terms: ["công sở", "văn phòng", "office", "đi làm", "đồ đi làm"], hint: { occasion: ["đi làm"], style: ["smart-casual", "formal"] } },
  { terms: ["công tác", "đi công tác"], hint: { occasion: ["công tác"] } },
  { terms: ["đi họp", "họp hành", "meeting", "họp"], hint: { occasion: ["đi họp"], style: ["formal"] } },
  { terms: ["phỏng vấn", "đi phỏng vấn", "interview"], hint: { occasion: ["đi phỏng vấn"], style: ["formal"] } },
  { terms: ["đi học", "đến trường", "sinh viên", "student", "học sinh"], hint: { occasion: ["đi học"] } },
  { terms: ["đi chơi", "đi chơi cuối tuần", "dã ngoại", "picnic"], hint: { occasion: ["đi chơi"] } },
  { terms: ["đi chơi tối", "đi chơi đêm", "đi bar", "đi club", "đồ đi chơi tối"], hint: { occasion: ["đi chơi", "hẹn hò", "dự tiệc"] } },
  { terms: ["dạo phố", "xuống phố", "street style", "đi dạo"], hint: { occasion: ["dạo phố"] } },
  { terms: ["đi cafe", "cafe", "cà phê", "coffee", "ca phe"], hint: { occasion: ["đi cafe"] } },
  { terms: ["hẹn hò", "đi date", "date", "first date", "gặp người yêu"], hint: { occasion: ["hẹn hò"] } },
  { terms: ["dự tiệc", "đi tiệc", "party", "tiệc tùng", "dạ tiệc", "prom"], hint: { occasion: ["dự tiệc"] } },
  { terms: ["sự kiện", "dự sự kiện", "event", "khai trương", "ra mắt", "gala"], hint: { occasion: ["dự sự kiện"] } },
  { terms: ["đám cưới", "tiệc cưới", "ăn cưới", "đi cưới", "dự cưới", "wedding", "phù rể", "phù dâu", "đám hỏi"], hint: { occasion: ["dự đám cưới"] } },
  { terms: ["tết", "ngày tết", "tết nguyên đán", "năm mới", "mừng xuân"], hint: { occasion: ["dịp Tết"] } },
  { terms: ["đi chùa", "lễ chùa", "đi lễ", "đi lễ chùa", "đi lễ đầu năm"], hint: { occasion: ["đi lễ chùa"] } },
  { terms: ["du lịch", "đi du lịch", "travel", "nghỉ dưỡng", "resort", "đi chơi xa"], hint: { occasion: ["du lịch"] } },
  { terms: ["du lịch mùa đông", "đà lạt", "sapa", "săn mây", "du lịch lạnh"], hint: { occasion: ["du lịch mùa đông"], season: ["đông"], semantic: ["giữ ấm"] } },
  { terms: ["đi biển", "tắm biển", "beach", "nghỉ mát", "hồ bơi", "pool"], hint: { occasion: ["đi biển"], season: ["hè"] } },
  { terms: ["đi phượt", "phượt", "leo núi", "trekking", "camping"], hint: { occasion: ["đi phượt"] } },
  { terms: ["đi xe máy", "chạy xe máy", "lái xe"], hint: { occasion: ["đi xe máy"] } },
  { terms: ["tập gym", "gym", "tập thể thao", "chạy bộ", "yoga", "tennis", "golf", "đá bóng", "running", "workout", "đồ tập"], hint: { occasion: ["tập thể thao"] } },
  { terms: ["nghe nhạc", "đi nghe nhạc", "concert", "live show", "festival", "đi show"], hint: { occasion: ["đi nghe nhạc"] } },
  { terms: ["chụp ảnh", "chụp hình", "kỷ yếu", "photoshoot", "check-in", "check in", "sống ảo"], hint: { occasion: ["chụp ảnh"] } },
  { terms: ["ở nhà", "mặc nhà", "đồ ngủ", "pyjama", "homewear", "lounge"], hint: { occasion: ["ở nhà"] } },

  // ───────── Thời tiết, mùa ─────────
  { terms: ["mát", "mát mẻ", "thoáng", "thoáng mát", "trời nóng", "oi bức"], hint: { season: ["hè"], semantic: ["thoáng mát nhẹ", "linen cotton thun lạnh"] } },
  { terms: ["mùa hè", "nắng nóng", "summer", "đi nắng"], hint: { season: ["hè"] } },
  { terms: ["mùa đông", "trời lạnh", "rét", "giữ ấm", "ấm", "winter"], hint: { season: ["đông"], semantic: ["giữ ấm"] } },
  { terms: ["se lạnh", "giao mùa", "mùa thu"], hint: { season: ["thu", "xuân"] } },
  { terms: ["mùa xuân"], hint: { season: ["xuân"] } },
  { terms: ["trời mưa", "đi mưa", "chống nước", "chống thấm"], hint: { semantic: ["chống nước chống thấm"] } },
  { terms: ["ngoài trời", "outdoor"], hint: { semantic: ["ngoài trời", "chịu nắng"] } },

  // ───────── Phong cách (style token trong DB) ─────────
  { terms: ["sang chảnh", "lên đồ", "sang trọng", "đẳng cấp", "classy", "luxury"], hint: { style: ["elegant", "formal"] } },
  { terms: ["lịch sự", "lịch lãm", "chỉn chu", "đứng đắn", "trang trọng", "formal"], hint: { style: ["formal", "smart-casual", "elegant"] } },
  { terms: ["thanh lịch", "nhã nhặn", "duyên dáng"], hint: { style: ["elegant"] } },
  { terms: ["đơn giản", "basic", "tối giản", "minimal", "nhẹ nhàng"], hint: { style: ["minimalist"] } },
  { terms: ["cá tính", "ngầu", "bụi", "đường phố", "streetwear", "hiphop"], hint: { style: ["streetwear"] } },
  { terms: ["thể thao", "năng động", "sporty", "athleisure"], hint: { style: ["sporty"] } },
  { terms: ["cổ điển", "vintage", "retro", "hoài cổ"], hint: { style: ["vintage"] } },
  { terms: ["hàn quốc", "kiểu hàn", "korean", "ulzzang", "dễ thương", "cute"], hint: { style: ["korean"] } },
  { terms: ["boho", "bohemian", "hippie", "phóng khoáng"], hint: { style: ["bohemian"] } },
  { terms: ["smart casual", "sơ vin", "bảnh"], hint: { style: ["smart-casual"] } },
  { terms: ["thường ngày", "casual", "đời thường", "hằng ngày"], hint: { style: ["casual"] } },

  // ───────── Form, kiểu dáng (không có trường cấu trúc, đưa vào embedding) ─────────
  { terms: ["oversize", "form rộng", "thùng thình", "rộng rãi", "over"], hint: { semantic: ["oversize form rộng"] } },
  { terms: ["ôm", "ôm body", "bó", "slim", "slim fit", "body", "tôn dáng"], hint: { semantic: ["slim fit ôm dáng"] } },
  { terms: ["cạp cao", "lưng cao"], hint: { semantic: ["cạp cao"] } },
  { terms: ["ống rộng", "baggy", "wide leg", "culottes", "ống loe"], hint: { semantic: ["quần ống rộng"] } },
  { terms: ["ống đứng", "ống suông", "straight"], hint: { semantic: ["quần ống đứng suông"] } },
  { terms: ["skinny", "ôm chân", "ống côn"], hint: { semantic: ["quần ôm chân"] } },
  { terms: ["kẻ sọc", "sọc", "caro", "kẻ ca rô"], hint: { semantic: ["họa tiết kẻ sọc caro"] } },
  { terms: ["áo hoa", "váy hoa", "họa tiết hoa", "hoa nhí", "chấm bi"], hint: { semantic: ["họa tiết hoa chấm bi"] } },

  // ───────── Chất liệu ─────────
  { terms: ["linen", "vải lanh", "đũi", "vải đũi"], hint: { material: ["linen"] } },
  { terms: ["lụa", "satin", "lụa tơ tằm"], hint: { material: ["lụa satin"] } },
  { terms: ["áo da", "da thật", "da pu"], hint: { material: ["da"] } },
  { terms: ["thun lạnh", "thun mát"], hint: { material: ["thun lạnh"] } },
  { terms: ["cotton", "cotton 100", "thun cotton"], hint: { material: ["cotton"] } },

  // ───────── Màu (tên màu trong kho) ─────────
  { terms: ["màu nude", "nude"], hint: { color: ["Be", "Kem"] } },
  { terms: ["pastel", "màu pastel"], hint: { color: ["Hồng", "Xanh sage", "Tím lavender", "Xanh nhạt", "Kem"] } },
  { terms: ["màu trung tính", "neutral"], hint: { color: ["Đen", "Trắng", "Xám", "Be", "Kem"] } },
  { terms: ["màu đất"], hint: { color: ["Nâu", "Camel", "Cam đất", "Xanh rêu"] } },
  { terms: ["đỏ rượu", "đỏ mận", "đỏ rượu vang", "bordeaux"], hint: { color: ["Đỏ đô"] } },
  { terms: ["xanh than", "xanh đen", "navy", "xanh tím than"], hint: { color: ["Xanh navy"] } },
  { terms: ["xanh bộ đội", "xanh quân đội", "army", "olive"], hint: { color: ["Xanh rêu"] } },
  { terms: ["trắng kem", "trắng ngà", "off white"], hint: { color: ["Kem"] } },
  { terms: ["nâu bò", "da bò", "tan"], hint: { color: ["Nâu bò"] } },
  { terms: ["xanh mint", "xanh bạc hà"], hint: { color: ["Xanh sage"] } },
  { terms: ["ghi xám", "xám tro"], hint: { color: ["Xám"] } },
  { terms: ["hồng phấn", "hồng baby"], hint: { color: ["Hồng"] } },

  // ───────── Ý định mua, sắp xếp, tồn kho ─────────
  { terms: ["rẻ", "bình dân", "tiết kiệm"], hint: { sort: "price_asc" } },
  { terms: ["mới về", "hàng mới"], hint: { sort: "newest" } },
  { terms: ["hot", "hot trend", "bán chạy", "best seller", "trend"], hint: { sort: "popular" } },
  { terms: ["còn hàng", "còn size", "có sẵn"], hint: { inStock: true } },
  { terms: ["quà tặng", "tặng", "làm quà", "biếu"], hint: { category: "phu-kien", semantic: ["quà tặng"] } },
  { terms: ["set", "cả bộ", "outfit", "phối đồ", "mix match", "bộ đồ", "full set", "combo"], hint: { outfit: true } },
  { terms: ["trẻ em", "em bé", "kids", "đồ bé"], hint: { outOfScope: "Cửa hàng chưa có quần áo trẻ em" } },
]

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

const stripAccents = (s: string) =>
  fold(s.normalize("NFD").replace(/\p{M}+/gu, "").replace(/đ/g, "d"))

interface CompiledEntry {
  accented: string[]
  plain: string[]
  hint: SynonymHint
}

const COMPILED: CompiledEntry[] = VI_SYNONYMS.map((e) => ({
  accented: e.terms.map(fold),
  plain: e.terms.map(stripAccents),
  hint: e.hint,
}))

const matchesAny = (haystack: string, terms: string[]) => terms.some((t) => haystack.includes(` ${t} `))

/** Gộp hai gợi ý: mảng lấy hợp, giá trị đơn lấy cái đầu tiên, cờ lấy OR. */
function mergeHints(acc: SynonymHint, next: SynonymHint): SynonymHint {
  const out: SynonymHint = { ...acc }
  for (const [key, value] of Object.entries(next) as [keyof SynonymHint, unknown][]) {
    if (value === undefined) continue
    const current = out[key]
    if (Array.isArray(value)) {
      ;(out as Record<string, unknown>)[key] = [...new Set([...((current as unknown[]) ?? []), ...value])]
    } else if (current === undefined) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

/**
 * Tìm mọi mục từ điển xuất hiện trong câu truy vấn (khớp nguyên từ) rồi gộp gợi ý.
 * Câu có dấu so khớp theo dạng có dấu để "lạnh" không lẫn với "lanh" (vải lanh); câu không dấu so khớp theo dạng bỏ dấu.
 * Giới hạn: câu gõ lẫn có dấu và không dấu chỉ so khớp phần có dấu.
 */
export function findSynonymHints(query: string): SynonymHint {
  const accented = ` ${fold(query)} `
  const plain = ` ${stripAccents(query)} `
  const usePlain = accented === plain
  let result: SynonymHint = {}
  for (const entry of COMPILED) {
    const hit = usePlain ? matchesAny(plain, entry.plain) : matchesAny(accented, entry.accented)
    if (hit) result = mergeHints(result, entry.hint)
  }
  return result
}
