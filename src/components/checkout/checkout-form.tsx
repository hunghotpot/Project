"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { cn } from "cn"
import { placeOrderAction } from "@/app/actions/checkout"
import { FormField, FormMessage } from "@/components/auth/form-field"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CART_KEY } from "@/hooks/use-cart"
import type { CartLine } from "@/lib/cart"
import { formatVnd } from "@/lib/format"
import { SUPPORTED_PAYMENT_METHODS, type CheckoutPaymentMethod } from "@/lib/order"
import { checkoutSchema } from "@/lib/validators/checkout"
import type { AddressDTO } from "@/types/address"
import type { StockShortage } from "@/types/order"

interface FormValues {
  mode: "saved" | "new"
  addressId: string
  address: { fullName: string; phone: string; street: string; ward: string; district: string; province: string }
  paymentMethod: CheckoutPaymentMethod
  note: string
}

const PAYMENTS: { value: CheckoutPaymentMethod; title: string; hint?: string }[] = [
  { value: "COD", title: "Thanh toán khi nhận hàng (COD)", hint: "Tiền mặt khi giao" },
  { value: "VNPAY", title: "Thẻ Tín dụng / Ghi nợ (Visa, Mastercard, JCB)" },
  { value: "BANK_TRANSFER", title: "Chuyển khoản Ngân hàng / Quét mã VietQR / Ví điện tử" },
]

const addressText = (a: AddressDTO) => [a.street, a.ward, a.district, a.province].join(", ")

// Figma "Đặt Hàng": cột trái = 1. Thông tin giao hàng + 2. Phương thức thanh toán, cột phải = tóm tắt đơn.
export function CheckoutForm({
  addresses,
  vnpayEnabled,
  items,
  itemCount,
  subtotal,
  shippingFee,
  total,
}: {
  addresses: AddressDTO[]
  /** VNPay đã cấu hình (VNP_*) ở server; chưa thì khoá lựa chọn thẻ. */
  vnpayEnabled: boolean
  items: CartLine[]
  itemCount: number
  subtotal: number
  shippingFee: number
  total: number
}) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [message, setMessage] = useState<string>()
  const [shortages, setShortages] = useState<StockShortage[]>()

  const defaultAddress = addresses.find((a) => a.isDefault) ?? addresses[0]
  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: {
      mode: defaultAddress ? "saved" : "new",
      addressId: defaultAddress?.id ?? "",
      address: { fullName: "", phone: "", street: "", ward: "", district: "", province: "" },
      paymentMethod: "COD",
      note: "",
    },
  })
  const mode = watch("mode")
  const addressId = watch("addressId")
  const paymentMethod = watch("paymentMethod")

  async function onSubmit(values: FormValues) {
    setMessage(undefined)
    setShortages(undefined)

    // Cùng một schema Zod với server (validators/checkout.ts); server vẫn validate lại.
    const input = {
      shipping:
        values.mode === "saved"
          ? { mode: "saved" as const, addressId: values.addressId }
          : { mode: "new" as const, address: { ...values.address, isDefault: false } },
      paymentMethod: values.paymentMethod,
      note: values.note,
    }
    const parsed = checkoutSchema.safeParse(input)
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const key = issue.path.join(".").replace(/^shipping\./, "") as keyof FormValues
        setError(key, { message: issue.message })
      }
      return
    }

    const res = await placeOrderAction(parsed.data)
    if (res.ok) {
      await queryClient.invalidateQueries({ queryKey: CART_KEY }) // giỏ đã được xoá ở server
      // Sang cổng VNPay: điều hướng cả trang (route /api trả redirect ra ngoài), không dùng router của Next.
      if (res.redirectTo.startsWith("/api/")) window.location.assign(res.redirectTo)
      else router.push(res.redirectTo)
      return
    }
    if (res.code === "OUT_OF_STOCK" || res.code === "EMPTY_CART") {
      await queryClient.invalidateQueries({ queryKey: CART_KEY })
      setShortages(res.shortages ?? [])
      setMessage(res.message)
      return
    }
    setMessage(res.message)
    for (const [path, msg] of Object.entries(res.fieldErrors ?? {})) {
      setError(path.replace(/^shipping\./, "") as keyof FormValues, { message: msg })
    }
    if (res.message) toast.error(res.message)
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-8 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] xl:gap-14">
      <div className="min-w-0 space-y-10">
        {shortages && <StockAlert message={message} shortages={shortages} />}
        {!shortages && <FormMessage>{message}</FormMessage>}

        <section aria-labelledby="shipping-heading" className="space-y-6">
          <h2 id="shipping-heading" className="text-lg font-bold">
            1. Thông tin giao hàng
          </h2>

          <fieldset className="space-y-3">
            <legend className="mb-3 text-label font-bold">Địa chỉ nhận hàng</legend>
            {addresses.map((a) => {
              const checked = mode === "saved" && addressId === a.id
              return (
                <label
                  key={a.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-4 rounded-xl border bg-surface p-4 transition-colors",
                    checked ? "border-ink bg-white" : "border-border hover:border-border-strong"
                  )}
                >
                  <input
                    type="radio"
                    name="shipping-choice"
                    checked={checked}
                    onChange={() => {
                      setValue("mode", "saved")
                      setValue("addressId", a.id)
                    }}
                    className="mt-1 size-4 accent-[var(--color-ink)]"
                  />
                  <span className="min-w-0 text-label">
                    <b>{a.fullName}</b> • {a.phone}
                    {a.isDefault && <span className="ml-2 text-xs font-bold text-primary">Mặc định</span>}
                    <span className="mt-1 block text-muted-foreground">{addressText(a)}</span>
                  </span>
                </label>
              )
            })}
            <label
              className={cn(
                "flex cursor-pointer items-center gap-4 rounded-xl border bg-surface p-4 text-label font-bold transition-colors",
                mode === "new" ? "border-ink bg-white" : "border-border hover:border-border-strong"
              )}
            >
              <input
                type="radio"
                name="shipping-choice"
                checked={mode === "new"}
                onChange={() => setValue("mode", "new")}
                className="size-4 accent-[var(--color-ink)]"
              />
              Giao tới địa chỉ mới
            </label>
            {errors.addressId && (
              <p role="alert" className="text-xs text-destructive">
                {errors.addressId.message}
              </p>
            )}
          </fieldset>

          {mode === "new" && (
            <div className="grid gap-5 md:grid-cols-2">
              <FormField id="co-fullName" label="Họ và tên" required error={errors.address?.fullName?.message}>
                {(a11y) => <Input {...a11y} autoComplete="name" {...register("address.fullName")} />}
              </FormField>
              <FormField id="co-phone" label="Số điện thoại" required error={errors.address?.phone?.message}>
                {(a11y) => <Input {...a11y} type="tel" autoComplete="tel" placeholder="0901234567" {...register("address.phone")} />}
              </FormField>
              <div className="md:col-span-2">
                <FormField id="co-street" label="Số nhà, tên đường" required error={errors.address?.street?.message}>
                  {(a11y) => <Input {...a11y} autoComplete="address-line1" {...register("address.street")} />}
                </FormField>
              </div>
              <FormField id="co-ward" label="Phường/Xã" required error={errors.address?.ward?.message}>
                {(a11y) => <Input {...a11y} {...register("address.ward")} />}
              </FormField>
              <FormField id="co-district" label="Quận/Huyện" required error={errors.address?.district?.message}>
                {(a11y) => <Input {...a11y} {...register("address.district")} />}
              </FormField>
              <div className="md:col-span-2">
                <FormField id="co-province" label="Tỉnh/Thành phố" required error={errors.address?.province?.message}>
                  {(a11y) => <Input {...a11y} {...register("address.province")} />}
                </FormField>
              </div>
            </div>
          )}

          <FormField id="co-note" label="Ghi chú đơn hàng (tuỳ chọn)" error={errors.note?.message}>
            {(a11y) => <Textarea {...a11y} rows={3} placeholder="Giao hàng giờ hành chính..." {...register("note")} />}
          </FormField>
        </section>

        <section aria-labelledby="payment-heading" className="space-y-4 border-t border-border pt-8">
          <h2 id="payment-heading" className="text-lg font-bold">
            2. Phương thức thanh toán
          </h2>
          <div role="radiogroup" aria-label="Phương thức thanh toán" className="space-y-3">
            {PAYMENTS.map((p) => {
              const enabled = SUPPORTED_PAYMENT_METHODS.includes(p.value) && (p.value !== "VNPAY" || vnpayEnabled)
              const checked = paymentMethod === p.value
              return (
                <label
                  key={p.value}
                  className={cn(
                    "flex items-center gap-4 rounded-xl border px-5 py-5 transition-colors",
                    checked ? "border-ink bg-white" : "border-border bg-surface",
                    enabled ? "cursor-pointer hover:border-border-strong" : "cursor-not-allowed opacity-60"
                  )}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={p.value}
                    disabled={!enabled}
                    checked={checked}
                    onChange={() => setValue("paymentMethod", p.value)}
                    className="size-4 accent-[var(--color-ink)]"
                  />
                  <span className="flex-1 text-nav font-bold">{p.title}</span>
                  {p.hint && <span className="text-label text-muted-foreground">{p.hint}</span>}
                  {p.value === "VNPAY" && (
                    <span className="flex items-center gap-2">
                      {!enabled && <span className="text-xs font-bold text-muted-foreground">Sắp ra mắt</span>}
                      <span className="rounded-sm bg-ink px-2 py-1 text-[9px] font-bold text-white">VISA</span>
                      <span className="rounded-sm bg-primary px-2 py-1 text-[9px] font-bold text-white">MC</span>
                    </span>
                  )}
                </label>
              )
            })}
          </div>
          {errors.paymentMethod && (
            <p role="alert" className="text-xs text-destructive">
              {errors.paymentMethod.message}
            </p>
          )}
        </section>
      </div>

      <aside aria-labelledby="summary-heading" className="h-fit rounded-3xl border border-border bg-card p-8">
        <h2 id="summary-heading" className="mb-6 text-lg font-bold">
          Đơn hàng của bạn ({itemCount} món)
        </h2>
        <ul className="space-y-5 border-b border-border pb-6">
          {items.map((l) => (
            <li key={l.variantId} className="flex gap-4">
              <div className="relative size-20 shrink-0 overflow-hidden rounded-lg border border-border bg-white">
                {l.image && <Image src={l.image.url} alt={l.image.alt} fill sizes="80px" className="object-cover" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-bold">{l.name}</p>
                <p className="text-xs text-muted-foreground">
                  Màu: <b className="text-foreground">{l.color}</b> | Size: <b className="text-foreground">{l.size}</b>
                </p>
                <p className="text-xs text-muted-foreground">
                  Số lượng: <b className="text-foreground">{l.quantity}</b>
                </p>
              </div>
              <span className="text-sm font-bold whitespace-nowrap">{formatVnd(l.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <dl className="space-y-4 border-b border-border py-6 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Tạm tính</dt>
            <dd className="font-bold">{formatVnd(subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Phí vận chuyển</dt>
            <dd className={cn("font-bold", shippingFee === 0 && "text-success")}>
              {shippingFee === 0 ? "Miễn phí" : formatVnd(shippingFee)}
            </dd>
          </div>
        </dl>

        <div className="pt-6">
          <div className="flex items-end justify-between gap-4">
            <span className="text-base font-bold">Tổng cộng</span>
            <span className="text-[22px] leading-none font-bold text-primary">{formatVnd(total)}</span>
          </div>
          <p className="mt-2 text-right text-xs text-subtle-foreground">(Đã bao gồm thuế VAT)</p>
          <Button type="submit" size="xl" disabled={isSubmitting} className="mt-8 w-full">
            {isSubmitting ? "Đang đặt hàng..." : "ĐẶT HÀNG NGAY"}
          </Button>
          <p className="mt-4 text-center text-xs text-subtle-foreground">🔒 Bảo mật thanh toán SSL 100%</p>
        </div>
      </aside>
    </form>
  )
}

// Hết hàng giữa chừng: nói rõ sản phẩm nào, còn bao nhiêu, và cho quay lại giỏ để chỉnh.
function StockAlert({ message, shortages }: { message?: string; shortages: StockShortage[] }) {
  return (
    <div role="alert" className="space-y-3 rounded-2xl border border-warning/40 bg-warning-soft p-5 text-label">
      <p className="font-bold text-warning">{message ?? "Giỏ hàng của bạn có thay đổi"}</p>
      {shortages.length > 0 && (
        <ul className="list-disc space-y-1 pl-5">
          {shortages.map((s) => (
            <li key={s.variantId}>
              <b>{s.productName}</b> ({s.size}, {s.color}):{" "}
              {s.available === 0 ? "đã hết hàng" : `bạn đặt ${s.requested}, kho chỉ còn ${s.available}`}
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted-foreground">Đơn hàng chưa được tạo và bạn chưa bị trừ tiền. Vui lòng điều chỉnh giỏ hàng rồi đặt lại.</p>
      <Link href="/cart" className="inline-flex h-10 items-center rounded-full bg-ink px-6 text-sm font-bold text-white hover:bg-ink/90">
        ← Quay lại giỏ hàng
      </Link>
    </div>
  )
}

