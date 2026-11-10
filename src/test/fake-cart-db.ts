/* eslint-disable @typescript-eslint/no-explicit-any */
// Prisma giả lập in-memory, đủ các thao tác mà cart.service dùng.

interface VariantRec {
  id: string
  sku: string
  size: string
  color: string
  colorHex: string
  price: number
  stock: number
  productId: string
}
interface ProductRec {
  id: string
  name: string
  slug: string
  isActive: boolean
  images: { url: string; alt: string }[]
}
interface CartRec {
  id: string
  userId: string | null
  sessionId: string | null
}
interface ItemRec {
  id: string
  cartId: string
  variantId: string
  quantity: number
  priceAtAdd: number | null
  createdAt: number
}

const products: ProductRec[] = []
const variants: VariantRec[] = []
const carts: CartRec[] = []
let items: ItemRec[] = []
let seq = 0

function matches(rec: Record<string, any>, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([k, v]) => rec[k] === v)
}

function joinItem(it: ItemRec) {
  const v = variants.find((x) => x.id === it.variantId)!
  const p = products.find((x) => x.id === v.productId)!
  return { ...it, variant: { ...v, product: p } }
}

const fake: any = {
  cart: {
    findFirst: async ({ where }: any) => carts.find((c) => matches(c, where)) ?? null,
    create: async ({ data }: any) => {
      const dup = carts.some(
        (c) => (data.userId && c.userId === data.userId) || (data.sessionId && c.sessionId === data.sessionId)
      )
      if (dup) throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      const rec: CartRec = { id: `c${++seq}`, userId: null, sessionId: null, ...data }
      carts.push(rec)
      return rec
    },
    delete: async ({ where }: any) => {
      const i = carts.findIndex((c) => c.id === where.id)
      items = items.filter((it) => it.cartId !== where.id) // onDelete: Cascade
      return carts.splice(i, 1)[0]
    },
  },
  cartItem: {
    findFirst: async ({ where }: any) => items.find((it) => matches(it, where)) ?? null,
    findMany: async ({ where, select }: any) => {
      const rows = items.filter((it) => matches(it, where))
      return select?.variant ? rows.map(joinItem) : rows
    },
    create: async ({ data }: any) => {
      const rec: ItemRec = { id: `i${++seq}`, priceAtAdd: null, createdAt: seq, ...data }
      items.push(rec)
      return rec
    },
    update: async ({ where, data }: any) => Object.assign(items.find((it) => it.id === where.id)!, data),
    delete: async ({ where }: any) => {
      items = items.filter((it) => it.id !== where.id)
    },
    deleteMany: async ({ where }: any) => {
      const before = items.length
      items = items.filter((it) => !matches(it, where))
      return { count: before - items.length }
    },
  },
  productVariant: {
    findUnique: async ({ where }: any) => {
      const v = variants.find((x) => x.id === where.id)
      return v ? { ...v, product: products.find((p) => p.id === v.productId) } : null
    },
  },
  $transaction: async (fn: any) => fn(fake),
}

export const fakeCartDb = fake

export const fakeCartStore = {
  reset() {
    products.length = variants.length = carts.length = 0
    items = []
  },
  /** Tạo sản phẩm 1 biến thể. */
  addVariant(opts: { id: string; stock: number; price?: number; isActive?: boolean }) {
    const productId = `p-${opts.id}`
    products.push({ id: productId, name: `SP ${opts.id}`, slug: `sp-${opts.id}`, isActive: opts.isActive ?? true, images: [] })
    variants.push({
      id: opts.id,
      sku: `SKU-${opts.id}`,
      size: "M",
      color: "Đen",
      colorHex: "#111",
      price: opts.price ?? 100_000,
      stock: opts.stock,
      productId,
    })
  },
  setStock(id: string, stock: number) {
    variants.find((v) => v.id === id)!.stock = stock
  },
  setPrice(id: string, price: number) {
    variants.find((v) => v.id === id)!.price = price
  },
  cartCount: () => carts.length,
}
