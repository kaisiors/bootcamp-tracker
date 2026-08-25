"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  Mail,
  ShieldCheck,
  UserPlus,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FullPageLoadingOverlay } from "./full-page-loading-overlay";
import {
  createParticipant,
  getAppState,
  loginAdmin,
  loginParticipant,
} from "../lib/api-client.js";
import { saveSelectedBootcampId } from "../lib/bootcamp-store.js";
import { bootcamps } from "../lib/mock-data.js";
import { saveSelectedParticipantId } from "../lib/participant-store.js";

type BootcampRecord = (typeof bootcamps)[number];

export function ParticipantLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [availableBootcamps, setAvailableBootcamps] = useState(bootcamps);
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeBootcamps = useMemo(
    () => availableBootcamps.filter((bootcamp) => bootcamp.status === "active"),
    [availableBootcamps],
  );
  const [selectedBootcampId, setSelectedBootcampId] = useState("");

  useEffect(() => {
    let isMounted = true;

    getAppState()
      .then((state) => {
        if (!isMounted) {
          return;
        }

        const nextActiveBootcamps = state.bootcamps.filter(
          (bootcamp: BootcampRecord) => bootcamp.status === "active",
        );

        setAvailableBootcamps(state.bootcamps);
        setSelectedBootcampId((current) =>
          nextActiveBootcamps.some((bootcamp: BootcampRecord) => bootcamp.id === current)
            ? current
            : "",
        );
      })
      .catch((error) => {
        if (isMounted) {
          setLoginError(
            error instanceof Error ? error.message : "Data bootcamp gagal dimuat.",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await loginParticipant({
        bootcampId: selectedBootcampId,
        email,
      });

      setLoginError("");
      saveSelectedBootcampId(result.bootcamp.id);
      saveSelectedParticipantId(result.participant.id);
      router.push(
        `/dashboard?bootcampId=${encodeURIComponent(result.bootcamp.id)}`,
      );
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Login peserta gagal diproses.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <FullPageLoadingOverlay
        isVisible={isSubmitting}
        message="Memproses login peserta..."
      />
      <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
        <WalletCards size={25} strokeWidth={1.8} />
      </div>
      <div className="mt-8">
        <p className="text-sm font-semibold text-accent-foreground">
          Login peserta
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[0] md:text-4xl">
          Masuk dengan email terdaftar.
        </h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-6 text-muted-foreground">
          Pilih bootcamp yang diberikan admin, lalu sistem akan membuka ruang
          pengeluaran untuk batch itu.
        </p>
      </div>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          Email peserta
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
            <Mail size={18} strokeWidth={1.8} />
            <input
              className="w-full border-0 bg-transparent text-sm outline-none"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="bima.prasetya@mail.test"
              type="email"
              value={email}
            />
          </div>
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Bootcamp
          <div className="flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring">
            <CalendarClock size={18} strokeWidth={1.8} />
            <select
              className="w-full border-0 bg-transparent text-sm outline-none"
              onChange={(event) => setSelectedBootcampId(event.target.value)}
              required
              value={selectedBootcampId}
            >
              <option disabled value="">
                Pilih bootcamp peserta
              </option>
              {activeBootcamps.map((bootcamp) => (
                <option key={bootcamp.id} value={bootcamp.id}>
                  {bootcamp.name}
                </option>
              ))}
            </select>
          </div>
        </label>
        {loginError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {loginError}
          </p>
        ) : null}
        <button
          className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2")}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Memeriksa..." : "Masuk ke dashboard peserta"}
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      </form>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 gap-2")}
          href="/register"
        >
          <UserPlus size={17} strokeWidth={1.8} />
          Daftar peserta baru
        </Link>
        <Link
          className={cn(buttonVariants({ variant: "outline", size: "lg" }), "h-10 gap-2")}
          href="/admin"
        >
          <ShieldCheck size={17} strokeWidth={1.8} />
          Login admin
        </Link>
      </div>
    </AuthShell>
  );
}

export function ParticipantRegistrationPage() {
  const router = useRouter();
  const [availableBootcamps, setAvailableBootcamps] = useState(bootcamps);
  const [formMessage, setFormMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const activeBootcamps = useMemo(
    () => availableBootcamps.filter((bootcamp) => bootcamp.status === "active"),
    [availableBootcamps],
  );
  const [selectedBootcampId, setSelectedBootcampId] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolderName, setAccountHolderName] = useState("");

  useEffect(() => {
    let isMounted = true;

    getAppState()
      .then((state) => {
        if (!isMounted) {
          return;
        }

        const nextActiveBootcamps = state.bootcamps.filter(
          (bootcamp: BootcampRecord) => bootcamp.status === "active",
        );

        setAvailableBootcamps(state.bootcamps);
        setSelectedBootcampId((current) =>
          nextActiveBootcamps.some((bootcamp: BootcampRecord) => bootcamp.id === current)
            ? current
            : "",
        );
      })
      .catch((error) => {
        if (isMounted) {
          setFormMessage(
            error instanceof Error ? error.message : "Data bootcamp gagal dimuat.",
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await createParticipant({
        name,
        email,
        phone,
        bootcampId: selectedBootcampId,
        bankName,
        accountNumber,
        accountHolderName,
      });

      setFormMessage("");
      saveSelectedParticipantId(result.participant.id);
      saveSelectedBootcampId(selectedBootcampId);
      router.push(`/dashboard?bootcampId=${encodeURIComponent(selectedBootcampId)}`);
    } catch (error) {
      setFormMessage(
        error instanceof Error ? error.message : "Pendaftaran gagal diproses.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <FullPageLoadingOverlay
        isVisible={isSubmitting}
        message="Menyimpan pendaftaran peserta..."
      />
      <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
        <UserPlus size={25} strokeWidth={1.8} />
      </div>
      <div className="mt-8">
        <p className="text-sm font-semibold text-accent-foreground">
          Daftar peserta
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[0] md:text-4xl">
          Pilih bootcamp dan buat rekening.
        </h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-6 text-muted-foreground">
          Peserta baru wajib memilih bootcamp aktif dan mengisi rekening sebelum
          masuk dashboard.
        </p>
      </div>

      <form className="mt-8 grid gap-5" onSubmit={handleSubmit}>
        <section className="grid gap-4">
          <label className="grid gap-2 text-sm font-medium">
            Bootcamp
            <select
              className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              onChange={(event) => setSelectedBootcampId(event.target.value)}
              required
              value={selectedBootcampId}
            >
              <option disabled value="">
                Pilih bootcamp yang diikuti
              </option>
              {activeBootcamps.map((bootcamp) => (
                <option key={bootcamp.id} value={bootcamp.id}>
                  {bootcamp.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Nama peserta
            <input
              className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              onChange={(event) => setName(event.target.value)}
              placeholder="Peserta Baru"
              required
              value={name}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Email peserta
            <input
              className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="peserta.baru@mail.test"
              required
              type="email"
              value={email}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            No. HP
            <input
              className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
              onChange={(event) => setPhone(event.target.value)}
              placeholder="0812-0000-0000"
              required
              value={phone}
            />
          </label>
        </section>

        <section className="rounded-lg border border-border bg-muted p-4">
          <h2 className="text-sm font-semibold">Rekening pembayaran</h2>
          <div className="mt-4 grid gap-4">
            <label className="grid gap-2 text-sm font-medium">
              Bank
              <input
                className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                onChange={(event) => setBankName(event.target.value)}
                placeholder="BCA"
                required
                value={bankName}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nomor rekening
              <input
                className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                inputMode="numeric"
                onChange={(event) => setAccountNumber(event.target.value)}
                placeholder="1234567890"
                required
                value={accountNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nama pemilik rekening
              <input
                className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
                onChange={(event) => setAccountHolderName(event.target.value)}
                placeholder="Peserta Baru"
                required
                value={accountHolderName}
              />
            </label>
          </div>
        </section>

        {formMessage ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {formMessage}
          </p>
        ) : null}

        <button
          className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2")}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Mendaftarkan..." : "Daftar dan masuk dashboard"}
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      </form>
    </AuthShell>
  );
}

export function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      await loginAdmin({ email, password });
      setLoginError("");
      router.push("/admin/dashboard");
    } catch (error) {
      setLoginError(
        error instanceof Error ? error.message : "Login admin gagal diproses.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <FullPageLoadingOverlay
        isVisible={isSubmitting}
        message="Memproses login admin..."
      />
      <div className="grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
        <ShieldCheck size={25} strokeWidth={1.8} />
      </div>
      <div className="mt-8">
        <p className="text-sm font-semibold text-accent-foreground">Admin</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[0] md:text-4xl">
          Login admin.
        </h1>
        <p className="mt-3 max-w-[56ch] text-sm leading-6 text-muted-foreground">
          Halaman ini khusus admin. Peserta tetap masuk dari halaman depan.
        </p>
      </div>

      <form className="mt-8 grid gap-4" onSubmit={handleSubmit}>
        <label className="grid gap-2 text-sm font-medium">
          Email admin
          <input
            className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="admin@bootcamp.test"
            type="email"
            value={email}
          />
        </label>
        <label className="grid gap-2 text-sm font-medium">
          Password
          <input
            className="focus-ring rounded-md border border-input bg-background px-3 py-2.5 text-sm"
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password admin"
            type="password"
            value={password}
          />
        </label>
        {loginError ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive">
            {loginError}
          </p>
        ) : null}
        <button
          className={cn(buttonVariants({ size: "lg" }), "h-11 gap-2")}
          disabled={isSubmitting}
          type="submit"
        >
          {isSubmitting ? "Memeriksa..." : "Masuk ke panel admin"}
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="grid min-h-[100dvh] place-items-center px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <section className="flex w-full max-w-[560px] items-center py-10">
        <div className="w-full rounded-lg border border-border bg-card p-6 text-card-foreground shadow-lg md:p-8">
          {children}
        </div>
      </section>
    </main>
  );
}
