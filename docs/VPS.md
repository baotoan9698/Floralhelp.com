# Floralhelp trên VPS

## Cấu hình triển khai

- Ubuntu 24.04, Node.js 22, PostgreSQL 16, Nginx.
- Website shop: https://sale.floralhelp.com
- Website quản trị: https://admin.floralhelp.com
- Source đang chạy: `/srv/floralhelp/current`, trỏ đến bản trong `/srv/floralhelp/releases/<commit>`, chạy bằng tài khoản hệ thống `floralhelp`. Bản triển khai ban đầu còn ở `/srv/floralhelp/app`.
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

Push vào nhánh `main` của `baotoan9698/Floralhelp.com` để cập nhật. Timer `floralhelp-deploy.timer` kiểm tra mỗi phút bằng deploy key GitHub chỉ đọc, không sử dụng GitHub Actions. Thời gian lên web còn phụ thuộc thời gian cài dependencies và build trên VPS.

Quy trình: fetch commit → tạo thư mục release → `npm ci` → build → backup → migration → chuyển symlink → restart → kiểm tra HTTP. Giữ bản code đang chạy và bản ngay trước đó. Ảnh nằm riêng ở `/srv/floralhelp/shared/private-storage`; cấu hình bí mật và database không bị thay khi cập nhật code.

Build lỗi thì giữ nguyên bản đang chạy. Kiểm tra HTTP sau restart lỗi thì chuyển lại code trước đó. **Không tự rollback database migration**; migration phá vỡ tương thích cần kế hoạch riêng. Commit bị lỗi được ghi nhận để tránh build lại liên tục; sau khi sửa, push commit mới.

```bash
systemctl list-timers floralhelp-deploy.timer
journalctl -u floralhelp-deploy -n 100 --no-pager
cat /etc/floralhelp/deployed-revision
```

Tạm dừng tự deploy: `systemctl stop floralhelp-deploy.timer`. Bật lại: `systemctl start floralhelp-deploy.timer`. Việc dừng timer không hủy lượt deploy đang chạy.

Mã cấu hình nằm trong `deploy/`. Script cài tại `/usr/local/sbin/floralhelp-deploy` và unit systemd do root sở hữu; sửa các file trong Git không tự cài lại script vận hành, cần cập nhật chúng qua SSH. Không dùng `npm run dev:local` trên VPS production.

HTTPS dùng Certbot/Let's Encrypt và timer gia hạn tự động. Giữ bản ghi DNS trỏ đúng VPS và cổng 80/443 hoạt động để gia hạn.
