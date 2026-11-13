-- CreateTable
CREATE TABLE "ProductEmbedding" (
    "productId" TEXT NOT NULL,
    "embedding" vector(1024) NOT NULL,
    "content" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "dimensions" INTEGER NOT NULL,
    "templateVersion" INTEGER NOT NULL DEFAULT 1,
    "embeddedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductEmbedding_pkey" PRIMARY KEY ("productId")
);

-- AddForeignKey
ALTER TABLE "ProductEmbedding" ADD CONSTRAINT "ProductEmbedding_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Chỉ mục HNSW cho tìm kiếm ngữ nghĩa (cosine). Prisma không biểu diễn được nên viết tay (docs/ai/01-data-for-ai.md mục 3).
CREATE INDEX "ProductEmbedding_embedding_hnsw" ON "ProductEmbedding" USING hnsw ("embedding" vector_cosine_ops) WITH (m = 16, ef_construction = 64);
