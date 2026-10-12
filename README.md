# Floralhelp · Quản lý shop hoa

Ứng dụng Next.js + PostgreSQL, hiện triển khai trên VPS Ubuntu. Xem [hướng dẫn vận hành VPS](docs/VPS.md) về service, database, backup và cập nhật source.

- Website: https://sale.floralhelp.com
- Quản trị: https://admin.floralhelp.com
- Repository: https://github.com/baotoan9698/Floralhelp.com

GitHub lưu source; hiện chưa cấu hình tự động deploy khi push. Các hướng dẫn Vercel bên dưới là phương án triển khai thay thế.

### Quản trị và thời hạn sử dụng

- `/admin/login`: đăng nhập quản trị bằng tài khoản riêng trong bảng `Admin`. Không có đăng ký admin công khai.
- `/admin`: tìm shop, duyệt/từ chối, tạm khóa, đặt/gia hạn đến hết ngày theo giờ Việt Nam và xem lịch sử quản trị.
- Tài khoản shop mới ở trạng thái `pending`, chưa được đăng nhập bán hàng. Shop cũ giữ trạng thái `active` chưa đặt hạn để tránh gián đoạn; admin cần đặt hạn cho từng shop.
- Hết hạn được kiểm tra tại server trên mỗi lần truy cập dữ liệu. Phiên bị thu hồi; trình duyệt kiểm tra mỗi 15 giây và đặt hẹn giờ theo ngày hết hạn để chuyển về `/login`. Không xóa dữ liệu bán hàng. Thay đổi quyền/hạn từ admin thu hồi các phiên đang đăng nhập và yêu cầu đăng nhập lại.
- Tạo admin bằng `node scripts/create-admin.mjs admin@example.com` với `DATABASE_URL` trỏ đúng database và Prisma client tương ứng. Lệnh sinh mật khẩu ngẫu nhiên, không ghi mật khẩu vào source và không ghi đè tài khoản đã tồn tại.
- Khi triển khai subdomain, đặt `ADMIN_HOST=admin.tenmien.vn` (không có giao thức). Host admin chuyển `/` về `/admin`, `/login` về `/admin/login`; host khác không phục vụ `/admin`. Cookie admin và shop riêng, không đặt Domain dùng chung. Localhost không đặt `ADMIN_HOST`.
- Chạy kiểm tra: `node --test tests/admin.test.mjs` với local SQLite. Luồng test tạo và dọn tài khoản thử riêng.

Ứng dụng quản lý đơn hoa: mỗi tài khoản là một shop độc lập, có đăng nhập, lịch giao hàng, tìm kiếm, lọc trạng thái, thêm/sửa/xóa đơn và giao diện PC/mobile.

## Triển khai Vercel + Neon PostgreSQL

Mã nguồn đã cấu hình Next.js App Router, Node.js 22, Prisma 6 và PostgreSQL. `vercel.json` chạy `npm run vercel-build`: kiểm tra cấu hình → tạo Prisma Client → áp dụng migration PostgreSQL → build Next.js. Không cần chạy server hoặc lưu file database trên Vercel.

### Cách 1: Deploy thư mục hiện tại bằng CLI

```sh
npx vercel login
npx vercel link
```

Chọn tài khoản/team và tạo project mới hoặc liên kết project đã có. Sau khi liên kết:

1. Mở project trên Vercel → **Storage** → kết nối **Neon** từ Marketplace (hoặc dùng PostgreSQL đã có).
2. Trong Neon, lấy connection string **pooled** và **direct / non-pooled**.
3. Tại Vercel → **Settings → Environment Variables**, đặt cho Production:
   - `DATABASE_URL`: URL pooled, thường chứa `-pooler` trong hostname; có `sslmode=require`. Có thể thêm `connection_limit=1` vào query string để giới hạn kết nối mỗi instance.
   - `DIRECT_URL`: URL direct/non-pooled đến **cùng database**, dùng cho migration.
4. Nếu integration chỉ tạo `DATABASE_URL_UNPOOLED` hoặc `POSTGRES_URL_NON_POOLING`, sao chép giá trị đó sang `DIRECT_URL`. Không dùng tiền tố `NEXT_PUBLIC_` cho các biến database.
5. Chạy:

```sh
npx vercel --prod
```

Vercel sẽ trả về địa chỉ `https://<project>.vercel.app`. Truy cập, chọn **Tạo shop mới** và đăng ký. Không cần tài khoản mẫu. Các file `.env`, database SQLite cũ, ảnh/test local được loại khỏi upload bằng `.vercelignore`.

### Cách 2: Deploy qua GitHub

Đẩy **toàn bộ mã nguồn Next.js mới** lên repository trước; repo HTML gốc chưa đủ để chạy ứng dụng này. Import repo trong Vercel → chọn **Next.js**, root directory là thư mục gốc, Node.js 22.x. Kết nối Neon và đặt hai biến môi trường ở trên, sau đó Deploy/Redeploy. Vercel dùng build command từ `vercel.json`.

### Preview và production

- Production và Preview phải dùng database/branch riêng nếu bạn bật Preview Deployment. Cấu hình cả `DATABASE_URL` và `DIRECT_URL` theo từng môi trường, luôn trỏ đến cùng database trong môi trường đó. Build sẽ chạy migration; không nối preview tùy ý vào database production.
- Chọn vùng database gần vùng chạy Vercel Functions. Không hardcode vùng trong repo vì chưa biết vùng database bạn chọn.
- Cookie đăng nhập HttpOnly, SameSite=Lax, Secure trong production; tên miền Vercel có HTTPS.
- Phiên đăng nhập và rate limit được lưu trong PostgreSQL dùng chung giữa các serverless instance.
- Nếu build báo thiếu URL, điền biến môi trường và Redeploy. Nếu báo không kết nối được database, kiểm tra host, mật khẩu, SSL và dùng URL direct cho migration. Script không in connection string ra log.

## Chạy local với PostgreSQL

Để dùng ngay trên máy mà chưa có PostgreSQL, chạy `npm run dev:local`. Chế độ này dùng database SQLite bền vững tại `prisma/dev.db`, hỗ trợ đăng ký/đăng nhập và quản lý đơn bình thường. Tài khoản local chưa đồng bộ lên Vercel. Dừng server local trước khi build/deploy vì Prisma Client được tạo lại theo database đích; `npm run build` và `vercel-build` luôn tạo client PostgreSQL.

Cần Node.js 22 và một database PostgreSQL riêng cho development.

```sh
npm install
```

Sao chép `.env.example` thành `.env`, thay `DATABASE_URL` và `DIRECT_URL` bằng URL thật, sau đó:

```sh
npm run setup
npm run dev
```

Mở http://localhost:3000. `npm run setup` áp dụng migration, không xóa dữ liệu đã có. Không commit `.env`.

## Dữ liệu từ bản SQLite trước

Bản cũ được giữ ở `prisma/dev.db` (nếu đã chạy local); `.env` cũ được giữ ở `.env.sqlite.backup`. Schema và migration SQLite tham khảo ở `legacy/sqlite/`. Chúng không được deploy lên Vercel. PostgreSQL dùng migration riêng trong `prisma/migrations/`.

**Chưa tự động chuyển dữ liệu SQLite sang PostgreSQL.** Nếu đã có tài khoản/đơn thật ở bản local, cần nhập dữ liệu sang PostgreSQL trước khi sử dụng chính thức. Không chạy migration PostgreSQL trên file SQLite và không xóa file cũ.

## Kiểm tra

```sh
npm run typecheck
npm run test:db
npm run build
npm audit
# Server local đang chạy và trỏ vào PostgreSQL kiểm thử riêng:
npm test
```

Test Playwright tạo hai shop tạm để kiểm tra đăng nhập, dữ liệu lưu bền, CRUD, chống sửa chéo shop và bố cục ở 360/390/768/1440px; cuối test xóa dữ liệu thử. Máy Windows có Chrome/Edge sẽ dùng trình duyệt đã cài; máy khác chạy `npx playwright install chromium` hoặc đặt `BROWSER_PATH`. `TEST_URL` đổi địa chỉ server. Không chạy test trên production.

`test:db` kiểm tra SQL migration bằng PostgreSQL WASM (PGlite), không cần tài khoản cloud. Nó không thay thế kiểm thử kết nối Prisma/Neon và end-to-end trên Vercel. `npm run build` chỉ kiểm tra build; `npm run vercel-build` cần URL thật và sẽ áp dụng migration lên database đã cấu hình.

## Phạm vi hiện tại

Mỗi tài khoản là một shop. Mọi thao tác đơn hàng lấy `shopId` từ session ở máy chủ; client không được chọn shop đích. Mật khẩu dùng scrypt/salt, session token được hash trong database. Thống kê giá trị đơn không phải doanh thu đã thu tiền.

Chưa có xác minh email, quên mật khẩu, phân quyền nhân viên, thu tiền hoặc realtime. Tải lại trang để lấy thay đổi từ thiết bị khác. Danh sách hiện tải toàn bộ đơn của shop; nên thêm phân trang server khi dữ liệu lớn. Font Google có fallback nếu không có mạng.

Tài liệu: [Vercel PostgreSQL](https://vercel.com/docs/postgres), [Neon tích hợp Vercel](https://neon.com/docs/guides/vercel-managed-integration).

## Báo cáo bán hàng

Mở `/reports` hoặc mục **Báo cáo**. Lọc Hôm nay, 7 ngày qua, Tháng này, Tháng trước hoặc khoảng ngày tùy chọn (bao gồm cả hai ngày đầu/cuối). Báo cáo dùng `orderDate` (Ngày đặt đơn), độc lập với `date` (Ngày giao). Ngày đặt mặc định là hôm nay theo Asia/Ho_Chi_Minh và có thể sửa trong form đơn.

Chỉ số: số đơn, tổng tiền bán, đã thu, còn phải thu, trung bình/đơn, đơn trả đủ, tỷ lệ đã thu; bảng theo ngày có đơn và phân bố trạng thái. Tổng tiền bán gồm mọi trạng thái; số đã thu là số tiền hiện tại của các đơn trong kỳ, không phải dòng tiền phát sinh theo ngày thanh toán. Sửa/xóa đơn sẽ cập nhật báo cáo, chưa có lịch sử giao dịch hoặc hoàn tiền.

Migration tự điền ngày đặt cho đơn cũ từ `createdAt` quy đổi sang giờ Việt Nam; cần chỉnh lại nếu ngày nhập hệ thống khác ngày khách đặt thực tế. Cả PostgreSQL và SQLite đều có migration giữ nguyên đơn hiện có.

## Cách ly dữ liệu giữa các shop

Mỗi tài khoản có một shop. Đây là cách ly quyền truy cập trên database dùng chung, không phải tạo database/VPS riêng cho từng shop. Các truy vấn nghiệp vụ nằm trong `lib/shop-data.ts`, chỉ lấy shop từ session phía server và luôn giới hạn thao tác theo shop hiện tại. Module dữ liệu và xác thực được đánh dấu `server-only`.

- Sản phẩm: trang `/products`, thêm/sửa, ẩn/mở bán lại, giá và mô tả riêng. Shop mới không có sản phẩm/đơn mẫu dùng chung.
- Đơn hàng có thể chọn sản phẩm trong shop; tên và giá bán được lưu vào đơn để giữ lịch sử. Đơn cũ vẫn giữ nội dung nhập tay, không tự suy đoán hoặc gộp sản phẩm giữa các shop.
- Database dùng khóa ngoại ghép `(productId, shopId)` để chặn liên kết đơn/ảnh với sản phẩm của shop khác.
- Ảnh: tối đa 3 ảnh/sản phẩm, JPG/PNG/WebP, 3 MB/ảnh; kiểm tra nội dung thực, đổi sang WebP và giảm kích thước tối đa 1600 px. Dữ liệu nhận upload bị giới hạn trước khi giải mã.
- Đường dẫn lưu trữ: `shops/<shopId>/products/<productId>/<uuid>.webp`. Tiền tố thư mục chỉ là tổ chức dữ liệu; quyền truy cập thực được kiểm tra bằng session và bản ghi ảnh thuộc shop.
- Ảnh được đọc qua `/api/images/<id>`, có xác thực mỗi lần và `Cache-Control: private, no-store`. Shop khác biết ID vẫn không tải được. Không phát URL bucket công khai hay URL ký có thể chia sẻ. Người dùng đã tải ảnh xuống vẫn có thể tự sao chép file đó.
- Các thao tác tải/xóa ảnh kiểm tra Origin; không bật CORS cho website khác.
- Ẩn sản phẩm giữ lịch sử đơn. Xóa ảnh làm ảnh đó biến mất cả ở đơn đang tham chiếu sản phẩm, không nhân bản ảnh theo đơn.

### Local và Vietnix S3

`npm run dev:local` lưu ảnh trong `.private-storage/` bên ngoài `public/`, bị loại khỏi Git và upload Vercel. Không bật thư mục này thành static/public route. Sao lưu cả database và thư mục ảnh khi dùng local. Các ảnh local không tự chuyển sang S3 khi deploy.

Trên Vercel, bắt buộc cấu hình `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` theo `.env.example`. Bucket phải riêng tư, chặn public access, không có policy cho anonymous đọc file. Access key chỉ dùng phía server, giới hạn bucket cần thiết. Tài khoản shop không nhận access key.

Code adapter S3 đã có, nhưng chưa kết nối hoặc kiểm thử tài khoản Vietnix thật. Route ảnh hiện chuyển dữ liệu qua server sau khi xác thực, nên sẽ phát sinh băng thông xử lý ảnh trên Vercel; đây là lựa chọn để chặn truy cập chéo ngay cả khi người khác có URL ứng dụng. Không tự bật CDN cache công khai cho các route này.

### Kiểm thử tách shop

`npm run test:tenants` dùng hai shop tạm để kiểm tra danh mục riêng, sửa ID sản phẩm, giả shopId, liên kết sản phẩm khác shop, xem/tải/xóa ảnh trái quyền, giả yêu cầu xóa đơn, sửa cài đặt shop, đăng xuất, phiên hết hạn và giới hạn ba ảnh. `npm run test:db` kiểm tra migration và khóa ngoại ghép trên PostgreSQL WASM. `npm test` kiểm tra luồng đơn hàng/báo cáo và tách dữ liệu cũ.

Khi test server local SQLite trên PowerShell, đặt `$env:DATABASE_URL='file:D:/Flower Order/prisma/dev.db'` trong terminal chạy test; server phải đang chạy bằng `npm run dev:local`. Chỉ test với database development. Các file ảnh tạm được dọn sau test.


### Thu chi và ảnh trong form sản phẩm

Trong tab Thu chi, **Tổng thu = doanh thu đơn hàng theo ngày đặt** trong khoảng lọc, gồm phần chưa thanh toán. Tổng chi lấy các phiếu chi theo ngày giao dịch; chênh lệch = doanh thu − tổng chi. Các phiếu thu thủ công chỉ nằm trong sổ giao dịch, không cộng trùng vào Tổng thu. “Tất cả thời gian” bao phủ cả ngày đặt đơn lẫn ngày giao dịch.

- Tab **Tổng quan** là tên mới của lịch đơn hàng; giữ lịch giao và thống kê.
- `/cashflow`: sổ thu chi thủ công riêng từng shop, thêm/sửa/xóa phiếu, ngày giao dịch, danh mục, ghi chú, lọc ngày và loại phiếu. Tổng thu/chi và chênh lệch tính theo khoảng ngày; bộ lọc loại chỉ lọc danh sách. Chênh lệch này không phải lợi nhuận hoặc số dư ngân hàng. Tiền đã thanh toán trên đơn hàng chưa tự tạo phiếu thu.
- Form thêm/sửa sản phẩm chọn tối đa 3 ảnh, xem trước và bỏ ảnh trước khi lưu. Ảnh tải tuần tự qua API riêng. Nếu một ảnh lỗi, sản phẩm và ảnh đã thành công vẫn được giữ; bấm lưu lại thử các ảnh còn lại trên cùng sản phẩm.
- Migration `20260923010000_cash_entries` bổ sung bảng thu chi cho PostgreSQL và SQLite, giữ nguyên đơn hiện có.
- Kiểm tra bằng `npm run test:cashflow` khi localhost chạy và `DATABASE_URL` trỏ đến SQLite local, tương tự test tenancy.

### Mã đơn và khách hàng

- Tab **Khách hàng** (`/customers`) hiển thị mã, tên, SĐT và địa chỉ; tìm theo mã, tên có/không dấu hoặc một phần số điện thoại. Thêm khách trực tiếp tại đây sẽ cấp mã từ cùng bộ đếm với form đơn, đồng thời xuất hiện trong gợi ý khi lên đơn. Tên và SĐT đã tồn tại được báo trùng, không tạo thêm bản ghi. Địa chỉ có thể để trống trong danh bạ và nhập khi giao hàng.

- Mỗi shop tự cấp mã đơn `DH000001` và mã khách `KH000001`. Hai shop có thể có cùng mã hiển thị nhưng dữ liệu độc lập. Bộ đếm tăng trong transaction, không dùng lại mã sau khi xóa đơn; sửa đơn giữ nguyên mã.
- Form đơn có tìm/chọn khách cũ hoặc thêm khách mới khi lưu. Tên và số điện thoại trùng nhau sẽ dùng lại khách; số điện thoại được bỏ khoảng trắng, dấu ngoặc và dấu gạch ngang khi đối chiếu. Hai khách khác tên dùng chung số điện thoại vẫn có thể có mã riêng. Địa chỉ giao lưu riêng cho từng đơn.
- Migration `20260923020000_customer_codes` cấp mã và liên kết khách cho đơn cũ, giữ thông tin lịch sử, giá, thanh toán và quyền sở hữu. Khóa ngoại ghép ngăn gắn khách của shop khác. Tìm đơn hỗ trợ mã đơn và mã khách.
- `npm run test:customers` kiểm tra chọn/tạo khách, dùng lại khách, cấp mã đồng thời, giữ mã khi sửa, không tái sử dụng mã đã xóa và chặn truy cập chéo shop.

### Giao diện cartoon pastel

Menu nằm trong ngăn trượt bên trái, mở bằng nút ☰ trên PC/mobile. Có thể đóng bằng nút X, phím Escape, bấm nền bên ngoài hoặc chọn mục điều hướng. Ngăn dùng dialog để giữ focus trong menu, khóa cuộn nền và trả focus về nút mở khi đóng; `tests/menu.test.mjs` kiểm tra ở 320/390/1440px. Thanh đầu trang đã bỏ các dòng giới thiệu không gian/shop.

Font Nunito hỗ trợ tiếng Việt được tự lưu trữ bằng `next/font`, áp dụng cùng các màu pastel, viền và bóng đổ trong `app/cartoon.css`. Minh họa hoa ở Tổng quan là SVG trong `app/ui/cute-flower.tsx`. Kiểm tra giao diện gồm màn hình 320/390/768/1440px, lịch 20 bông/ngày và các luồng đơn hàng, sản phẩm, khách hàng, thu chi, báo cáo trên shop tạm.

### Báo cáo tài chính

Trong `/reports`, chọn **Tài chính**. Lợi nhuận trước thuế theo công thức của shop = giá trị các đơn có ngày đặt trong kỳ − các phiếu chi có ngày giao dịch trong kỳ. Doanh thu bao gồm phần chưa thanh toán và mọi trạng thái đơn; phiếu thu không cộng thêm vào doanh thu. Bộ lọc ngày áp dụng cho cả hai nguồn. Báo cáo hiển thị số âm khi chi vượt doanh thu, chi tiết ngày (kể cả ngày chỉ có chi) và tổng chi theo danh mục. Các thay đổi phiếu chi cập nhật lại báo cáo. Dữ liệu luôn giới hạn theo shop đăng nhập; `test:cashflow` kiểm tra công thức, ngày, phiếu thu và tách shop.
