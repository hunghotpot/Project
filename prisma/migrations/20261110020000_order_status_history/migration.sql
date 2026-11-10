-- CreateEnum
CREATE TYPE "OrderActorType" AS ENUM ('CUSTOMER', 'ADMIN', 'SYSTEM');

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" "OrderStatus",
    "toStatus" "OrderStatus" NOT NULL,
    "actorType" "OrderActorType" NOT NULL,
    "actorUserId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderStatusHistory" ADD CONSTRAINT "OrderStatusHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: đơn đã tồn tại trước khi có bảng này. Mỗi đơn có dòng "đặt hàng"; đơn đã qua PENDING có thêm một dòng
-- cho trạng thái hiện tại (không biết thời điểm thật nên lấy updatedAt).
INSERT INTO "OrderStatusHistory" ("id", "orderId", "fromStatus", "toStatus", "actorType", "actorUserId", "note", "createdAt")
SELECT 'bf1_' || "id", "id", NULL, 'PENDING', 'CUSTOMER', "userId", 'Đặt hàng', "createdAt" FROM "Order";

INSERT INTO "OrderStatusHistory" ("id", "orderId", "fromStatus", "toStatus", "actorType", "actorUserId", "note", "createdAt")
SELECT 'bf2_' || "id", "id", 'PENDING', "status", 'SYSTEM', NULL, 'Dữ liệu trước khi có lịch sử trạng thái', "updatedAt" FROM "Order" WHERE "status" <> 'PENDING';