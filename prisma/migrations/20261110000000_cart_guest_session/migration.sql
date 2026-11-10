-- AlterTable
ALTER TABLE "Cart" ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CartItem" ADD COLUMN     "priceAtAdd" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Cart_sessionId_key" ON "Cart"("sessionId");

-- Đúng một chủ sở hữu: user đã đăng nhập hoặc khách (session). Prisma không biểu diễn được CHECK nên thêm tay.
ALTER TABLE "Cart" ADD CONSTRAINT "Cart_owner_check" CHECK (num_nonnulls("userId", "sessionId") = 1);