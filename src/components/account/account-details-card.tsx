"use client"

import { useState } from "react"
import Link from "next/link"
import { ProfileForm } from "@/components/account/profile-form"
import { Button } from "@/components/ui/button"

// Figma "Chi tiết tài khoản": xem dạng ô chỉ đọc, bấm "Chỉnh sửa" để sửa tại chỗ.
// Ngày sinh / giới tính có trong Figma nhưng DB chưa lưu → chưa hiển thị.
export function AccountDetailsCard({
  name,
  email,
  phone,
  defaultAddress,
}: {
  name: string
  email: string
  phone: string | null
  defaultAddress: string | null
}) {
  const [editing, setEditing] = useState(false)

  return (
    <section aria-labelledby="account-details" className="rounded-3xl border border-border bg-card p-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h2 id="account-details" className="text-xl font-bold">
          Chi tiết tài khoản
        </h2>
        {!editing && (
          <Button variant="dark" size="md" onClick={() => setEditing(true)}>
            Chỉnh sửa
          </Button>
        )}
      </div>

      {editing ? (
        <ProfileForm
          defaultValues={{ name, phone }}
          email={email}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <dl className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          <Field label="Họ và tên" value={name} />
          <Field label="Số điện thoại" value={phone} />
          <div className="md:col-span-2">
            <Field label="Địa chỉ Email" value={email} />
          </div>
          <div className="md:col-span-2">
            <Field
              label="Địa chỉ mặc định"
              value={defaultAddress}
              empty={
                <>
                  Chưa có địa chỉ mặc định.{" "}
                  <Link href="/account/addresses" className="font-bold text-primary hover:underline">
                    Thêm địa chỉ
                  </Link>
                </>
              }
            />
          </div>
        </dl>
      )}
    </section>
  )
}

function Field({ label, value, empty = "Chưa cập nhật" }: { label: string; value: string | null; empty?: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <dt className="text-xs font-bold">{label}</dt>
      <dd className="flex min-h-[68px] items-center rounded-xl border border-border bg-white px-6 py-4 text-label">
        {value ?? <span className="text-muted-foreground">{empty}</span>}
      </dd>
    </div>
  )
}
