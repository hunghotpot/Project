import "server-only"
import type { Prisma } from "@prisma/client"
import {
  MAX_LINE_QUANTITY,
  summarizeCart,
  EMPTY_CART,
  type CartLine,
  type CartView,
  type CartWarning,
} from "@/lib/cart"
import { formatVnd } from "@/lib/format"
import { db } from "@/server/db"

/*
 * Giỏ hàng. Mọi hàm nhận `ctx` ({ userId }) làm tham số và KHÔNG đọc cookie/headers,
 * nên Route Handler, Server Action và AI tool-calling đều gọi lại được.
 * Giỏ hàng chỉ dành cho user đã đăng nhập (không có giỏ khách).
 * Tồn kho chỉ được kiểm tra (không giữ chỗ); việc trừ kho nằm ở bước đặt hàng.
 */

export type CartContext = { userId: string }

export type CartErrorCode =
  | "INVALID_QUANTITY"
  | "VARIANT_NOT_FOUND"
  | "OUT_OF_STOCK"
  | "INSUFFICIENT_STOCK"
  | "ITEM_NOT_FOUND"

export class CartError extends Error {
  constructor(
    public readonly code: CartErrorCode,
    message: string,
    /** INSUFFICIENT_STOCK: số lượng tối đa còn có thể thêm. */
    public readonly available?: number
  ) {
    super(message)
    this.name = "CartError"
  }
}

type Db = Prisma.TransactionClient

const itemSelect = {
  quantity: true,
  priceAtAdd: true,
  variant: {
    select: {
      id: true,
      sku: true,
      size: true,
      color: true,
      colorHex: true,
      price: true,
      stock: true,
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          isActive: true,
          images: { orderBy: { position: "asc" }, take: 1, select: { url: true, alt: true } },
        },
      },
    },
  },
} satisfies Prisma.CartItemSelect

type ItemRow = Prisma.CartItemGetPayload<{ select: typeof itemSelect }>

function ownerWhere(ctx: CartContext): { userId: string } {
  if (!ctx.userId) throw new CartError("ITEM_NOT_FOUND", "Không xác định được giỏ hàng")
  return { userId: ctx.userId }
}

function assertQuantity(quantity: number, min: 0 | 1) {
  if (!Number.isInteger(quantity) || quantity < min || quantity > MAX_LINE_QUANTITY) {
    throw new CartError(
      "INVALID_QUANTITY",
      min === 1 ? `Số lượng phải từ 1 đến ${MAX_LINE_QUANTITY}` : `Số lượng phải từ 0 đến ${MAX_LINE_QUANTITY}`
    )
  }
}

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002"
}

async function getOrCreateCart(ctx: CartContext, client: Db): Promise<{ id: string }> {
  const where = ownerWhere(ctx)
  const existing = await client.cart.findFirst({ where, select: { id: true } })
  if (existing) return existing
  try {
    return await client.cart.create({ data: where, select: { id: true } })
  } catch (e) {
    // Hai request đầu tiên của cùng một user chạy song song: unique index chốt, bên thua lấy giỏ của bên thắng.
    if (!isUniqueViolation(e)) throw e
    const again = await client.cart.findFirst({ where, select: { id: true } })
    if (again) return again
    throw e
  }
}

async function loadVariant(client: Db, variantId: string) {
  const v = await client.productVariant.findUnique({
    where: { id: variantId },
    select: { id: true, price: true, stock: true, product: { select: { isActive: true } } },
  })
  if (!v || !v.product.isActive) throw new CartError("VARIANT_NOT_FOUND", "Sản phẩm không tồn tại hoặc đã ngừng bán")
  return v
}

function toLine(row: ItemRow): CartLine {
  const { variant: v, quantity } = row
  const warnings: CartWarning[] = []
  if (!v.product.isActive) {
    warnings.push({ code: "UNAVAILABLE", message: "Sản phẩm không còn được bán" })
  } else if (v.stock <= 0) {
    warnings.push({ code: "OUT_OF_STOCK", message: "Sản phẩm đã hết hàng" })
  } else if (quantity > v.stock) {
    warnings.push({ code: "STOCK_REDUCED", message: `Kho chỉ còn ${v.stock} sản phẩm, vui lòng giảm số lượng` })
  }
  if (row.priceAtAdd !== null && row.priceAtAdd !== v.price) {
    warnings.push({
      code: "PRICE_CHANGED",
      message: `Giá đã thay đổi từ ${formatVnd(row.priceAtAdd)} thành ${formatVnd(v.price)}`,
    })
  }
  return {
    variantId: v.id,
    productId: v.product.id,
    slug: v.product.slug,
    name: v.product.name,
    sku: v.sku,
    size: v.size,
    color: v.color,
    colorHex: v.colorHex,
    image: v.product.images[0] ?? null,
    unitPrice: v.price,
    quantity,
    lineTotal: v.price * quantity,
    stock: v.stock,
    warnings,
  }
}

async function loadView(cartId: string | null, client: Db = db): Promise<CartView> {
  if (!cartId) return EMPTY_CART
  const rows = await client.cartItem.findMany({
    where: { cartId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: itemSelect,
  })
  return summarizeCart(rows.map(toLine))
}

/** Giỏ hiện tại; chưa có giỏ thì trả giỏ rỗng (không tạo bản ghi). */
export async function getCart(ctx: CartContext): Promise<CartView> {
  const cart = await db.cart.findFirst({ where: ownerWhere(ctx), select: { id: true } })
  return loadView(cart?.id ?? null)
}

/** Thêm `quantity` vào dòng của biến thể (cộng dồn); tổng không được vượt tồn kho. */
export async function addItem(ctx: CartContext, variantId: string, quantity: number): Promise<CartView> {
  assertQuantity(quantity, 1)
  const cartId = await db.$transaction(async (tx) => {
    const variant = await loadVariant(tx, variantId)
    if (variant.stock <= 0) throw new CartError("OUT_OF_STOCK", "Sản phẩm đã hết hàng")

    const cart = await getOrCreateCart(ctx, tx)
    const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, variantId } })
    const inCart = existing?.quantity ?? 0
    if (inCart + quantity > variant.stock) {
      const canAdd = Math.max(variant.stock - inCart, 0)
      throw new CartError(
        "INSUFFICIENT_STOCK",
        inCart > 0
          ? `Giỏ hàng đã có ${inCart} sản phẩm này, kho chỉ còn ${variant.stock}`
          : `Kho chỉ còn ${variant.stock} sản phẩm`,
        canAdd
      )
    }
    if (existing) {
      await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: inCart + quantity, priceAtAdd: variant.price } })
    } else {
      await tx.cartItem.create({ data: { cartId: cart.id, variantId, quantity, priceAtAdd: variant.price } })
    }
    return cart.id
  })
  return loadView(cartId)
}

export interface ClampedAddResult {
  added: { variantId: string; quantity: number }[]
  skipped: { variantId: string; reason: "OUT_OF_STOCK" | "UNAVAILABLE" | "IN_CART_MAX" }[]
}

/**
 * Thêm nhiều dòng theo kiểu "cố gắng hết mức" (dùng cho Mua lại): dòng nào thiếu hàng thì thêm phần còn lại, hết hẳn hoặc
 * ngừng bán thì bỏ qua và báo lý do — không ném lỗi. Tổng trong giỏ không bao giờ vượt tồn kho.
 */
export async function addItemsClamped(
  ctx: CartContext,
  lines: { variantId: string; quantity: number }[]
): Promise<ClampedAddResult> {
  const result: ClampedAddResult = { added: [], skipped: [] }
  if (lines.length === 0) return result

  await db.$transaction(async (tx) => {
    const cart = await getOrCreateCart(ctx, tx)
    for (const line of lines) {
      assertQuantity(line.quantity, 1)
      const variant = await tx.productVariant.findUnique({
        where: { id: line.variantId },
        select: { id: true, price: true, stock: true, product: { select: { isActive: true } } },
      })
      if (!variant || !variant.product.isActive) {
        result.skipped.push({ variantId: line.variantId, reason: "UNAVAILABLE" })
        continue
      }
      if (variant.stock <= 0) {
        result.skipped.push({ variantId: line.variantId, reason: "OUT_OF_STOCK" })
        continue
      }
      const existing = await tx.cartItem.findFirst({ where: { cartId: cart.id, variantId: line.variantId } })
      const inCart = existing?.quantity ?? 0
      const room = Math.min(variant.stock, MAX_LINE_QUANTITY) - inCart
      if (room <= 0) {
        result.skipped.push({ variantId: line.variantId, reason: "IN_CART_MAX" })
        continue
      }
      const add = Math.min(line.quantity, room)
      if (existing) {
        await tx.cartItem.update({ where: { id: existing.id }, data: { quantity: inCart + add, priceAtAdd: variant.price } })
      } else {
        await tx.cartItem.create({
          data: { cartId: cart.id, variantId: line.variantId, quantity: add, priceAtAdd: variant.price },
        })
      }
      result.added.push({ variantId: line.variantId, quantity: add })
    }
  })
  return result
}

/** Đặt số lượng tuyệt đối của một dòng. `quantity = 0` xoá dòng. */
export async function updateQuantity(ctx: CartContext, variantId: string, quantity: number): Promise<CartView> {
  assertQuantity(quantity, 0)
  const cartId = await db.$transaction(async (tx) => {
    const cart = await tx.cart.findFirst({ where: ownerWhere(ctx), select: { id: true } })
    const item = cart && (await tx.cartItem.findFirst({ where: { cartId: cart.id, variantId } }))
    if (!cart || !item) throw new CartError("ITEM_NOT_FOUND", "Sản phẩm không có trong giỏ hàng")

    if (quantity === 0) {
      await tx.cartItem.delete({ where: { id: item.id } })
      return cart.id
    }
    const variant = await loadVariant(tx, variantId)
    if (quantity > variant.stock) {
      throw new CartError("INSUFFICIENT_STOCK", `Kho chỉ còn ${variant.stock} sản phẩm`, variant.stock)
    }
    await tx.cartItem.update({ where: { id: item.id }, data: { quantity, priceAtAdd: variant.price } })
    return cart.id
  })
  return loadView(cartId)
}

/** Xoá dòng; dòng không có trong giỏ thì bỏ qua (idempotent). */
export async function removeItem(ctx: CartContext, variantId: string): Promise<CartView> {
  const cart = await db.cart.findFirst({ where: ownerWhere(ctx), select: { id: true } })
  if (!cart) return EMPTY_CART
  await db.cartItem.deleteMany({ where: { cartId: cart.id, variantId } })
  return loadView(cart.id)
}

export async function clearCart(ctx: CartContext): Promise<CartView> {
  const cart = await db.cart.findFirst({ where: ownerWhere(ctx), select: { id: true } })
  if (cart) await db.cartItem.deleteMany({ where: { cartId: cart.id } })
  return EMPTY_CART
}
