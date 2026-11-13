-- CreateTable
CREATE TABLE "AiChatLog" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "claim" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL,
    "ttftMs" INTEGER,
    "tokensIn" INTEGER NOT NULL DEFAULT 0,
    "tokensOut" INTEGER NOT NULL DEFAULT 0,
    "tools" JSONB NOT NULL,
    "params" JSONB,
    "error" TEXT,
    "userText" TEXT,
    "replyText" TEXT,

    CONSTRAINT "AiChatLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AiChatLog_createdAt_idx" ON "AiChatLog"("createdAt");

-- CreateIndex
CREATE INDEX "AiChatLog_userId_createdAt_idx" ON "AiChatLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AiChatLog_status_createdAt_idx" ON "AiChatLog"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "AiChatLog" ADD CONSTRAINT "AiChatLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
