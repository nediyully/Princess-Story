# CÔNG CHÚA VÀ NGỌN NẾN THỨ HAI MƯƠI BA

Website HTML/CSS/JavaScript thuần, không backend, không đăng nhập, không thư viện ngoài và không cần Internet nếu chạy tại máy. Giải nén toàn bộ gói trước khi chạy.

## Chạy website

Cài Python 3 nếu máy chưa có. Mở Terminal / PowerShell ngay tại thư mục chứa `index.html`, chạy:

```sh
python -m http.server 8000
```

Nếu máy dùng lệnh `python3`:

```sh
python3 -m http.server 8000
```

Mở http://localhost:8000 trên trình duyệt. Dừng máy chủ bằng Ctrl+C. Không mở trực tiếp index.html bằng file:// vì trình duyệt chặn tải JSON theo cách đó. Có thể dùng VS Code Live Server thay thế.

Muốn thử trên điện thoại cùng Wi-Fi: mở `http://IP-cua-may-tinh:8000` (thay IP bằng địa chỉ mạng LAN thật của máy tính), cho phép máy chủ qua tường lửa khi được hỏi. Chỉ dùng trên mạng tin cậy. Máy chủ Python là công cụ xem thử, không dùng làm hosting công khai.

## Cấu trúc

- `index.html`: giao diện tiếng Việt và các hộp đọc.
- `style.css`: bìa, trang giấy, phong thư, giao diện responsive và reduced motion.
- `script.js`: phát chuỗi ảnh, tải trước, nhạc, bàn phím và trạng thái.
- `data/config.json`: tên truyện, dòng đề tặng, tốc độ mặc định, đường dẫn nhạc và âm lượng.
- `data/story.json`: toàn bộ truyện từ DOCX, giữ thứ tự đoạn và các khoảng ngắt.
- `data/letter.json`: nguyên văn 16 đoạn lá thư trong DOCX; không phải lời chúc tự viết thêm.
- `manifest.json`: bản gốc từ ZIP, giữ nguyên.
- `frames/`: đủ 1.716 WebP, giữ nguyên từng byte và thứ tự manifest.
- `music/birthday.m4a`: âm thanh AAC tách từ MP4 được cung cấp, không mã hóa lại.
- `QA.md`: phạm vi kiểm tra và giới hạn.

## Thay nội dung

Mở JSON bằng trình soạn thảo văn bản lưu UTF-8. Giữ đúng cú pháp dấu ngoặc và dấu phẩy. Chạy máy chủ rồi tải lại trang sau khi sửa.

1. Tên truyện: sửa `title` trong `data/config.json`; sửa `title` trong `data/story.json` nếu muốn đổi tiêu đề hộp đọc. Đổi cả `<title>` trong index.html nếu muốn tên hiển thị đúng ngay trước khi tải dữ liệu xong.
2. Dòng bìa: sửa `dedication` trong config.json.
3. Truyện: sửa từng chuỗi trong `paragraphs` của story.json. Chuỗi rỗng `""` tạo khoảng ngắt. Không đưa HTML vào chuỗi.
4. Thư: sửa `title` và `paragraphs` của letter.json. `source` chỉ là ghi chú nguồn, không hiển thị.
5. Nhạc: đặt file thật vào music/, sửa `music` trong config.json theo đường dẫn tương đối. MP3 hoặc M4A được khuyên dùng. Đặt `music: null` để bỏ hoàn toàn nút nhạc. File nhạc hiện có dài khoảng 35,8 giây và tự lặp; độ liền mạch chỗ nối phụ thuộc âm thanh gốc.
6. Tốc độ mặc định: đổi `defaultFps` thành 6, 12, 18 hoặc 24. Thời lượng danh nghĩa tương ứng 4:46, 2:23, khoảng 1:35 và khoảng 1:11. Thời gian tải chờ không nằm trong thời lượng.
7. Âm lượng: `defaultVolume` từ 0 đến 1; mặc định 0.22. Khi đọc truyện/thư, nhạc giảm còn một nửa mức đã chọn.
8. Muốn thay ảnh: sửa manifest cùng file tương ứng, không cần sửa JavaScript. Bản bàn giao giữ đúng bộ 1.716 ảnh của bạn.

## Điều khiển

- Chạm/Enter trên bìa để mở. Khi hệ điều hành bật giảm chuyển động, sách mở rồi chờ người xem nhấn Phát.
- Phát/Tạm dừng, trang trước/sau, thanh tua, tốc độ và Replay hoạt động tại chỗ.
- Space phát/dừng; mũi tên trái/phải xem từng trang khi focus không ở các điều khiển riêng. Range hỗ trợ bàn phím theo trình duyệt.
- Đọc câu chuyện: tạm dừng ảnh, giữ nhạc nhỏ. Đóng/Escape vẫn tạm dừng; Tiếp tục xem phát tiếp đúng vị trí.
- Cuối phim giữ cảnh cuối 2 giây rồi hiện phong thư, chờ người xem mở. Replay xóa mọi hẹn kết thúc cũ, giữ tốc độ/âm lượng/trạng thái nhạc và đưa nhạc về đầu.
- Chuyển tab tạm dừng cả tranh và nhạc. Quay lại không tự phát.
- Toàn màn hình chỉ xuất hiện khi trình duyệt hỗ trợ. Một số trình duyệt điện thoại không cung cấp API này.

## Hiệu năng và bảo trì

Dùng canvas cố định tỷ lệ 4:3, letterbox để giữ nguyên toàn bộ tranh; không crossfade/zoom/pan. requestAnimationFrame hiển thị lần lượt, không nhảy qua khung khi bị chậm. Tải trước 12 ảnh lúc mở; cửa sổ cache tối đa 52 ảnh (4 phía sau, ảnh hiện tại, 47 phía trước), tối đa 4 yêu cầu đang chạy. Bitmap ra khỏi cửa sổ được close khi API hỗ trợ. Các yêu cầu của vị trí tua cũ bị hủy; mã phiên ngăn callback cũ vẽ ngược.

Bộ ảnh gốc khoảng 203 MB. Website không tải toàn bộ lúc mở; nếu xem hết, lượng dữ liệu tải gần bằng kích thước bộ ảnh. Không cần giải mã hết vào RAM. Trình duyệt có thể giữ các byte nén trong HTTP cache theo cơ chế riêng.

Không có tài liệu đầu vào nào còn thiếu: truyện, thư và âm thanh đều lấy từ ba file cung cấp. Website không chứa ảnh/nhạc từ bên ngoài, không tracking. Bản này được bàn giao dưới dạng gói chạy local; chưa có URL online mới được xuất bản.
