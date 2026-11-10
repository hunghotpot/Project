import { NextResponse } from "next/server"
import { addItemSchema } from "@/lib/validators/cart"
import { resolveCartContext } from "@/server/cart/context"
import { parseBody, unauthenticated, withCartErrors } from "@/server/cart/http"
import { addItem } from "@/server/services/cart.service"

export async function POST(req: Request) {
  return withCartErrors(async () => {
    const ctx = await resolveCartContext()
    if (!ctx) return unauthenticated()
    const body = await parseBody(req, addItemSchema)
    if ("error" in body) return body.error
    return NextResponse.json(await addItem(ctx, body.data.variantId, body.data.quantity))
  })
}

