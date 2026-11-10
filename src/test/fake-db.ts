/* eslint-disable @typescript-eslint/no-explicit-any */
// Prisma giả lập in-memory, chỉ đủ các thao tác mà auth.service dùng.

interface UserRec {
  id: string
  email: string
  name: string
  phone: string | null
  role: "CUSTOMER" | "ADMIN"
  passwordHash: string
}

interface TokenRec {
  id: string
  userId: string
  familyId: string
  tokenHash: string
  expiresAt: Date
  revokedAt: Date | null
}

const users: UserRec[] = []
const tokens: TokenRec[] = []
let seq = 0

function matches(rec: Record<string, any>, where: Record<string, any>): boolean {
  return Object.entries(where).every(([k, v]) => rec[k] === v)
}

const fake: any = {
  user: {
    findUnique: async ({ where }: any) => users.find((u) => matches(u, where)) ?? null,
    create: async ({ data }: any) => {
      if (users.some((u) => u.email === data.email)) {
        throw Object.assign(new Error("Unique constraint failed"), { code: "P2002" })
      }
      const rec: UserRec = { id: `u${++seq}`, role: "CUSTOMER", phone: null, ...data }
      users.push(rec)
      return rec
    },
  },
  refreshToken: {
    create: async ({ data }: any) => {
      const rec: TokenRec = { id: `t${++seq}`, revokedAt: null, ...data }
      tokens.push(rec)
      return rec
    },
    findUnique: async ({ where, include }: any) => {
      const rec = tokens.find((t) => matches(t, where))
      if (!rec) return null
      return include?.user ? { ...rec, user: users.find((u) => u.id === rec.userId) } : rec
    },
    updateMany: async ({ where, data }: any) => {
      const hits = tokens.filter((t) => matches(t, where))
      hits.forEach((t) => Object.assign(t, data))
      return { count: hits.length }
    },
  },
  $transaction: async (fn: any) => (typeof fn === "function" ? fn(fake) : Promise.all(fn)),
}

export const fakeDb = fake

export const fakeStore = {
  users,
  tokens,
  reset() {
    users.length = 0
    tokens.length = 0
  },
}
