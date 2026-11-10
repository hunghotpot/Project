import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { buildProducts } from "./seed-data/build";
import { CATEGORIES } from "./seed-data/categories";
import { SIZE_CHARTS } from "./seed-data/size-charts";
import { SEED_CUSTOMER_ADDRESS, SEED_USERS } from "./seed-data/users";

const prisma = new PrismaClient();

async function resetData() {
  // Thứ tự xoá theo phụ thuộc khoá ngoại.
  await prisma.$transaction([
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.cartItem.deleteMany(),
    prisma.cart.deleteMany(),
    prisma.sizeChart.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany({ where: { parentId: { not: null } } }),
    prisma.category.deleteMany(),
    prisma.address.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedUsers() {
  for (const u of SEED_USERS) {
    const user = await prisma.user.create({
      data: {
        email: u.email,
        passwordHash: await bcrypt.hash(u.password, 10),
        name: u.name,
        phone: u.phone,
        role: u.role,
      },
    });
    if (u.role === "CUSTOMER") {
      await prisma.address.create({ data: { ...SEED_CUSTOMER_ADDRESS, userId: user.id } });
    }
  }
}

async function seedCategories(): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  // Category gốc trước, rồi tới category con.
  for (const c of [...CATEGORIES].sort((a, b) => Number(!!a.parent) - Number(!!b.parent))) {
    const created = await prisma.category.create({
      data: {
        name: c.name,
        slug: c.slug,
        description: c.description,
        parentId: c.parent ? ids.get(c.parent) : null,
      },
    });
    ids.set(c.slug, created.id);
  }
  return ids;
}

async function seedSizeCharts(categoryIds: Map<string, string>) {
  await prisma.sizeChart.createMany({
    data: SIZE_CHARTS.map(({ categorySlug, ...rest }) => ({
      ...rest,
      categoryId: categoryIds.get(categorySlug)!,
    })),
  });
}

async function seedProducts(categoryIds: Map<string, string>) {
  for (const p of buildProducts()) {
    const { categorySlug, images, variants, ...data } = p;
    await prisma.product.create({
      data: {
        ...data,
        categoryId: categoryIds.get(categorySlug)!,
        images: { create: images },
        variants: { create: variants },
      },
    });
  }
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Từ chối chạy seed ở production (seed xoá toàn bộ dữ liệu).");
  }

  console.log("Đang xoá dữ liệu cũ...");
  await resetData();

  await seedUsers();
  const categoryIds = await seedCategories();
  await seedSizeCharts(categoryIds);
  await seedProducts(categoryIds);

  const [users, addresses, categories, products, images, variants, outOfStock, sizeCharts] =
    await Promise.all([
      prisma.user.count(),
      prisma.address.count(),
      prisma.category.count(),
      prisma.product.count(),
      prisma.productImage.count(),
      prisma.productVariant.count(),
      prisma.productVariant.count({ where: { stock: 0 } }),
      prisma.sizeChart.count(),
    ]);

  console.log("\nSeed hoàn tất:");
  console.table({
    User: users,
    Address: addresses,
    Category: categories,
    Product: products,
    ProductImage: images,
    ProductVariant: variants,
    "  - hết hàng (stock = 0)": outOfStock,
    SizeChart: sizeCharts,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
