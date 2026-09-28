# AVINDHA Dashboard — Vercel + Postgres

Desain/UI AVINDHA (`public/index.html` + `public/app.js`) yang sudah Anda buat,
dilengkapi backend sungguhan: login per user, data tersimpan di database
Postgres, dan bisa dibuka dari mana saja (termasuk HP) lewat domain Vercel.

```
avindha/
├── public/              UI Anda (index.html, app.js) — disajikan statis oleh Vercel
├── api/                 Backend (Vercel Serverless Functions, Node.js)
│   ├── auth/            login, logout, me
│   └── testcases/       daftar, tambah, ubah, hapus, evidence, hapus-per-modul
├── lib/                 koneksi DB, sesi login, validasi
├── scripts/             setup-db.js, create-user.js
├── vercel.json          konfigurasi Vercel (region Singapura, header keamanan)
└── .env.example         daftar environment variable
```

## Deploy (sekali saja)

Butuh Node.js 20+ dan Vercel CLI (`npm i -g vercel`).

```bash
cd avindha
npm install

# 1. Hubungkan folder ini ke project Vercel Anda
vercel
```

**2. Buat database.** Di dashboard Vercel → project Anda → tab **Storage**
(atau Marketplace) → pilih **Neon (Postgres)** → *Create* → hubungkan ke project.
Pilih region **Singapore** agar dekat dengan fungsi (`sin1`) dan pengguna di Indonesia.
Variabel `DATABASE_URL` akan terisi otomatis di project.

**3. Buat kunci rahasia sesi.** Project → *Settings → Environment Variables* →
tambah `SESSION_SECRET` (untuk Production, Preview, dan Development). Buat nilainya:

```bash
openssl rand -base64 48
```

Aplikasi **menolak berjalan** bila `SESSION_SECRET` kosong atau < 32 karakter.

**4. Siapkan tabel & akun pertama** (dari komputer Anda):

```bash
vercel env pull .env.local        # ambil DATABASE_URL & SESSION_SECRET
npm run setup-db                  # membuat tabel (aman dijalankan berulang)

# password akan ditanyakan (tidak tampil di layar)
npm run create-user -- admin "Admin Assurance" supervisor "IT"
npm run create-user -- budi  "Budi QA"        tester     "Customer Care"
```

Lupa password / ganti role → jalankan perintah yang sama dengan tambahan `--reset`.

**5. Publish:**

```bash
vercel --prod
```

Domain gratis dari Vercel langsung aktif (HTTPS otomatis). Domain sendiri:
*Settings → Domains*.

Coba di komputer sebelum publish: `vercel dev` lalu buka http://localhost:3000.

## Hak akses

| | Tester | Supervisor |
|---|---|---|
| Lihat semua data | ✔ | ✔ |
| Tambah test case | ✔ | ✔ |
| Ubah / hapus data | hanya buatan sendiri | semua |
| "Clear All Data" (hapus 1 modul) | ✘ (tombol disembunyikan + ditolak server) | ✔ |

Akun dibuat lewat `npm run create-user` (tidak ada pendaftaran mandiri).
Login dikunci 15 menit setelah 5 kali password salah.
Nama departemen tiap user tersimpan bersama setiap test case (belum ditampilkan di UI).

## Perbedaan dari file aslinya

- **Login palsu diganti login server.** Sebelumnya `admin/admin123` tertanam di JavaScript
  sehingga siapa pun bisa melihatnya lewat "View Source".
- **Isian user kini di-escape** sebelum ditampilkan. Sebelumnya teks seperti
  `<img onerror=...>` pada kolom Issue/Propose akan dieksekusi di browser semua orang
  yang membuka dashboard.
- **Data per modul.** IVR / GOL Indihome / GOL Mobile kini benar-benar terpisah
  (sebelumnya semua modul memuat data yang sama).
- **Evidence dimuat saat diklik**, tidak ikut dalam daftar, supaya daftar tetap ringan.
- Teks "MySQL" diganti "PostgreSQL".

## Batasan yang perlu diketahui

- **Ukuran evidence maks ±2,5 MB** setelah kompresi (batas request Vercel 4,5 MB).
  Video IVR yang panjang akan ditolak dengan pesan jelas — pakai rekaman yang lebih pendek.
- **Backup JSON tidak menyertakan isi evidence** (hanya data isian).
- Paket **Hobby** Vercel resminya untuk pemakaian non-komersial; untuk penggunaan
  resmi perusahaan, periksa apakah perlu paket Pro.
- Perubahan role atau penghapusan akun berlaku ke halaman yang sedang dibuka paling lambat
  saat sesi 12 jam habis atau saat halaman dimuat ulang.

## Bila ada masalah

- Halaman login muncul terus / error 500 → cek `vercel logs`; biasanya `SESSION_SECRET`
  atau `DATABASE_URL` belum di-set untuk environment yang dipakai.
- Setelah menambah environment variable, lakukan deploy ulang (`vercel --prod`).
