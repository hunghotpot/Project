// Từ vựng dùng chung cho dữ liệu seed: màu, chất liệu, mùa.

export const COLORS = {
  white: { name: "Trắng", hex: "#FFFFFF", code: "WHT" },
  black: { name: "Đen", hex: "#111111", code: "BLK" },
  grey: { name: "Xám", hex: "#9CA3AF", code: "GRY" },
  navy: { name: "Xanh navy", hex: "#1F2A44", code: "NVY" },
  beige: { name: "Be", hex: "#D8C3A5", code: "BGE" },
  cream: { name: "Kem", hex: "#F3EBD8", code: "CRM" },
  brown: { name: "Nâu", hex: "#7B5B3A", code: "BRN" },
  tan: { name: "Nâu bò", hex: "#A5682A", code: "TAN" },
  camel: { name: "Camel", hex: "#C19A6B", code: "CML" },
  khaki: { name: "Kaki", hex: "#B8A074", code: "KHK" },
  olive: { name: "Xanh rêu", hex: "#6B7A3A", code: "OLV" },
  sage: { name: "Xanh sage", hex: "#9CAF88", code: "SGE" },
  green: { name: "Xanh lá", hex: "#3E7B4F", code: "GRN" },
  blue: { name: "Xanh dương", hex: "#3B6FB6", code: "BLU" },
  lightblue: { name: "Xanh nhạt", hex: "#A9C7E8", code: "LBL" },
  indigo: { name: "Xanh denim đậm", hex: "#2B3F5E", code: "IND" },
  lightdenim: { name: "Xanh denim nhạt", hex: "#7E9CC0", code: "LDN" },
  red: { name: "Đỏ", hex: "#C0392B", code: "RED" },
  burgundy: { name: "Đỏ đô", hex: "#7A1F2B", code: "BUR" },
  pink: { name: "Hồng", hex: "#F2B5C4", code: "PNK" },
  yellow: { name: "Vàng", hex: "#E8C547", code: "YLW" },
  orange: { name: "Cam đất", hex: "#C8692F", code: "ORG" },
  lavender: { name: "Tím lavender", hex: "#B9A7D6", code: "LAV" },
  gold: { name: "Vàng gold", hex: "#C9A227", code: "GLD" },
  silver: { name: "Bạc", hex: "#C0C0C0", code: "SLV" },
} as const;

export type ColorKey = keyof typeof COLORS;

export type Season = "xuân" | "hè" | "thu" | "đông";
export const ALL_YEAR: Season[] = ["xuân", "hè", "thu", "đông"];

// label: lưu vào Product.material; blurb: câu mô tả chèn vào description.
export const MATERIALS = {
  cotton: {
    label: "Cotton 100%",
    blurb: "Chất liệu cotton 100% mềm mại, thấm hút mồ hôi tốt và thoáng khí nên mặc cả ngày vẫn dễ chịu.",
  },
  "cotton-compact": {
    label: "Cotton compact 250gsm",
    blurb: "Vải cotton compact dày dặn 250gsm, bề mặt mịn, đứng form và ít bai giãn sau nhiều lần giặt.",
  },
  "cotton-spandex": {
    label: "Cotton pha spandex",
    blurb: "Vải cotton pha spandex co giãn nhẹ bốn chiều, ôm vừa vặn mà không gây gò bó khi vận động.",
  },
  "organic-cotton": {
    label: "Cotton hữu cơ (organic)",
    blurb: "Sợi cotton hữu cơ không dùng hoá chất tẩy nhuộm mạnh, rất lành cho làn da nhạy cảm và thân thiện với môi trường.",
  },
  pique: {
    label: "Cotton cá sấu (piqué)",
    blurb: "Vải cá sấu piqué có bề mặt lỗ nhỏ li ti giúp thoáng khí, giữ dáng cổ và tay áo rất tốt.",
  },
  rib: {
    label: "Cotton gân (rib)",
    blurb: "Vải gân rib co giãn tốt, ôm dáng gọn gàng và tôn đường cong tự nhiên của cơ thể.",
  },
  "french-terry": {
    label: "Cotton French terry",
    blurb: "Nỉ French terry mặt trong là các vòng sợi mềm, giữ ấm nhẹ nhưng không bí, bề mặt ngoài mịn đẹp.",
  },
  fleece: {
    label: "Nỉ bông (fleece)",
    blurb: "Lớp nỉ bông mịn ở mặt trong giữ nhiệt hiệu quả, cầm nhẹ tay và không xù lông sau khi giặt.",
  },
  "cotton-knit": {
    label: "Cotton dệt kim",
    blurb: "Vải cotton dệt kim mềm, co giãn và có độ rủ tự nhiên, mặc lên nhìn lịch sự mà vẫn thoải mái.",
  },
  knit: {
    label: "Len dệt kim",
    blurb: "Sợi len dệt kim mềm mịn, giữ ấm tốt và hạn chế xù lông, cảm giác mặc êm ái trên da.",
  },
  "wool-acrylic": {
    label: "Len acrylic pha wool",
    blurb: "Len acrylic pha wool mềm, nhẹ và ấm, không gây ngứa như len thô thông thường.",
  },
  "wool-blend": {
    label: "Dạ pha wool",
    blurb: "Vải dạ pha wool dày dặn, giữ ấm tốt nhưng vẫn nhẹ, bề mặt đẹp và đứng form chắc chắn.",
  },
  sherpa: {
    label: "Lông cừu nhân tạo (sherpa)",
    blurb: "Lớp lông cừu nhân tạo sherpa dày xốp, ấm áp như được ôm trong chăn, phù hợp những ngày se lạnh.",
  },
  linen: {
    label: "Linen (lanh)",
    blurb: "Vải linen tự nhiên rất thoáng mát, hơi nhăn nhẹ tạo vẻ phóng khoáng và càng giặt càng mềm.",
  },
  "linen-cotton": {
    label: "Linen pha cotton",
    blurb: "Vải linen pha cotton giữ được độ mát của lanh nhưng mềm và ít nhăn hơn, dễ chăm sóc hằng ngày.",
  },
  dui: {
    label: "Vải đũi",
    blurb: "Vải đũi mộc có vân dệt đặc trưng, thoáng mát và mang nét thủ công mộc mạc rất riêng.",
  },
  oxford: {
    label: "Cotton Oxford",
    blurb: "Vải Oxford dệt rổ chắc tay, ít nhăn, bề mặt có vân nhẹ nhìn lịch sự nhưng không quá cứng.",
  },
  poplin: {
    label: "Cotton poplin",
    blurb: "Vải poplin mỏng nhẹ, bề mặt mịn mượt, ít nhăn và thoáng khi mặc trong thời tiết nóng.",
  },
  tencel: {
    label: "Tencel (lyocell)",
    blurb: "Sợi Tencel từ gỗ tự nhiên mát lạnh khi chạm vào, rủ nhẹ và kháng khuẩn tự nhiên.",
  },
  flannel: {
    label: "Cotton flannel",
    blurb: "Vải flannel cotton chải mềm, dày vừa phải, giữ ấm nhẹ và cho cảm giác ấm áp ngay khi khoác lên.",
  },
  viscose: {
    label: "Viscose",
    blurb: "Vải viscose mềm mại, rủ đẹp và có độ mát như lụa, rất hợp với thời tiết nóng ẩm.",
  },
  satin: {
    label: "Satin lụa",
    blurb: "Vải satin bóng mờ mềm mượt, buông rủ duyên dáng và bắt sáng rất đẹp khi diện buổi tối.",
  },
  silk: {
    label: "Lụa tơ tằm",
    blurb: "Lụa tơ tằm óng ả, mát nhẹ và mềm mịn, mang lại vẻ sang trọng tự nhiên.",
  },
  chiffon: {
    label: "Chiffon (voan)",
    blurb: "Vải chiffon mỏng nhẹ, bay bổng theo từng bước đi, có lớp lót bên trong để không bị xuyên thấu.",
  },
  crepe: {
    label: "Crepe",
    blurb: "Vải crepe có độ rủ tốt, bề mặt hơi sần nhẹ, ít nhăn và giữ dáng gọn gàng cả ngày dài.",
  },
  lace: {
    label: "Ren cao cấp",
    blurb: "Ren hoa văn tinh xảo phối lớp lót mềm, vừa nữ tính vừa thanh lịch, mặc lâu không ngứa.",
  },
  "poly-rayon": {
    label: "Polyester pha rayon",
    blurb: "Vải polyester pha rayon đứng dáng, ít nhăn, rủ đẹp và nhanh khô, rất phù hợp môi trường văn phòng.",
  },
  denim: {
    label: "Denim cotton",
    blurb: "Vải denim cotton dày dặn, bền màu, càng mặc càng lên dáng và có độ phai tự nhiên rất đẹp.",
  },
  "denim-stretch": {
    label: "Denim co giãn",
    blurb: "Denim pha sợi co giãn nhẹ giúp ôm dáng mà vẫn dễ cử động, ngồi lâu không bị cấn.",
  },
  "denim-raw": {
    label: "Denim thô (raw selvedge)",
    blurb: "Denim thô dệt biên selvedge chưa qua wash, cứng cáp và sẽ dần lên màu, in dấu thói quen của chủ nhân.",
  },
  kaki: {
    label: "Kaki cotton",
    blurb: "Vải kaki cotton đứng form, bền chắc và ít xù, mặc đi làm hay đi chơi đều gọn gàng.",
  },
  "kaki-stretch": {
    label: "Kaki co giãn",
    blurb: "Kaki pha spandex co giãn nhẹ, đứng dáng nhưng không cứng, ngồi xe máy hay ngồi bàn làm việc đều thoải mái.",
  },
  nylon: {
    label: "Nylon dù",
    blurb: "Lớp nylon dù nhẹ, cản gió tốt, bề mặt trơn nên ít bám bụi và nhanh khô.",
  },
  "nylon-water": {
    label: "Polyester tráng chống nước",
    blurb: "Vải polyester phủ lớp chống thấm giúp kháng nước nhẹ, cản gió và hạn chế bám bẩn khi di chuyển ngoài trời.",
  },
  puffer: {
    label: "Nylon trần bông / lông vũ",
    blurb: "Lớp ngoài nylon bóng nhẹ trần bông ấm, trọng lượng thấp nhưng giữ nhiệt rất tốt, có thể gấp gọn khi mang theo.",
  },
  pu: {
    label: "Da PU cao cấp",
    blurb: "Da PU mềm, bề mặt mịn có độ bóng vừa phải, dễ lau chùi và không bong tróc khi sử dụng đúng cách.",
  },
  leather: {
    label: "Da bò thật",
    blurb: "Da bò thật được thuộc kỹ, vân da tự nhiên, càng dùng càng lên màu và bền bỉ theo năm tháng.",
  },
  canvas: {
    label: "Canvas cotton",
    blurb: "Vải canvas cotton dày dặn, chịu lực tốt và có form cứng cáp, dùng hằng ngày vẫn bền.",
  },
  sport: {
    label: "Thun lạnh (polyester spandex)",
    blurb: "Vải thun lạnh polyester spandex thấm hút và khô rất nhanh, co giãn bốn chiều giúp vận động thoải mái.",
  },
  acetate: {
    label: "Gọng nhựa acetate",
    blurb: "Gọng acetate nhẹ, bóng đẹp và bền màu, tròng kính chống tia UV400 bảo vệ mắt khi đi ngoài nắng.",
  },
  steel: {
    label: "Thép không gỉ",
    blurb: "Thép không gỉ mạ bền màu, không gây dị ứng và không bị xỉn khi tiếp xúc mồ hôi hay nước.",
  },
} as const;

export type MaterialKey = keyof typeof MATERIALS;
