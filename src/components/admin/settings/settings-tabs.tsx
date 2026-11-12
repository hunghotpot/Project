"use client"

import { NotConnectedButton } from "@/components/admin/placeholder/not-connected-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/* Thanh tab + nút "Lưu Cấu Hình" (Figma 06). Nội dung từng tab là Server Component truyền vào qua props. */
export function SettingsTabs({
  store,
  payment,
  shipping,
  admins,
}: {
  store: React.ReactNode
  payment: React.ReactNode
  shipping: React.ReactNode
  admins: React.ReactNode
}) {
  return (
    <Tabs defaultValue="store" className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="h-auto max-w-full flex-wrap justify-start">
          <TabsTrigger value="store" className="h-9 flex-none">
            Cửa hàng & Brand
          </TabsTrigger>
          <TabsTrigger value="payment" className="h-9 flex-none">
            Cổng thanh toán
          </TabsTrigger>
          <TabsTrigger value="shipping" className="h-9 flex-none">
            Vận chuyển & Kho
          </TabsTrigger>
          <TabsTrigger value="admins" className="h-9 flex-none">
            Phân quyền Admin
          </TabsTrigger>
        </TabsList>
        <NotConnectedButton size="md">Lưu Cấu Hình</NotConnectedButton>
      </div>
      <TabsContent value="store" className="space-y-4">
        {store}
      </TabsContent>
      <TabsContent value="payment" className="space-y-4">
        {payment}
      </TabsContent>
      <TabsContent value="shipping" className="space-y-4">
        {shipping}
      </TabsContent>
      <TabsContent value="admins" className="space-y-4">
        {admins}
      </TabsContent>
    </Tabs>
  )
}
