# 📋 Danh Sách Tài Khoản Demo (Study Schedule Tracker)

Tài liệu này tổng hợp thông tin các tài khoản mẫu đã được tạo sẵn trong cơ sở dữ liệu để phục vụ việc kiểm thử và trải nghiệm đầy đủ các tính năng của hệ thống.

---

## 1. Thông Tin Đăng Nhập

| STT | Vai trò | Họ và tên | Email | Mật khẩu | Mã liên kết (Link Code) | Ghi chú |
|:---:|:---|:---|:---|:---:|:---:|:---|
| 1 | 🎓 **Học sinh** (Student) | Nguyễn Văn A | `demo@example.com` | `123456` | `STU-DEMO01` | Tài khoản chính có đầy đủ dữ liệu mẫu |
| 2 | 👨‍👩‍👧 **Phụ huynh** (Parent) | Nguyễn Văn B | `parent@example.com` | `123456` | *(Không có)* | Đã liên kết sẵn với học sinh Nguyễn Văn A |

---

## 2. Dữ Liệu Mẫu Đã Tạo Sẵn

Tài khoản học sinh `demo@example.com` đi kèm các dữ liệu mẫu:

- **Môn học:**
  - `MOB101` – Lập trình Di động (ThS. Nguyen Van B)
  - `SWE201` – Kỹ thuật Phần mềm (TS. Tran Van C)
  - `ENG301` – Tiếng Anh Giao tiếp (Mr. David – Học thêm)
- **Địa điểm học:**
  - Phòng A101 - Cơ sở 1 (227 Nguyễn Văn Cừ, Q.5)
  - Phòng B202 - Cơ sở 2 (Linh Trung, TP. Thủ Đức)
  - Trung tâm Ngoại ngữ Talk & Write (123 Cách Mạng Tháng 8, Q.3)
- **Lịch học:** Các buổi học chính khóa và học thêm trong ngày hôm nay.
- **Điểm danh:** Đã có lịch sử điểm danh hoàn thành buổi học gần nhất.
- **Học phí:** Khoản học phí mẫu `Tháng hiện tại` (Tổng: 1.200.000đ, Đã đóng: 600.000đ, Còn nợ: 600.000đ).

---

## 3. Hướng Dẫn Trải Nghiệm Tính Năng

### 🎓 Dành cho vai trò Học sinh (`demo@example.com`):
1. **Xem thời khóa biểu & Dashboard:** Xem tổng quan lịch học hôm nay, lịch sắp tới và thống kê học tập.
2. **Lịch học (Calendar):** Chuyển đổi giữa chế độ xem theo ngày và xem theo tháng.
3. **Quản lý lịch cá nhân:** Thêm mới, chỉnh sửa, điểm danh buổi học.
4. **Mã kết nối phụ huynh:**
   - Tại thanh Header hoặc trang **Cài đặt** (Settings), học sinh có mã `STU-DEMO01`.
   - Bấm nút **Sao chép** để gửi mã này cho tài khoản phụ huynh liên kết.

### 👨‍👩‍👧 Dành cho vai trò Phụ huynh (`parent@example.com`):
1. **Theo dõi lịch học của con:**
   - Trên thanh điều hướng (Header) sẽ có menu chọn học sinh (`Nguyễn Văn A`).
   - Mọi dữ liệu tại Dashboard, Lịch học, Điểm danh và Học phí sẽ tự động hiển thị theo học sinh đang chọn.
2. **Kết nối thêm tài khoản con:**
   - Bấm vào nút **"+ Con"** hoặc **"Kết nối thêm con"** trên Header.
   - Nhập mã kết nối học sinh (ví dụ: `STU-XXXXXX` khi tạo thêm tài khoản học sinh mới).
   - Sau khi kết nối, phụ huynh có thể chuyển đổi qua lại giữa các con mà không cần đăng nhập lại.

---

## 4. Cách Reset / Nạp Lại Dữ Liệu Mẫu (Seed Data)

Nếu dữ liệu bị thay đổi trong quá trình test và bạn muốn khôi phục lại trạng thái ban đầu:

1. Mở terminal tại thư mục `backend`:
   ```bash
   cd d:\StudyScheduleTracker\backend
   ```
2. Chạy lệnh seed:
   ```bash
   npm run seed
   ```
3. Sau khi hoàn tất, hệ thống sẽ tạo lại 2 tài khoản mẫu trên cùng toàn bộ dữ liệu mẫu ban đầu.
