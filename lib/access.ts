export const accessMessages: Record<string, string> = {
  unverified: "Vui lòng xác minh email để nhận 15 ngày dùng thử và sử dụng shop.",
  "auth-unavailable": "Dịch vụ đăng nhập tạm thời chưa kết nối được. Vui lòng thử lại sau.",
  expired: "Bạn cần gia hạn để được tiếp tục sử dụng",
  pending: "Tài khoản đang chờ quản trị viên duyệt và cấp thời hạn sử dụng.",
  suspended: "Shop đã bị tạm khóa. Vui lòng liên hệ quản trị viên.",
  rejected: "Đăng ký chưa được chấp thuận. Vui lòng liên hệ quản trị viên.",
};
export function accessReason(shop: { accessStatus: string; accessUntil: Date | null; emailVerificationRequired?: boolean; emailVerifiedAt?: Date | null }) {
  if (shop.emailVerificationRequired && !shop.emailVerifiedAt && !["suspended", "rejected"].includes(shop.accessStatus)) return "unverified";
  if (shop.accessStatus !== "active") return shop.accessStatus;
  return shop.accessUntil && shop.accessUntil.getTime() <= Date.now() ? "expired" : null;
}
