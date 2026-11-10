"use client"

import Link from "next/link"
import { LogOutIcon, MapPinIcon, ShoppingBagIcon, UserIcon, UserRoundIcon } from "lucide-react"
import { logoutAction } from "@/app/actions/auth"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface AccountMenuUser {
  name: string
  email: string
  role: "CUSTOMER" | "ADMIN"
}

export function AccountMenu({ user }: { user: AccountMenuUser | null }) {
  if (!user) {
    return (
      <Link href="/login" aria-label="Đăng nhập" className={buttonVariants({ variant: "secondary", size: "icon-sm" })}>
        <UserIcon />
      </Link>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="secondary" size="icon-sm" aria-label={`Tài khoản của ${user.name}`} />}
      >
        <UserIcon />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex flex-col gap-0.5 py-2">
            <span className="truncate text-sm font-bold text-foreground">{user.name}</span>
            <span className="truncate text-xs font-normal text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account/profile" />}>
          <UserRoundIcon /> Hồ sơ của tôi
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/addresses" />}>
          <MapPinIcon /> Sổ địa chỉ
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account/orders" />}>
          <ShoppingBagIcon /> Đơn hàng của tôi
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => logoutAction()}>
          <LogOutIcon /> Đăng xuất
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

