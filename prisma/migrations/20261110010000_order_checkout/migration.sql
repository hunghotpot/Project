-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "code" TEXT NOT NULL,
ADD COLUMN     "note" TEXT,
ADD COLUMN     "shippingFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subtotal" INTEGER NOT NULL;

-- CreateTable
CREATE TABLE "OrderSequence" (
    "day" TEXT NOT NULL,
    "last" INTEGER NOT NULL,

    CONSTRAINT "OrderSequence_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");