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
| Bút | Nét đổi độ dày theo áp lực bút, làm mượt điểm, 7 màu nhanh + màu tuỳ chọn |
| Nét chữ | **Chống rung**: Tắt / Nhẹ / Mạnh (giảm run tay khi viết chữ) và **độ nhạy áp lực** 0–100% (0% = nét đều) |
| Thước kẻ | Công cụ kẻ đường thẳng: kéo từ đầu đến cuối là ra một đoạn thẳng tuyệt đối; giữ `Shift` khi đang dùng bút thường cũng cho đoạn thẳng |
| Kéo điểm | Công cụ ↕ (`M`): mỗi đoạn thẳng hiện hai điểm tròn ở hai đầu, nắm điểm để kéo chỉnh hình như GeoGebra — góc chung của nhiều đoạn dính liền nên cả hình đổi theo, kéo xong `Ctrl+Z` trả lại như cũ |
| Toàn màn hình | Nút ⛶ hoặc phím `F` — ẩn thanh địa chỉ, giấy dùng trọn màn hình |
| Cỡ nét | 3 nút cỡ nhanh trên thanh trên (mảnh / vừa / đậm) + thanh trượt chỉnh chi tiết |
| Kiểu nét | Nét liền, nét đứt, nét chấm, nét đứt–chấm — dùng để vẽ hình học (cạnh thấy / cạnh khuất, trục) |
| Dạ quang | Nét trong suốt để tô sáng, độ dày riêng |
| Tẩy | Tẩy theo từng nét (quét qua nét nào xoá nét đó), có vòng tròn con trỏ |
| Trang | Danh sách trang có ảnh thu nhỏ, thêm / nhân bản / xoá, chuyển trang bằng mũi tên hai bên |
| Giấy | Trắng – kẻ dòng – kẻ ô – chấm, tràn viền như sổ tay |
| Tự cuộn | Viết tới dải tím ở đáy là trang tự chạy lên (giữ bút trong dải là cuộn liên tục) |
| Lòng bàn tay | Bút cảm ứng vẽ, ngón tay chỉ cuộn trang — không bị chấm mực khi tì tay |
| Hoàn tác | Undo / Redo 60 bước, áp dụng cho cả vẽ, tẩy, đổi trang, đổi nền |
| Lưu phiên | Tự lưu vào `localStorage` sau mỗi thay đổi, tự khôi phục khi mở lại |
| Xuất | PNG (trang hiện tại, 2x), PDF (toàn bộ trang, ảnh JPEG nhúng, không thư viện ngoài) |
| Tệp | Xuất / nhập `.json` để sao lưu hoặc chuyển máy |
| Xem | Zoom giấy 35–800%, nút "Vừa" canh giấy theo chiều rộng khung (giấy luôn phủ kín bề ngang cửa sổ) |
| Khổ giấy | **A4 dọc / A4 ngang / A3 dọc / A3 ngang / Trang dài / Vừa màn hình** trong ⚙. Lưu cho lần sau, xuất PDF đúng khổ |
| Tự nối dài | Công tắc trong ⚙: bật lên thì trang **cứ dài thêm khi viết tới đáy** — dùng với A3 ngang là có trang A3 ngang dài vô tận; áp cho mọi khổ trừ "vừa màn hình", nhớ cho lần sau |
| Phóng giấy | `Ctrl` + lăn chuột hoặc chụm 2 ngón trên giấy để phóng to / thu nhỏ đúng chỗ đang trỏ — **thanh công cụ giữ nguyên kích thước** |
| Cỡ giao diện | Nhỏ / Vừa / Lớn trong ⚙ — đổi độ lớn thanh công cụ, nhớ cho lần sau |

## Giao diện

Bám theo Scrble Ink: thanh trên rất mỏng, tên ghi chú ở giữa kèm số trang trong
ngoặc, cụm chấm màu bên phải (chấm đang chọn phóng to có dấu ✓), ba chấm cỡ nét,
bốn công cụ bút / kẻ thẳng / kéo điểm / dạ quang / tẩy và nút cài đặt. Đáy màn hình
là dải tím đánh dấu vùng tự cuộn, hai mũi tên tam giác hai bên để chuyển trang.
Giấy kẻ dòng chạy tràn viền, không khung, không lề đỏ.

Giấy luôn rộng bằng bề ngang cửa sổ và **không thu nhỏ hơn mức đó**: kéo nhỏ mãi
cũng dừng ở "vừa chiều rộng", nên không bao giờ có hai dải trắng hai bên. Muốn
nhiều chỗ hơn thì bật toàn màn hình (`F`).

Thanh công cụ cao 42 / 48 / 57 px (Nhỏ / Vừa / Lớn) để vẫn dễ bấm khi thu nhỏ
trang; mọi kích thước trong thanh đều theo biến CSS `--ui` nên chỉnh một chỗ là
toàn bộ icon, chấm màu, cỡ nét, tên ghi chú to nhỏ theo. Khi cửa sổ hẹp, tên ghi
chú tự ẩn để không đè lên cụm công cụ.

Thanh công cụ **không bao giờ co giãn theo giấy**: phóng to / thu nhỏ chỉ tác
động lên trang giấy. Kể cả khi thu phóng trình duyệt (`Ctrl` `+` / `Ctrl` `-`),
thanh được bù lại theo `devicePixelRatio` để giữ nguyên kích thước thật.

## Phím tắt

| Phím | Tác dụng |
| --- | --- |
| `P` / `H` / `E` | Bút thường / Dạ quang / Tẩy |
| `S` | Công cụ kẻ đường thẳng (hoặc giữ `Shift` rồi kéo bằng bút thường) |
| `M` | Công cụ kéo điểm — nắm đầu đường thẳng để chỉnh hình |
| `F` | Bật / tắt toàn màn hình |
| `L` | Đổi kiểu nét: liền → đứt → chấm → đứt–chấm |
| `Ctrl+Z` / `Ctrl+Shift+Z` (hoặc `Ctrl+Y`) | Hoàn tác / Làm lại |
| `[` `]` | Giảm / tăng độ dày nét |
| `←` `→`, `PageUp` `PageDown` | Trang trước / trang sau |
| `Delete` / `Backspace` | Xoá hết nét của trang hiện tại |
| `+` `-` | Phóng to / thu nhỏ |
| `Esc` | Đóng menu |

## Cấu trúc

```
scrble-ink/
├─ index.html        giao diện: thanh trên mỏng, giấy tràn viền, dải tím tự cuộn ở đáy
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

- Kích thước trang logic nằm trong tài liệu: A4 dọc 794 × 1123, A4 ngang
  1123 × 794, A3 dọc 1191 × 1684, A3 ngang 1684 × 1191, "trang dài" 794 × 2246,
  hoặc "vừa màn hình" = đúng khung nhìn (bám theo khi đổi cỡ cửa sổ). Canvas
  render ở `dpr × zoom` nên nét vẫn sắc khi phóng to.
- Cờ `grow` (lưu trong tài liệu và trong `localStorage` của bảng chọn) quyết định
  việc tự nối dài: khi bật, mỗi nét kết thúc trong 90px cuối trang sẽ cộng thêm
  561 vào `pageH` (tối đa 14000). "Trang dài" luôn bật, "vừa màn hình" luôn tắt.
- Nét bút vẽ bằng chuỗi tứ giác nối tiếp (mỗi đoạn một độ rộng), gom vào một
  path duy nhất rồi `fill()` một lần → mượt và nhanh.
- PDF được sinh thủ công: mỗi trang là một XObject ảnh JPEG (`/DCTDecode`) trên
  đúng khổ giấy của trang (A4 hoặc khổ màn hình), kèm bảng `xref` và `startxref` chuẩn.
- Không có mã mạng, không tải gì từ Internet; mọi thứ chạy cục bộ.
