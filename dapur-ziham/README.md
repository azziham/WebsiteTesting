# Dapur Ziham

Situs jajanan kaki lima Dapur Ziham: pastel bolognese, tiramisu cup, dan pudot (puding sedot).
Pengunjung memilih menu, lalu pesanannya terkirim sebagai pesan WhatsApp yang sudah rapi.

Isinya cuma HTML, CSS, dan JavaScript biasa. Tidak perlu build, tidak perlu server.

## Isi folder

| File | Fungsi |
|---|---|
| `index.html` | Halaman utama situs |
| `admin.html` | Halaman kelola menu (tambah, ubah, hapus, tandai habis) |
| `data/menu.json` | Daftar menu dan info toko. Situs membaca file ini |
| `assets/menu/` | Gambar menu. Foto yang diunggah dari admin juga masuk ke sini |
| `assets/site.*`, `assets/admin.*`, `assets/menu-store.js` | Tampilan dan kode |

## Menambah menu baru

1. Buka `admin.html` (ada tautan **Kelola menu** di bagian paling bawah situs).
2. Tekan **Tambah menu baru**. Isi nama, kategori, harga, deskripsi, dan foto.
3. Tekan **Tambahkan ke daftar**. Perubahan tersimpan otomatis sebagai draf di perangkat itu.
4. Tekan **Pratinjau** untuk melihat situs dengan draf tersebut.
5. Tekan **Terbitkan**. Menu langsung disimpan ke GitHub dan muncul di situs dalam 1 sampai 2 menit.

Di daftar menu juga ada sakelar **Tersedia** untuk menandai menu yang habis hari ini.

## Sekali saja: sambungkan tombol Terbitkan

Tombol **Terbitkan** menyimpan `data/menu.json` dan foto baru langsung ke repo GitHub ini.
Caranya ada di tab **Koneksi terbit** di halaman admin:

1. Buat kunci di <https://github.com/settings/personal-access-tokens/new>.
2. Repository access: **Only select repositories**, pilih repo ini.
3. Permissions, Repository permissions, **Contents: Read and write**.
4. Salin kuncinya ke kolom **Kunci GitHub**, lalu tekan **Tes koneksi**.

Kunci hanya tersimpan di browser perangkat yang dipakai. Siapa pun bisa membuka `admin.html`,
tapi tanpa kunci tidak ada yang bisa mengubah situs.

Isian bawaan: repo `azziham/WebsiteTesting`, branch `main`, folder `dapur-ziham`.
Ubah kalau situsnya dipindah.

## Menayangkan situs

**GitHub Pages (paling cocok dengan tombol Terbitkan):**
Settings, Pages, Source: *Deploy from a branch*, pilih `main` dan folder `/ (root)`.
Situs tampil di `https://azziham.github.io/WebsiteTesting/dapur-ziham/`.

**Hosting lain (misalnya Hostinger):** upload isi folder ini. Untuk mengganti menu, pakai
**Unduh menu.json** di tab Koneksi terbit, lalu timpa `data/menu.json` di hosting.

Sebelum tayang di domain sendiri, isi `og:url` dan `og:image` di `index.html`
(cari komentar `DEPLOY STEP`) dengan alamat lengkap situs.

## Yang perlu diganti sebelum tayang

- Nomor WhatsApp, alamat gerobak, jam buka, dan Instagram: tab **Info toko** di admin.
- Harga menu (sekarang masih contoh): Rp 5.000, Rp 15.000, Rp 8.000.
- Gambar menu masih ilustrasi. Ganti dengan foto asli lewat admin kapan saja.
