# D-CONNECT — Nền Tảng Nhắn Tin Thời Gian Thực (TCP Socket & MongoDB)

> **D-CONNECT** — Nền tảng giao tiếp thời gian thực hiện đại, an toàn và tối ưu, được xây dựng dựa trên giao thức TCP/IP, WebSocket (Socket.IO) và cơ sở dữ liệu MongoDB.
>
> **Brand Identity:** Xanh dương `#0E7490` • Cyan `#06B6D4` • Cổng mặc định: **3000**
> **Môn học:** Lập Trình Mạng — Đề tài: *Ứng dụng TCP Socket trong truyền thông đa người dùng*.

---

## 1. Giới thiệu dự án

**D-CONNECT** được thiết kế nhằm mô phỏng và giải quyết trọn vẹn các thách thức của một hệ thống truyền thông mạng thời gian thực:
- **Không yêu cầu tài khoản/đăng ký**: Tự động cấp danh tính `Client_XXXX` và bảo vệ phiên thông qua HTTP-only cookie.
- **Hỗ trợ Phòng chung & Phòng riêng**: Người dùng có thể trò chuyện ở phòng chung mặc định hoặc tạo phòng riêng biệt lập bằng mã ngẫu nhiên 6 ký tự bảo mật.
- **Lưu trữ bền vững & Phân trang lịch sử**: Toàn bộ tin nhắn được lưu trữ trong MongoDB với UTC timestamp, snapshot tên người gửi, hỗ trợ phân trang con trỏ (cursor-based pagination).
- **Độ tin cậy cao trên nền TCP**: Cơ chế Acknowledgement (xác nhận 2 chiều), Rate Limiting (chống spam/brute-force) và Reconnect Sync (đồng bộ tin nhắn bị bỏ lỡ khi rớt mạng).

---

## 2. Công nghệ sử dụng

| Thành phần | Công nghệ / Thư viện | Vai trò |
|---|---|---|
| **Backend Runtime** | Node.js (v20+ / v26) | Nền tảng thực thi JavaScript phía máy chủ |
| **Web Framework** | Express.js (v4.x) | Xử lý HTTP routing, Middleware, phục vụ giao diện tĩnh |
| **Giao tiếp Realtime** | Socket.IO (v4.x) | Truyền tin hai chiều trên nền TCP Socket / WebSocket |
| **Cơ sở dữ liệu** | MongoDB & Mongoose (v8.x/v9.x) | Lưu trữ Client, Session, Room và Message |
| **Bảo mật & Phiên** | Cookie (HTTP-only) & Crypto (Node.js) | Quản lý phiên bí mật, sinh mã 6 ký tự ngẫu nhiên an toàn |
| **Frontend** | HTML5, Vanilla CSS3, JavaScript ES6 | Giao diện hiện đại, responsive, không phụ thuộc framework |
| **Kiểm thử** | Node Test Runner (`node:test`, `node:assert`) | 23 bài kiểm thử tự động toàn diện |

---

## 3. Kiến trúc hệ thống & Ánh xạ mô hình TCP/IP

```
+-------------------------------------------------------------------+
|                        TRÌNH DUYỆT CLIENT                         |
|   Landing Page (index.html)     |    Phòng Chat (chat.html)       |
+---------------------------------+---------------------------------+
       | HTTP Cookie (Session)                   | WebSocket Handshake
       v                                         v
+-------------------------------------------------------------------+
|                     EXPRESS & SOCKET.IO SERVER                    |
|   - Express Session Middleware  |  - Socket Authentication        |
|   - Input Validator             |  - Rate Limiter (Anti-Spam)     |
|   - Room Service                |  - Message & Sync Service       |
+-------------------------------------------------------------------+
                               | Mongoose ODM
                               v
+-------------------------------------------------------------------+
|                         MONGODB DATABASE                          |
|  - clients: Danh tính Client    |  - sessions: Phiên đăng nhập    |
|  - rooms: Phòng chung / riêng   |  - messages: Lịch sử tin nhắn   |
+-------------------------------------------------------------------+
```

### Ánh xạ mô hình TCP/IP trong D-CONNECT:

1. **Tầng Ứng dụng (Application Layer):** Giao thức HTTP (cấp session cookie) và WebSocket (các sự kiện `send-message`, `receive-message`, `join-room`, `sync-state`).
2. **Tầng Giao vận (Transport Layer):** Giao thức **TCP** (Transmission Control Protocol) tại cổng `3000`. Đảm bảo truyền dữ liệu tin cậy, không mất gói tin, đúng thứ tự và có cơ chế bắt tay 3 bước (3-way handshake) khi khởi tạo kết nối.
3. **Tầng Mạng (Internet Layer):** Giao thức IP định tuyến giữa client và server (`127.0.0.1` / địa chỉ IP mạng nội bộ).
4. **Tầng Truy cập mạng (Network Access Layer):** Driver mạng, card mạng WiFi / Ethernet vật lý.

---

## 4. Yêu cầu môi trường & Cài đặt

### Yêu cầu:
- **Node.js**: Phiên bản 18.x trở lên (đã kiểm thử mượt mà trên Node.js v26).
- **npm**: Đi kèm với Node.js.
- **MongoDB**: MongoDB Community Server cục bộ đang chạy tại `mongodb://127.0.0.1:27017` hoặc tài khoản MongoDB Atlas trên đám mây.

### Các bước cài đặt:

1. Mở cửa sổ dòng lệnh (PowerShell hoặc Terminal) tại thư mục dự án:
```powershell
cd E:\DuLieu\24DHTT02\HK7\LapTrinhMang\BaiTapCaNhan\BTCNS2\TCP_SOCKET
```

2. Cài đặt các thư viện phụ thuộc:
```powershell
npm install
```

---

## 5. Cấu hình biến môi trường (`.env`)

Tạo tệp `.env` tại thư mục gốc của dự án (tham khảo mẫu tại `.env.example`):

```env
# Cổng TCP lắng nghe của ứng dụng
PORT=3000

# Chuỗi kết nối MongoDB (Local hoặc Atlas)
MONGODB_URI=mongodb://127.0.0.1:27017/dconnect_db

# Khóa bí mật cho Session Cookie
SESSION_SECRET=dconnect_local_dev_secret_key_2026_secured

# Môi trường chạy
NODE_ENV=development
```

> **Lưu ý bảo mật**: Tệp `.env` thật đã được liệt kê trong `.gitignore` để tránh rò rỉ cấu hình bí mật.

---

## 6. Khởi chạy ứng dụng

### Chạy ở chế độ thông thường:
```powershell
npm start
```

Sau khi khởi chạy thành công, màn hình sẽ hiển thị:
```
==============================================
  D-CONNECT Server đang chạy
  URL: http://localhost:3000
  TCP Port: 3000 (Socket.IO / WebSocket trên TCP)
  Database: MongoDB (Mongoose)
==============================================
```

Mở trình duyệt và truy cập: **`http://localhost:3000`**

---

## 7. Hướng dẫn sử dụng các tính năng

### 7.1. Cơ chế tự động cấp danh tính Client (`Client_XXXX`)
- Người dùng vào trang lần đầu không cần đăng ký tài khoản hay mật khẩu.
- Server tự động sinh tên mặc định có định dạng `Client_XXXX` (trong đó `XXXX` là 4 chữ số từ `0000` đến `9999`) và cấp màu avatar ngẫu nhiên theo tone xanh cyan.
- Server cấp một HTTP-only Cookie (`dconnect_session`) gắn với Client ID ổn định. Khi người dùng tải lại trang (F5) hoặc mở tab mới, danh tính và lịch sử được giữ nguyên.

### 7.2. Cách đổi tên hiển thị
- Người dùng có thể nhấn vào nút **✏️ Đổi tên** ngay trên trang chủ hoặc tại góc trên cùng trong phòng chat.
- Nhập tên mong muốn (từ 2 đến 20 ký tự, hỗ trợ tiếng Việt có dấu).
- Server kiểm tra và đảm bảo không trùng với thành viên khác đang trực tuyến.
- Khi đổi tên thành công:
  - Danh sách trực tuyến và tin thông báo hệ thống được cập nhật ngay lập tức.
  - Các tin nhắn cũ trong lịch sử vẫn lưu giữ nguyên tên người gửi tại thời điểm gửi.

### 7.3. Vào phòng chat chung (`general`)
- Nhấn nút **"Vào phòng chung →"** từ trang chủ hoặc qua menu "Đổi phòng".
- Phòng chung là phòng mặc định, không yêu cầu bất kỳ mã nào.
- Mọi người dùng trong phòng chung có thể trò chuyện tự do và xem danh sách những người đang online tại phòng đó.

### 7.4. Tạo phòng chat riêng (Mã 6 ký tự)
- Nhấn nút **"Tạo phòng ngay ✨"**.
- Server dùng bộ sinh số ngẫu nhiên mật mã (`crypto.randomInt`) để tạo một mã phòng duy nhất gồm đúng 6 ký tự chữ số in hoa (thuộc tập `23456789ABCDEFGHJKLMNPQRSTUVWXYZ`, loại trừ `O, 0, I, 1` để tránh nhầm lẫn).
- Người tạo phòng tự động được đưa vào phòng riêng vừa tạo.
- Tại góc trên giao diện phòng chat, mã phòng hiển thị rõ ràng kèm nút **📋 Sao chép** để gửi nhanh cho bạn bè.

### 7.5. Gia nhập phòng riêng bằng mã
- Nhập mã 6 ký tự (ví dụ: `K8M2PQ`) vào ô nhập mã tại trang chủ hoặc hộp thoại "Đổi phòng".
- Nhấn **"Vào"** / **"Gia nhập"**.
- Server xác thực định dạng, kiểm tra sự tồn tại của phòng và cấp quyền thành viên.
- Nếu nhập mã sai quá 5 lần/phút, hệ thống sẽ tự động chặn tạm thời (Rate Limit) để chống dò quét mã (brute-force).

### 7.6. Cách ly dữ liệu & Xem lịch sử tin nhắn
- **Cách ly phòng tuyệt đối**: Tin nhắn trong phòng riêng chỉ phát đến các thành viên trong phòng đó. Người ở phòng chung hoặc phòng riêng khác hoàn toàn không thể nhận hoặc đọc lén.
- **Tải lịch sử tin nhắn**: Khi vào phòng, 30 tin nhắn gần nhất được tải tự động.
- **Phân trang lịch sử**: Nếu phòng có nhiều hơn 30 tin nhắn, nút **"⬆ Tải thêm tin nhắn cũ"** sẽ xuất hiện ở đầu khung chat. Nhấn nút này sẽ tải thêm các tin nhắn cũ hơn mà không làm giật thanh cuộn của người dùng.

### 7.7. Đồng bộ khi mất kết nối (Reconnect Sync)
- Khi ngắt kết nối mạng tạm thời (ví dụ tắt bật WiFi), client tự động gửi sự kiện `sync-state` kèm mốc thời gian tin nhắn cuối cùng nhận được.
- Server truy vấn MongoDB và chuyển tiếp toàn bộ tin nhắn phát sinh trong khoảng thời gian bị ngắt kết nối, đồng thời loại trừ trùng lặp thông qua `messageId`.

---

## 8. Thẩm định và Kết quả Kiểm thử (Test Verification)

Toàn bộ hệ thống đã trải qua thẩm định với bộ kiểm thử tự động gồm **23 kịch bản kiểm thử (100% Passed)**:

```
✔ Giai đoạn 2: Quản lý Client & Session không cần tài khoản (7 tests passed)
✔ Giai đoạn 3: Lưu trữ MongoDB & Phân trang Lịch sử tin nhắn (5 tests passed)
✔ Giai đoạn 4: Quản lý Phòng chat chung & Phòng chat riêng 6 ký tự (7 tests passed)
✔ Giai đoạn 1 & 4: Tích hợp Socket.IO, Acknowledgement & Cách ly phòng (4 tests passed)

ℹ tests 23
ℹ suites 4
ℹ pass 23
ℹ fail 0
```

> **Lưu ý**: Để bàn giao mã nguồn sản phẩm gọn gàng nhất cho đồ án, toàn bộ các tệp kiểm thử tự động đã được chuyển vào thư mục lưu trữ độc lập tại `../tests_tcp_socket/`. Nếu cần chạy lại kiểm thử, có thể chạy lệnh: `node --test ../tests_tcp_socket/*.test.js`.

---

## 9. Hạn chế hiện tại & Hướng phát triển

1. **Giới hạn mô hình Session Cookie không tài khoản**: Nếu người dùng chủ động xóa Cookie hoặc mở Trình duyệt ẩn danh (Incognito), trình duyệt sẽ coi đây là một Client mới và cấp danh tính `Client_XXXX` mới. Đây là đặc tính có chủ đích của mô hình không bắt buộc đăng ký tài khoản.
2. **Gửi file & media**: Phiên bản hiện tại tập trung tối ưu gửi tin nhắn văn bản, trạng thái gõ phím và độ ổn định của TCP Socket. Tính năng gửi ảnh hoặc tệp đính kèm có thể mở rộng thông qua GridFS hoặc AWS S3 trong tương lai.
3. **Mã hóa đầu cuối (E2EE)**: Mã phòng riêng đảm bảo cách ly dữ liệu phía server. Để bảo mật cấp độ cao hơn đối với phòng riêng, có thể nghiên cứu bổ sung mã hóa đầu cuối (End-to-End Encryption) giữa các client.
