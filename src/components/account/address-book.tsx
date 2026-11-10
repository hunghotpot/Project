"use client"

import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { PlusIcon } from "lucide-react"
import { toast } from "sonner"
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
} from "@/app/actions/account"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { ActionResult } from "@/lib/action-result"
import { addressSchema, type AddressInput } from "@/lib/validators/auth"
import type { AddressDTO } from "@/types/address"

export function AddressBook({ addresses }: { addresses: AddressDTO[] }) {
  // undefined = đóng, null = thêm mới, AddressDTO = đang sửa
  const [editing, setEditing] = useState<AddressDTO | null | undefined>(undefined)
  const [pending, startTransition] = useTransition()

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await action()
      if (res.ok) toast.success(res.message)
      else toast.error(res.message ?? "Có lỗi xảy ra, vui lòng thử lại")
    })
  }

  function remove(a: AddressDTO) {
    if (window.confirm(`Xoá địa chỉ của ${a.fullName}?`)) run(() => deleteAddressAction(a.id))
  }

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-8">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-xl font-bold">Sổ địa chỉ</h2>
        <Button variant="dark" size="md" onClick={() => setEditing(null)}>
          <PlusIcon /> Thêm địa chỉ
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong p-10 text-center text-label text-muted-foreground">
          Bạn chưa có địa chỉ nào. Thêm địa chỉ để đặt hàng nhanh hơn.
        </p>
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {addresses.map((a) => (
            <li key={a.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{a.fullName}</span>
                  {a.isDefault && <Badge>Mặc định</Badge>}
                </div>
                <span className="text-label text-muted-foreground">{a.phone}</span>
                <span className="text-label">
                  {[a.street, a.ward, a.district, a.province].join(", ")}
                </span>
              </div>
              <div className="mt-auto flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" disabled={pending} onClick={() => setEditing(a)}>
                  Sửa
                </Button>
                {!a.isDefault && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={pending}
                    onClick={() => run(() => setDefaultAddressAction(a.id))}
                  >
                    Đặt làm mặc định
                  </Button>
                )}
                <Button size="sm" variant="destructive" disabled={pending} onClick={() => remove(a)}>
                  Xoá
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== undefined} onOpenChange={(open) => !open && setEditing(undefined)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Sửa địa chỉ" : "Thêm địa chỉ"}</DialogTitle>
            <DialogDescription className="sr-only">Nhập thông tin địa chỉ nhận hàng</DialogDescription>
          </DialogHeader>
          {editing !== undefined && (
            <AddressForm address={editing} onDone={() => setEditing(undefined)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function AddressForm({ address, onDone }: { address: AddressDTO | null; onDone: () => void }) {
  const [message, setMessage] = useState<string>()
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AddressInput>({
    resolver: zodResolver(addressSchema),
    defaultValues: {
      fullName: address?.fullName ?? "",
      phone: address?.phone ?? "",
      street: address?.street ?? "",
      ward: address?.ward ?? "",
      district: address?.district ?? "",
      province: address?.province ?? "",
      isDefault: address?.isDefault ?? false,
    },
  })

  async function onSubmit(values: AddressInput) {
    setMessage(undefined)
    const res = address ? await updateAddressAction(address.id, values) : await createAddressAction(values)
    if (res.ok) {
      toast.success(res.message)
      return onDone()
    }
    setMessage(res.message)
    for (const [field, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(field as keyof AddressInput, { message: msg })
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-4">
      <FormMessage>{message}</FormMessage>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="addr-fullName" label="Họ và tên" required error={errors.fullName?.message}>
          {(a11y) => <Input {...a11y} autoComplete="name" {...register("fullName")} />}
        </FormField>
        <FormField id="addr-phone" label="Số điện thoại" required error={errors.phone?.message}>
          {(a11y) => <Input {...a11y} type="tel" autoComplete="tel" {...register("phone")} />}
        </FormField>
      </div>
      <FormField id="addr-street" label="Số nhà, tên đường" required error={errors.street?.message}>
        {(a11y) => <Input {...a11y} autoComplete="address-line1" {...register("street")} />}
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="addr-ward" label="Phường/Xã" required error={errors.ward?.message}>
          {(a11y) => <Input {...a11y} {...register("ward")} />}
        </FormField>
        <FormField id="addr-district" label="Quận/Huyện" required error={errors.district?.message}>
          {(a11y) => <Input {...a11y} {...register("district")} />}
        </FormField>
      </div>
      <FormField id="addr-province" label="Tỉnh/Thành phố" required error={errors.province?.message}>
        {(a11y) => <Input {...a11y} {...register("province")} />}
      </FormField>
      <Controller
        control={control}
        name="isDefault"
        render={({ field }) => (
          <div className="flex items-center gap-2">
            <Checkbox
              id="addr-isDefault"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={address?.isDefault}
            />
            <Label htmlFor="addr-isDefault" className="font-normal">
              Đặt làm địa chỉ mặc định
            </Label>
          </div>
        )}
      />
      <Button type="submit" variant="dark" size="md" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? "Đang lưu..." : "Lưu địa chỉ"}
      </Button>
    </form>
  )
}

