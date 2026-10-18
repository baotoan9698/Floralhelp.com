# Thử nhắc giao hoa trên local

1. Chạy `npm run dev:local` và mở http://localhost:3000.
2. Trong terminal khác, chạy `npm run reminders:local` (giữ terminal mở).
3. Đăng nhập shop → Cài đặt shop → Nhắc giao hoa. Bật nhắc, chọn 5 phút, bấm Lưu cài đặt nhắc.
4. Bấm Bật thông báo trên thiết bị này, cho phép trên trình duyệt, rồi Gửi thông báo thử.
5. Tạo đơn Chờ xác nhận/Đang chuẩn bị, giao sau 3–5 phút. Bộ nhắc quét mỗi 60 giây. Chuông trong web cập nhật mỗi 30 giây.

Khóa VAPID local lưu trong .env.local (không commit). Để thử trên điện thoại cần đường dẫn HTTPS tới máy local. iPhone/iPad 16.4+: thêm web vào màn hình chính, mở từ đó rồi cấp quyền. Chưa cấu hình tunnel hay production.

Thông báo hệ thống và âm thanh phụ thuộc thiết bị; chưa kiểm chứng giao nhận push trên điện thoại thật. Bản local lưu lịch sử trong DB và gửi push một lần mỗi lịch giao (đơn + ngày + giờ). Lỗi mạng push được ghi trong terminal, chưa có hàng đợi retry; xem chuông trong web làm dự phòng. Không nhắc đơn đang giao/đã giao/hủy hoặc shop bị khóa/hết hạn. Khi đổi giờ giao sẽ tính lịch mới. Không quét các đơn đã quá giờ giao.

Đây là bản local để kiểm thử; không chạy worker local với database production.
