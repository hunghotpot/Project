// Tài khoản mẫu cho môi trường dev. Mật khẩu được ghi trong README.md.

export const SEED_USERS = [
  {
    email: "admin@example.com",
    password: "Admin@123456",
    name: "Quản trị viên",
    phone: "0901234567",
    role: "ADMIN" as const,
  },
  {
    email: "customer@example.com",
    password: "Customer@123456",
    name: "Nguyễn Minh Anh",
    phone: "0987654321",
    role: "CUSTOMER" as const,
  },
];

// Địa chỉ mặc định của customer mẫu.
export const SEED_CUSTOMER_ADDRESS = {
  fullName: "Nguyễn Minh Anh",
  phone: "0987654321",
  street: "123 Nguyễn Huệ",
  ward: "Phường Bến Nghé",
  district: "Quận 1",
  province: "TP. Hồ Chí Minh",
  isDefault: true,
};
