# Kiểm tra bản bàn giao

## Đã kiểm tra bằng dữ liệu thật

- Có đủ 1.716 WebP trong manifest, tất cả đường dẫn tồn tại.
- So sánh từng byte: tất cả ảnh và manifest nguyên vẹn so với ZIP gốc.
- Đọc và kiểm tra header/kích thước cả 1.716 WebP; khớp manifest.
- Truyện lấy đủ 302 đoạn (bao gồm đoạn rỗng) sau tiêu đề DOCX.
- Lá thư trích 16 đoạn từ lời chúc trong DOCX; không thêm lời chúc mới.
- Nhạc AAC có thật, thời lượng khoảng 35,8 giây, tách stream không mã hóa lại.
- JavaScript qua kiểm tra cú pháp bằng Node.

## Đã kiểm tra logic bằng môi trường mô phỏng DOM/RAF/network

1. Không tự phát âm thanh trước thao tác mở bìa.
2. Reduced motion mở tới khung đầu, chờ nhấn Phát.
3. Phát hơn 90 khung liên tiếp theo đúng thứ tự, không nhảy khung; tối đa một vòng RAF.
4. Tối đa 4 yêu cầu tải đồng thời và không quá 52 bitmap trong cache; bitmap cũ được giải phóng.
5. Mở truyện dừng ảnh; tiếp tục đúng khung đang xem.
6. Tua tới vị trí mới trong khi yêu cầu cũ còn chậm: callback cũ không vẽ ngược.
7. Lỗi tải giữ khung hiện tại; nút thử lại tải được và phát tiếp.
8. Đổi sang 24 fps cập nhật thời lượng 1:11.
9. Khung 1.716 tạo đúng một hẹn phong thư sau 2 giây; thư có đầy đủ 16 đoạn.
10. Replay từ thư đóng hộp đọc, về khung 1, đưa nhạc về 0, giữ tốc độ.
11. Chuyển tab dừng âm thanh/vòng RAF và không tự tiếp tục khi quay lại.
12. Replay hủy hẹn kết thúc cũ và giữ lựa chọn tắt nhạc/âm lượng.

Mã kiểm tra kèm trong `checks/player-test.cjs`. Tại thư mục giải nén, chạy `node checks/player-test.cjs` nếu đã cài Node.js.

## Chưa xác nhận trên trình duyệt thật

Môi trường làm việc không có luồng kiểm tra trình duyệt phù hợp cho bản HTML tĩnh này. Các kiểm tra mô phỏng không thay thế thử nghiệm trên Chrome/Safari hoặc điện thoại thật. Chưa xác nhận bằng ảnh chụp giao diện, cử chỉ chạm, focus trap native dialog, autoplay thực tế hoặc Fullscreen trên thiết bị thật. CSS đã có breakpoint điện thoại và reduced motion nhưng cần mở thử theo README trước khi gửi món quà.

## Xuất bản

Chưa có website online mới được xuất bản: bước đăng ký tên đường dẫn gặp xung đột tên đã tồn tại. Gói ZIP độc lập không cần dịch vụ hosting đó; có thể chạy local hoặc đưa toàn bộ thư mục lên dịch vụ hosting tĩnh bạn chọn. Không thay đổi quyền truy cập hay nội dung website đã tồn tại.
