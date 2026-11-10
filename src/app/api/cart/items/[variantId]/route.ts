import { NextResponse } from "next/server"
import { updateQuantitySchema, variantIdSchema } from "@/lib/validators/cart"
import { resolveCartContext } from "@/server/cart/context"
import { jsonError, parseBody, unauthenticated, withCartErrors } from "@/server/cart/http"
import { removeItem, updateQuantity } from "@/server/services/cart.service"

type Params = { params: Promise<{ variantId: string }> }

export async function PATCH(req: Request, { params }: Params) {
  return withCartErrors(async () => {
    const id = variantIdSchema.safeParse((await params).variantId)
    if (!id.success) return jsonError("INVALID_INPUT", "Mã biến thể không hợp lệ", 400)
    const ctx = await resolveCartContext()
    if (!ctx) return unauthenticated()
    const body = await parseBody(req, updateQuantitySchema)
    if ("error" in body) return body.error
    return NextResponse.json(await updateQuantity(ctx, id.data, body.data.quantity))
  })
}

export async function DELETE(_req: Request, { params }: Params) {
  return withCartErrors(async () => {
    const id = variantIdSchema.safeParse((await params).variantId)
    if (!id.success) return jsonError("INVALID_INPUT", "Mã biến thể không hợp lệ", 400)
    const ctx = await resolveCartContext()
    if (!ctx) return unauthenticated()
    return NextResponse.json(await removeItem(ctx, id.data))
  })
}

