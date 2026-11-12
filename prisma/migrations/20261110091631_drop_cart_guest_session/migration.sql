/*
  Bỏ giỏ khách: giỏ hàng chỉ dành cho user đã đăng nhập.

  - Xoá các giỏ khách còn sót (userId NULL); CartItem bị xoá theo (ON DELETE CASCADE).
  - Bỏ ràng buộc CHECK, chỉ mục và cột `sessionId`.
  - `userId` trở lại bắt buộc.
*/

-- Dọn giỏ khách còn sót (nếu có) trước khi đặt userId NOT NULL
DELETE FROM "Cart" WHERE "userId" IS NULL;

-- Ràng buộc "đúng một chủ sở hữu" không còn ý nghĩa
ALTER TABLE "Cart" DROP CONSTRAINT IF EXISTS "Cart_owner_check";

-- DropIndex
DROP INDEX "Cart_sessionId_key";

-- AlterTable
ALTER TABLE "Cart" DROP COLUMN "sessionId",
ALTER COLUMN "userId" SET NOT NULL;
