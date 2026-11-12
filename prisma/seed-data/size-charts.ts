import type { SizeChartSeed } from "./types";

// Số đo cơ thể người mặc (cm / kg), tham chiếu theo bảng size phổ biến tại Việt Nam.
// Dùng để AI gợi ý size theo chiều cao / cân nặng / số đo.

type Row = [size: string, chest: number | undefined, waist: number, hip: number, h: [number, number], w: [number, number]];

function chart(categorySlug: string, rows: Row[], brand?: string): SizeChartSeed[] {
  return rows.map(([size, chest, waist, hip, h, w]) => ({
    categorySlug,
    brand,
    size,
    chest,
    waist,
    hip,
    heightMin: h[0],
    heightMax: h[1],
    weightMin: w[0],
    weightMax: w[1],
  }));
}

// Áo (áo thun, sơ mi, khoác): form regular.
const TOP: Row[] = [
  ["S", 88, 74, 90, [160, 167], [50, 58]],
  ["M", 92, 78, 94, [165, 172], [58, 66]],
  ["L", 96, 82, 98, [170, 177], [66, 74]],
  ["XL", 100, 86, 102, [175, 182], [74, 82]],
];

// Quần: size theo vòng eo tính bằng inch (28-34).
const PANT: Row[] = [
  ["28", undefined, 71, 90, [160, 166], [50, 56]],
  ["29", undefined, 74, 92, [162, 168], [53, 59]],
  ["30", undefined, 76, 94, [164, 170], [56, 62]],
  ["31", undefined, 79, 96, [166, 172], [59, 65]],
  ["32", undefined, 81, 98, [168, 174], [62, 68]],
  ["33", undefined, 84, 100, [170, 176], [65, 71]],
  ["34", undefined, 86, 102, [172, 178], [68, 74]],
];

// Quần nữ: size theo vòng eo tính bằng inch (26-32). Số đo ước lượng, chưa hiệu chỉnh với dữ liệu thật.
const WOMEN_PANT: Row[] = [
  ["26", undefined, 66, 88, [150, 156], [40, 45]],
  ["27", undefined, 69, 90, [152, 158], [43, 48]],
  ["28", undefined, 71, 92, [154, 160], [46, 51]],
  ["29", undefined, 74, 94, [156, 162], [49, 54]],
  ["30", undefined, 76, 96, [158, 164], [52, 57]],
  ["31", undefined, 79, 98, [160, 166], [55, 60]],
  ["32", undefined, 81, 100, [162, 168], [58, 63]],
];

// Váy đầm (nữ). Cũng là số đo cơ thể của áo nữ.
const DRESS: Row[] = [
  ["S", 82, 64, 90, [155, 160], [44, 48]],
  ["M", 86, 68, 94, [158, 163], [48, 53]],
  ["L", 90, 72, 98, [161, 166], [53, 58]],
  ["XL", 94, 76, 102, [164, 169], [58, 64]],
];

// Urban Ghost cắt oversize nên mỗi size rộng hơn bảng chung ~1 size.
const OVERSIZE_TEE: Row[] = [
  ["S", 104, 90, 104, [158, 168], [48, 60]],
  ["M", 108, 94, 108, [163, 173], [56, 68]],
  ["L", 112, 98, 112, [168, 178], [64, 76]],
  ["XL", 116, 102, 116, [173, 183], [72, 86]],
];

// Mỗi category lá một bảng riêng. Nam và Unisex dùng số đo form regular (TOP/PANT); Nữ dùng số đo cơ thể nữ.
// Urban Ghost (toàn bộ áo thun thương hiệu này là unisex) cắt oversize nên có bảng riêng ở áo thun unisex.
export const SIZE_CHARTS: SizeChartSeed[] = [
  ...["ao-thun-nam", "ao-so-mi-nam", "ao-khoac-nam", "vest-du-tiec-nam"].flatMap((slug) => chart(slug, TOP)),
  ...["quan-jeans-nam", "quan-tay-kaki-nam"].flatMap((slug) => chart(slug, PANT)),

  ...["ao-thun-nu", "ao-so-mi-nu", "ao-khoac-nu", "vay-dam"].flatMap((slug) => chart(slug, DRESS)),
  ...["quan-jeans-nu", "quan-tay-kaki-nu"].flatMap((slug) => chart(slug, WOMEN_PANT)),

  ...["ao-thun-unisex", "ao-so-mi-unisex", "ao-khoac-unisex"].flatMap((slug) => chart(slug, TOP)),
  ...chart("ao-thun-unisex", OVERSIZE_TEE, "Urban Ghost"),
  ...chart("quan-unisex", PANT),
];
