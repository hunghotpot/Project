"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { fieldErrorsFrom, type ActionResult } from "@/lib/action-result"
import { loginSchema, registerSchema, safeNextPath } from "@/lib/validators/auth"
import { clearAuthCookies, getRefreshCookie, setAuthCookies } from "@/server/auth/session"
import { AuthError, login, logout, register } from "@/server/services/auth.service"

async function clientIp(): Promise<string> {
  const h = await headers()
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown"
}

function authErrorResult(e: AuthError): ActionResult {
  return {
    ok: false,
    message: e.field ? undefined : e.message,
    fieldErrors: e.field ? { [e.field]: e.message } : undefined,
  }
}

export async function registerAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

  try {
    const session = await register(parsed.data)
    await setAuthCookies(session)
  } catch (e) {
    if (e instanceof AuthError) return authErrorResult(e)
    throw e
  }
  redirect(safeNextPath(next))
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFrom(parsed.error) }

  try {
    const session = await login(parsed.data, { ip: await clientIp() })
    await setAuthCookies(session)
  } catch (e) {
    if (e instanceof AuthError) return authErrorResult(e)
    throw e
  }
  redirect(safeNextPath(next))
}

export async function logoutAction(): Promise<void> {
  await logout(await getRefreshCookie())
  await clearAuthCookies()
  redirect("/")
}


