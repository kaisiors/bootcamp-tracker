import { splitExpenseEvenly } from "./finance.js";

export const bootcamps = [
  {
    id: "bc-next-08",
    name: "Next.js Intensif Batch 08",
    location: "Bandung",
    startDate: "2026-08-12",
    endDate: "2026-08-18",
    paymentDeadline: "2026-08-30T23:59:00+07:00",
    status: "active",
  },
  {
    id: "bc-laravel-07",
    name: "Laravel Praktis Batch 07",
    location: "Jakarta",
    startDate: "2026-07-02",
    endDate: "2026-07-08",
    paymentDeadline: "2026-07-14T23:59:00+07:00",
    status: "completed",
  },
  {
    id: "bc-ui-09",
    name: "UI Engineering Batch 09",
    location: "Yogyakarta",
    startDate: "2026-09-04",
    endDate: "2026-09-10",
    paymentDeadline: "2026-09-22T23:59:00+07:00",
    status: "active",
  },
];

export const [bootcamp, expiredBootcamp] = bootcamps;

export const participants = [
  {
    id: "bima",
    name: "Bima Prasetya",
    email: "bima.prasetya@mail.test",
    phone: "0812-4901-7712",
    bootcampIds: ["bc-next-08"],
    bank: {
      bankName: "BCA",
      accountNumber: "7790123488",
      accountHolderName: "Bima Prasetya",
    },
  },
  {
    id: "nala",
    name: "Nala Kusuma",
    email: "nala.kusuma@mail.test",
    phone: "0813-9044-1108",
    bootcampIds: ["bc-next-08", "bc-ui-09"],
    bank: {
      bankName: "Mandiri",
      accountNumber: "1320099912",
      accountHolderName: "Nala Kusuma",
    },
  },
  {
    id: "raka",
    name: "Raka Wibisana",
    email: "raka.wibisana@mail.test",
    phone: "0858-2844-9031",
    bootcampIds: ["bc-next-08", "bc-laravel-07"],
    bank: {
      bankName: "BRI",
      accountNumber: "501003881994",
      accountHolderName: "Raka Wibisana",
    },
  },
  {
    id: "sari",
    name: "Sari Maharani",
    email: "sari.maharani@mail.test",
    phone: "0821-7710-2381",
    bootcampIds: ["bc-next-08"],
    bank: {
      bankName: "BNI",
      accountNumber: "0901843377",
      accountHolderName: "Sari Maharani",
    },
  },
  {
    id: "dewi",
    name: "Dewi Anggraini",
    email: "dewi.anggraini@mail.test",
    phone: "0877-3001-8420",
    bootcampIds: ["bc-next-08", "bc-ui-09"],
    bank: {
      bankName: "BSI",
      accountNumber: "7120088930",
      accountHolderName: "Dewi Anggraini",
    },
  },
  {
    id: "ghoni",
    name: "Ghoni Ramadhan",
    email: "ghoni.ramadhan@mail.test",
    phone: "0812-8810-4421",
    bootcampIds: ["bc-laravel-07"],
    bank: {
      bankName: "CIMB Niaga",
      accountNumber: "8001347712",
      accountHolderName: "Ghoni Ramadhan",
    },
  },
  {
    id: "maya",
    name: "Maya Kartika",
    email: "maya.kartika@mail.test",
    phone: "0857-4420-9011",
    bootcampIds: ["bc-ui-09"],
    bank: {
      bankName: "Permata",
      accountNumber: "2237710098",
      accountHolderName: "Maya Kartika",
    },
  },
  {
    id: "ardi",
    name: "Ardi Saputra",
    email: "ardi.saputra@mail.test",
    phone: "0822-7210-5532",
    bootcampIds: ["bc-ui-09"],
    bank: {
      bankName: "BCA",
      accountNumber: "7799011201",
      accountHolderName: "Ardi Saputra",
    },
  },
];

export const usersById = Object.fromEntries(
  participants.map((participant) => [participant.id, participant]),
);

export const expenses = [
  {
    id: "exp-001",
    title: "Sewa ruang diskusi malam",
    amount: 450000,
    bootcampId: "bc-next-08",
    expenseDate: "2026-08-13",
    payerId: "nala",
    participants: splitExpenseEvenly(450000, [
      "bima",
      "nala",
      "raka",
      "sari",
      "dewi",
    ]),
  },
  {
    id: "exp-002",
    title: "Konsumsi mentor dan peserta",
    amount: 620000,
    bootcampId: "bc-next-08",
    expenseDate: "2026-08-14",
    payerId: "bima",
    participants: splitExpenseEvenly(620000, ["bima", "nala", "raka", "sari"]),
  },
  {
    id: "exp-003",
    title: "Transport kunjungan industri",
    amount: 300000,
    bootcampId: "bc-next-08",
    expenseDate: "2026-08-16",
    payerId: "raka",
    participants: splitExpenseEvenly(300000, ["nala", "sari", "dewi"]),
  },
  {
    id: "exp-004",
    title: "Cetak modul latihan",
    amount: 185000,
    bootcampId: "bc-next-08",
    expenseDate: "2026-08-17",
    payerId: "sari",
    participants: splitExpenseEvenly(185000, ["bima", "raka", "sari", "dewi"]),
  },
  {
    id: "exp-005",
    title: "Server VPS latihan Laravel",
    amount: 360000,
    bootcampId: "bc-laravel-07",
    expenseDate: "2026-07-04",
    payerId: "ghoni",
    participants: splitExpenseEvenly(360000, ["raka", "ghoni"]),
  },
  {
    id: "exp-006",
    title: "Template design review",
    amount: 240000,
    bootcampId: "bc-ui-09",
    expenseDate: "2026-09-05",
    payerId: "maya",
    participants: splitExpenseEvenly(240000, ["nala", "dewi", "maya", "ardi"]),
  },
];

export const notifications = [
  {
    id: "notif-1",
    bootcampId: "bc-next-08",
    type: "reminder",
    title: "Cek pengeluaran hari ini",
    message: "Pastikan biaya konsumsi dan transport sudah dicatat sebelum malam.",
    sentAt: "2026-08-17 18:30",
    isRead: false,
  },
  {
    id: "notif-2",
    bootcampId: "bc-next-08",
    type: "deadline",
    title: "Tenggat pembayaran mendekat",
    message: "Pembayaran batch ini ditutup pada 30 Agustus 2026 pukul 23:59.",
    sentAt: "2026-08-24 09:00",
    isRead: true,
  },
  {
    id: "notif-3",
    bootcampId: "bc-next-08",
    type: "account",
    title: "Rekening aktif terkonfirmasi",
    message: "Rekening BCA atas nama Bima Prasetya tampil di daftar peserta.",
    sentAt: "2026-08-12 07:42",
    isRead: true,
  },
  {
    id: "notif-4",
    bootcampId: "bc-ui-09",
    type: "deadline",
    title: "Persiapan batch UI",
    message: "Admin sudah membuka pengajuan rekening untuk UI Engineering Batch 09.",
    sentAt: "2026-08-25 10:15",
    isRead: false,
  },
];
