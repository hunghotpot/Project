import type { Metadata } from "next"
import { DemoBanner } from "@/components/admin/placeholder/demo-banner"
import { SettingsTabs } from "@/components/admin/settings/settings-tabs"
import { AdminAccountsPanel, PaymentPanel, ShippingPanel, StorePanel } from "@/components/admin/settings/settings-panels"

export const metadata: Metadata = { title: "Cài đặt hệ thống" }

/* Màn tĩnh: ô lấy từ hằng số code để chỉ đọc; ô khác là biểu mẫu trống. Lưu/Thêm/Sửa/Xóa chỉ hiện toast "chưa kết nối". */
export default function AdminSettingsPage() {
  return (
    <>
      <DemoBanner />
      <SettingsTabs store={<StorePanel />} payment={<PaymentPanel />} shipping={<ShippingPanel />} admins={<AdminAccountsPanel />} />
    </>
  )
}
