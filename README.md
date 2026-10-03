# Kết Nối Tài Trợ

Web app giúp nhóm học sinh, sinh viên và tổ chức phi lợi nhuận:

- **Khám phá dự án**: tìm dự án theo tên, chủ đề, kỹ năng, địa điểm (tìm từ khoá không dấu hoặc AI hiểu ý) và tham gia với vai trò Thành viên, Cộng tác viên, Tình nguyện viên, Donator, Cố vấn / Nhà tài trợ / Đối tác.
- **Dự án của tôi**: AI gợi ý nhà tài trợ quốc tế, bảng theo dõi tiến trình liên hệ (kéo thả), soạn thư xin tài trợ bằng AI, quản lý người tham gia.

## Chạy thử

Mở `index.html` bằng trình duyệt.

## Giới hạn hiện tại

Bản đầy đủ chạy dưới dạng Claude Artifact, dùng các tính năng của Claude cho dữ liệu chung, đăng nhập và AI. Khi mở ngoài Claude (file local hoặc GitHub Pages), app chạy ở **chế độ riêng trên máy**:

- dữ liệu chỉ lưu trong `localStorage` của trình duyệt đó;
- không có tính năng AI;
- không phân biệt người dùng.

Muốn chạy độc lập đầy đủ cần thêm backend (ví dụ Firebase/Supabase) và API AI.
