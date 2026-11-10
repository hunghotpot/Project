import type { Metadata } from "next"
import { AddressBook } from "@/components/account/address-book"
import { requireUser } from "@/server/auth/session"
import { listAddresses } from "@/server/services/address.service"

export const metadata: Metadata = { title: "Sổ địa chỉ" }

export default async function AddressesPage() {
  const user = await requireUser("/account/addresses")
  return <AddressBook addresses={await listAddresses(user.id)} />
}
