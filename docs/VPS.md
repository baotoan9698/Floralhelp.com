# Floralhelp trên VPS

## Cấu hình triển khai

- Ubuntu 24.04, Node.js 22, PostgreSQL 16, Nginx.
- Website shop: https://sale.floralhelp.com
- Website quản trị: https://admin.floralhelp.com
- Source trên server: `/srv/floralhelp/app`, chạy bằng tài khoản hệ thống `floralhelp`.
- Cấu hình bí mật: `/etc/floralhelp/app.env`, chỉ root đọc. Không đưa file này vào Git.
- PostgreSQL và Next.js chỉ lắng nghe trên localhost. Nginx phục vụ truy cập công khai.
- VPS ban đầu có khoảng 1 GB RAM, 20 GB ổ đĩa, thêm 3 GB swap để hỗ trợ build. Đây là cấu hình thử nghiệm, chưa kiểm thử tải 100 shop.

## Kiểm tra vận hành (chạy trên VPS)

```bash
systemctl status floralhelp --no-pager
journalctl -u floralhelp -n 100 --no-pager
systemctl status postgresql nginx --no-pager
free -h
df -h /
```

Khởi động lại website sau khi đã build thành công:

```bash
systemctl restart floralhelp
```

## Dữ liệu và tài khoản

Database VPS là database PostgreSQL mới. Dữ liệu SQLite trên máy phát triển không được tự nhập vào VPS. Không chép file SQLite đè lên PostgreSQL.

Tài khoản quản trị ban đầu: `admin@banhoa.vn`. Mật khẩu ngẫu nhiên nằm trong `/etc/floralhelp/admin-credentials.txt` (chỉ root đọc); không đưa nội dung vào Git, log công khai hay tài liệu.

Shop đăng ký mới chờ admin duyệt. Admin đặt trạng thái và thời hạn sử dụng qua giao diện quản trị.

## Sao lưu

Timer `floralhelp-backup.timer` chạy lúc 03:15 theo giờ Việt Nam, giữ các bản gần đây khoảng 7 ngày tại `/var/backups/floralhelp`:

- `db-*.dump`: PostgreSQL định dạng custom của `pg_dump`.
- `config-*.tar.gz`: cấu hình ứng dụng, Nginx và service; chứa bí mật, cần giữ riêng tư.
- `images-*.tar.gz`: ảnh riêng tư nếu thư mục ảnh đã tồn tại.

```bash
systemctl list-timers floralhelp-backup.timer
systemctl start floralhelp-backup.service
journalctl -u floralhelp-backup.service --no-pager
```

Backup trên cùng VPS không bảo vệ khi mất toàn bộ VPS. Cần thêm bản sao ngoài máy trước khi dùng dữ liệu thật. Kiểm tra phục hồi vào database riêng trước khi thay database đang sử dụng.

## Cập nhật source

Bản đầu triển khai từ snapshot source trên máy phát triển, gồm cả thay đổi chưa push Git. Không tự chạy `git pull` trong thư mục app.

Lần cập nhật tiếp theo cần đóng gói source mới, giữ lại cấu hình bí mật và `.private-storage`, sao lưu database trước, cài dependencies từ lockfile, áp dụng migrations, build thành công rồi mới restart. Migrations có thể làm phiên bản cũ không còn tương thích; cần kiểm tra trước khi rollback. Không dùng `npm run dev:local` trên VPS production.

HTTPS dùng Certbot/Let's Encrypt và timer gia hạn tự động. Giữ bản ghi DNS trỏ đúng VPS và cổng 80/443 hoạt động để gia hạn.
