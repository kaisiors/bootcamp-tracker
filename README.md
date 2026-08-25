# Bootcamp Spending Tracker

Frontend dan backend Next.js untuk mencatat pengeluaran bootcamp, peserta, rekening, dan settlement.

## Kebutuhan

- Node.js
- PostgreSQL lokal

## Setup Lokal

1. Install dependency:

```bash
npm install
```

2. Buat database PostgreSQL:

```sql
CREATE DATABASE bootcamp;
```

3. Salin `.env.example` menjadi `.env.local`, lalu sesuaikan koneksi database jika perlu.

```bash
cp .env.example .env.local
```

4. Jalankan aplikasi:

```bash
npm run dev
```

App akan membuat tabel otomatis di schema `bootcamp_tracker` saat API pertama kali dipanggil.

## Login Demo

Peserta:

- URL: `http://127.0.0.1:3000/`
- Email: `bima.prasetya@mail.test`
- Bootcamp: `Next.js Cohort 08`

Admin:

- URL: `http://127.0.0.1:3000/admin`
- Email: `admin@bootcamp.test`
- Password: `password`

## Mengubah Admin

Data admin disimpan di tabel `bootcamp_tracker.users`. Password disimpan sebagai
hash `scrypt`, bukan plaintext.

Untuk membuat SQL penggantian admin:

```bash
node scripts/hash-admin-password.mjs admin-baru@example.com password-baru
```

Lalu jalankan SQL yang keluar dari command tersebut di PostgreSQL atau Supabase
SQL Editor. Bentuk SQL-nya seperti ini:

```sql
update bootcamp_tracker.users
set email = 'admin-baru@example.com',
    password_hash = 'scrypt$...'
where id = 'admin';
```

## Verifikasi

```bash
npm run lint
npm test
npm run build
```
