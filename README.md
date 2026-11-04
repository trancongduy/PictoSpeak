# PictoSpeak 📸🔊

Chụp ảnh chữ tiếng Anh → nghe đọc to bằng giọng kiểu IELTS. Miễn phí, không giới hạn, chạy trên iPhone như app (PWA).

## Tính năng
- Chụp/chọn ảnh, cắt vùng, xoay → nhận dạng chữ ngay trên máy (tesseract.js), sửa lại được
- Đọc to theo từng câu, tô sáng câu đang đọc, tốc độ 0.5–1.5×, lặp câu
- Giọng Anh-Anh / Úc / Mỹ / Ireland và chế độ **IELTS mix** (đổi giọng theo đoạn / người nói)
- Chạm vào từ: phiên âm IPA, nghĩa Việt, nghĩa Anh, giọng người thật, lưu vào sổ từ
- Dịch tiếng Việt từng câu
- Luyện tập: nhại theo (shadowing), luyện phát âm có chấm điểm, chép chính tả
- Flashcard ôn tập ngắt quãng, chuỗi ngày học 🔥
- Lịch sử bài đọc; dữ liệu chỉ lưu trên máy (IndexedDB)

## Chạy thử
```bash
npm install
npm run dev        # mở http://localhost:5173 (hoặc IP máy tính trên cùng Wi-Fi)
npm run build      # build ra dist/
```

## Đưa lên iPhone
Chạy `npm run deploy` (build rồi đẩy lên nhánh `gh-pages`).
Mở `https://<user>.github.io/<repo>/` bằng Safari → Chia sẻ → **Thêm vào MH chính**.

Giọng đọc hay hơn: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Anh → tải giọng *Cao cấp/Nâng cao* (Serena, Daniel, Karen, Ava…).
