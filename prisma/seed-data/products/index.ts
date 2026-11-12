import type { ProductSeed } from "../types";
import { AO_KHOAC } from "./ao-khoac";
import { AO_SO_MI } from "./ao-so-mi";
import { AO_THUN } from "./ao-thun";
import { PHU_KIEN } from "./phu-kien";
import { QUAN_JEANS } from "./quan-jeans";
import { QUAN_TAY_KAKI } from "./quan-tay-kaki";
import { VAY_DAM } from "./vay-dam";
import { VEST_DU_TIEC_NAM } from "./vest-du-tiec-nam";

/** Key = tên nhóm, khớp `PRODUCT_GROUPS` trong categories.ts. Category lá được chọn theo giới tính của từng sản phẩm. */
export const PRODUCTS_BY_GROUP: Record<string, ProductSeed[]> = {
  "ao-thun": AO_THUN,
  "ao-so-mi": AO_SO_MI,
  "ao-khoac": AO_KHOAC,
  "quan-jeans": QUAN_JEANS,
  "quan-tay-kaki": QUAN_TAY_KAKI,
  "vay-dam": VAY_DAM,
  "vest-du-tiec-nam": VEST_DU_TIEC_NAM,
  "phu-kien": PHU_KIEN,
};
