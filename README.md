# InkNote — web app ghi chú bằng bút

Bản web lấy cảm hứng từ Scrble Ink: viết tay bằng bút cảm ứng, nhiều trang, xuất PDF.
Toàn bộ chạy bằng HTML/CSS/JavaScript thuần — **không cần Node, npm, hay bất kỳ thư viện nào**.

## Dùng online (không cần cài gì)

**https://nguyenducanha50-pixel.github.io/inknote/**

Mở bằng Chrome / Edge trên máy tính hoặc tablet có bút cảm ứng. Ghi chú được lưu
trong trình duyệt của từng người, không chia sẻ giữa các máy.

## Chạy trên máy

**Cách 1 (khuyến nghị):** nhấp đúp `start.bat` — mở sẵn trình duyệt tại `http://127.0.0.1:8123/`.

**Cách 2:** nhấp đúp `index.html`. Chạy được ngay, nhưng một số trình duyệt hạn chế
`localStorage` trên `file://` nên tính năng tự lưu phiên có thể không hoạt động.

Trình duyệt nên dùng: Chrome / Edge / Cobalt / Brave (bản mới). Bút cảm ứng (stylus)
được nhận áp lực thật; chuột và cảm ứng thì nét đều.

## Tính năng

| Nhóm | Chi tiết |
| --- | --- |
| Bút | Nét đổi độ dày theo áp lực bút, làm mượt điểm, màu tuỳ chọn (8 màu nhanh + color picker) |
| Dạ quang | Nét trong suốt để tô sáng, độ dày riêng |
| Tẩy | Tẩy theo từng nét (quét qua nét nào xoá nét đó), có vòng tròn con trỏ |
| Trang | Thêm / nhân bản / xoá trang, chuyển trang, giấy trắng – kẻ dòng – kẻ ô – chấm |
| Hoàn tác | Undo / Redo 60 bước, áp dụng cho cả vẽ, tẩy, đổi trang, đổi nền |
| Lưu phiên | Tự lưu vào `localStorage` sau mỗi thay đổi, tự khôi phục khi mở lại |
| Xuất | PNG (trang hiện tại, 2x), PDF (toàn bộ trang, ảnh JPEG nhúng, không thư viện ngoài) |
| Tệp | Xuất / nhập `.json` để sao lưu hoặc chuyển máy |
| Xem | Zoom 35–200%, nút "Vừa" tự canh trang theo khung |

## Phím tắt

| Phím | Tác dụng |
| --- | --- |
| `P` / `H` / `E` | Bút / Dạ quang / Tẩy |
| `Ctrl+Z` / `Ctrl+Shift+Z` (hoặc `Ctrl+Y`) | Hoàn tác / Làm lại |
| `[` `]` | Giảm / tăng độ dày nét |
| `←` `→`, `PageUp` `PageDown` | Trang trước / trang sau |
| `Delete` / `Backspace` | Xoá hết nét của trang hiện tại |
| `+` `-` | Phóng to / thu nhỏ |
| `Esc` | Đóng menu |

## Cấu trúc

```
scrble-ink/
├─ index.html        giao diện: thanh công cụ trên, giấy tràn viền, thanh dưới (trang/giấy/zoom)
├─ css/styles.css    giao diện sáng, tối ưu cho bút và màn hình cảm ứng
├─ js/model.js       mô hình dữ liệu: trang, nét, điểm có áp lực; kiểm tra dữ liệu nhập
├─ js/render.js      vẽ giấy nền + nét biến thiên độ dày, hit-test cho tẩy
├─ js/export.js      xuất PNG, PDF (tự sinh PDF), JSON
├─ js/storage.js     tự lưu / khôi phục phiên bằng localStorage
├─ js/app.js         điều khiển: công cụ, trang, lịch sử, phím tắt
└─ start.bat         chạy máy chủ tĩnh bằng Python và mở trình duyệt
```

Dữ liệu một trang chỉ là các nét dạng điểm, nên file `.json` rất nhẹ và có thể
xử lý lại (ví dụ đổi màu, đổi độ dày) mà không mất chất lượng.

## Ghi chú kỹ thuật

- Kích thước trang logic: 794 × 1123 (A4 @ 96dpi). Canvas render ở `dpr × zoom`
  nên nét vẫn sắc khi phóng to.
- Nét bút vẽ bằng chuỗi tứ giác nối tiếp (mỗi đoạn một độ rộng), gom vào một
  path duy nhất rồi `fill()` một lần → mượt và nhanh.
- PDF được sinh thủ công: mỗi trang là một XObject ảnh JPEG (`/DCTDecode`) trên
  khổ A4, kèm bảng `xref` và `startxref` chuẩn.
- Không có mã mạng, không tải gì từ Internet; mọi thứ chạy cục bộ.
