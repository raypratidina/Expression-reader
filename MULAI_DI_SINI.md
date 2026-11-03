# Expression Reader — Jalankan secara lokal

Paket ini berisi source code dan model dari versi MVP1 yang sudah dibuat.
Tidak perlu build ulang, API key, npm install, atau koneksi internet untuk analisis.

## Deploy ke Vercel (via GitHub)
1. Push repo ini ke GitHub.
2. Buka https://vercel.com dan import repo dari GitHub.
3. Vercel otomatis mendeteksi konfigurasi dari vercel.json.
   - Framework Preset: Other
   - Build Command: (kosongkan)
   - Output Directory: public
4. Klik Deploy. Selesai.

## Jalankan di lokal (opsional)
Python 3 diperlukan untuk menjalankan server lokal:

1. Buka terminal di folder Expression_Reader_MVP1.
2. Windows: py -m http.server 8000 --bind 127.0.0.1 --directory public
   macOS/Linux: python3 -m http.server 8000 --bind 127.0.0.1 --directory public
3. Buka http://localhost:8000 di Chrome atau Edge.
4. Klik Mulai kamera, lalu izinkan akses kamera.
5. Klik Akhiri sesi untuk mematikan kamera. Tekan Ctrl+C di terminal untuk menutup server.

Jika perintah py tidak tersedia, coba python atau instal Python 3 terlebih dahulu.
Jika port 8000 sudah dipakai, ganti angka 8000 pada perintah dan URL menjadi 8001.
Jangan membuka index.html langsung melalui file://; model dan kamera memerlukan server lokal.

Isi paket:
- public/index.html: tampilan aplikasi
- public/style.css: styling
- public/app.js: logika kamera dan analisis
- public/models/: model deteksi, landmark, dan ekspresi
- public/vendor/: runtime FaceAPI serta lisensinya
- vercel.json: konfigurasi Vercel (headers, caching, security)
- README.md: keputusan implementasi dan batas pengujian

Frame kamera diproses di perangkat. Riwayat hanya disimpan sementara selama sesi.
Menjalankan aplikasi ini tidak mengirim permintaan ke API AI berbayar dan tidak memakai token ChatGPT.
Estimasi ekspresi tidak menentukan perasaan pengguna. Akurasi dan performa webcam perlu diuji langsung.
