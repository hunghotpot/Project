import type { ProductSeed } from "../types";
import { AO_KHOAC } from "./ao-khoac";
import { AO_SO_MI } from "./ao-so-mi";
import { AO_THUN } from "./ao-thun";
import { PHU_KIEN } from "./phu-kien";
import { QUAN_JEANS } from "./quan-jeans";
import { QUAN_TAY_KAKI } from "./quan-tay-kaki";
import { VAY_DAM } from "./vay-dam";

/** Key = slug của category lá. */
export const PRODUCTS_BY_CATEGORY: Record<string, ProductSeed[]> = {
  "ao-thun": AO_THUN,
  "ao-so-mi": AO_SO_MI,
  "ao-khoac": AO_KHOAC,
  "quan-jeans": QUAN_JEANS,
  "quan-tay-kaki": QUAN_TAY_KAKI,
  "vay-dam": VAY_DAM,
  "phu-kien": PHU_KIEN,
};
