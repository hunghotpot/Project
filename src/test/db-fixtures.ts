import { orderDayKey } from "@/lib/order"
import { db } from "@/server/db"

/*
 * Dữ liệu test cho các test tích hợp chạy trên PostgreSQL thật. Mỗi bản ghi có tiền tố riêng và được dọn bằng cleanup().
 * Dùng: const fx = createFixtures(); ...; afterAll(fx.cleanup)
 */
export function createFixtures() {
  const RUN = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  let n = 0
  const uid = (p: string) => `${RUN}-${p}-${++n}`
  const created = { users: [] as string[], products: [] as string[], category: "" }

  async function ensureCategory() {
    if (!created.category) {
      const c = await db.category.create({ data: { name: `Test ${RUN}`, slug: uid("cat") } })
      created.category = c.id
    }
    return created.category
  }

  async function makeVariant(stock: number, price = 100_000) {
    const product = await db.product.create({
      data: {
        name: `SP ${uid("p")}`,
        slug: uid("slug"),
        description: "test",
        brand: "Test",
        material: "Cotton",
        style: "casual",
        gender: "UNISEX",
        basePrice: price,
        categoryId: await ensureCategory(),
        variants: { create: { sku: uid("sku"), size: "M", color: "Đen", colorHex: "#111111", price, stock } },
      },
      include: { variants: true },
    })
    created.products.push(product.id)
    return product.variants[0]
  }

  /** User + địa chỉ + giỏ hàng chứa các dòng (variantId, quantity). */
  async function makeBuyer(lines: { variantId: string; quantity: number }[]) {
    const user = await db.user.create({
      data: {
        email: `${uid("u")}@test.local`,
        passwordHash: "x",
        name: "Người Mua Thử",
        addresses: {
          create: { fullName: "Người Mua Thử", phone: "0901234567", street: "1 Test", ward: "P1", district: "Q1", province: "HCM", isDefault: true },
        },
        cart: { create: { items: { create: lines } } },
      },
      include: { addresses: true },
    })
    created.users.push(user.id)
    return { user, addressId: user.addresses[0].id }
  }

  /** Nhân viên (role ADMIN) để làm "người đổi trạng thái" trong test. */
  async function makeAdmin() {
    const admin = await db.user.create({
      data: { email: `${uid("admin")}@test.local`, passwordHash: "x", name: "Quản Trị Thử", role: "ADMIN" },
    })
    created.users.push(admin.id)
    return admin
  }

  const stockOf = async (variantId: string) => (await db.productVariant.findUniqueOrThrow({ where: { id: variantId } })).stock
  const cartSize = async (userId: string) => db.cartItem.count({ where: { cart: { userId } } })

  async function cleanup() {
    await db.order.deleteMany({ where: { userId: { in: created.users } } }) // Order → User là Restrict
    // Trả bộ đếm mã đơn về đúng số lớn nhất của các đơn thật còn lại (hoặc xoá nếu không còn),
    // để test không làm "ăn" mất số thứ tự của đơn thật.
    const day = orderDayKey(new Date())
    const remaining = await db.order.findMany({ where: { code: { startsWith: `FS-${day}-` } }, select: { code: true } })
    const maxSeq = Math.max(0, ...remaining.map((o) => Number(o.code.split("-")[2])))
    if (maxSeq === 0) await db.orderSequence.deleteMany({ where: { day } })
    else await db.orderSequence.updateMany({ where: { day }, data: { last: maxSeq } })
    await db.user.deleteMany({ where: { id: { in: created.users } } }) // cascade: địa chỉ, giỏ
    await db.product.deleteMany({ where: { id: { in: created.products } } }) // cascade: biến thể
    if (created.category) await db.category.delete({ where: { id: created.category } })
    await db.$disconnect()
  }

  return { makeVariant, makeBuyer, makeAdmin, stockOf, cartSize, cleanup }
}

