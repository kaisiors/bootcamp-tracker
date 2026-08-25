"use client";

import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Bell,
  CalendarClock,
  Check,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  LayoutDashboard,
  LoaderCircle,
  LockKeyhole,
  LogIn,
  LogOut,
  Mail,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  Users,
  WalletCards,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { FullPageLoadingOverlay } from "./full-page-loading-overlay";
import {
  loadSelectedBootcampId,
  saveSelectedBootcampId,
} from "../lib/bootcamp-store.js";
import {
  loadSelectedParticipantId,
  saveSelectedParticipantId,
} from "../lib/participant-store.js";
import {
  createBootcamp as requestCreateBootcamp,
  createExpense as requestCreateExpense,
  createParticipant as requestCreateParticipant,
  deleteBootcamp as requestDeleteBootcamp,
  deleteExpense as requestDeleteExpense,
  deleteParticipant as requestDeleteParticipant,
  getAppState as fetchAppState,
  logout as requestLogout,
  updateBootcamp as requestUpdateBootcamp,
} from "../lib/api-client.js";
import {
  bootcamps,
  expenses,
  notifications,
  participants,
} from "../lib/mock-data.js";
import {
  calculateParticipantSummary,
  calculateSettlementRows,
  formatRupiah,
  splitExpenseEvenly,
} from "../lib/finance.js";

type View = "overview" | "transactions" | "add" | "members" | "notifications";

const currentUserId = "bima";

type BootcampRecord = (typeof bootcamps)[number];
type ExpenseRecord = (typeof expenses)[number];
type NotificationRecord = (typeof notifications)[number];
type ParticipantRecord = (typeof participants)[number];
type AdminView =
  | "summary"
  | "bootcamps"
  | "participants"
  | "bankAccounts"
  | "expenses";
type DeleteConfirmation = {
  kind: "bootcamp" | "participant" | "expense";
  id: string;
  title: string;
  description: string;
  itemName: string;
  confirmLabel: string;
};

const navItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "transactions", label: "Rekap", icon: ReceiptText },
  { id: "add", label: "Tambah", icon: Plus },
  { id: "members", label: "Peserta", icon: Users },
  { id: "notifications", label: "Notifikasi", icon: Bell },
] satisfies Array<{ id: View; label: string; icon: typeof LayoutDashboard }>;

const adminNavItems = [
  { id: "summary", label: "Ringkasan", icon: LayoutDashboard },
  { id: "bootcamps", label: "Bootcamp", icon: ClipboardList },
  { id: "participants", label: "Peserta", icon: Users },
  { id: "bankAccounts", label: "Rekening", icon: CreditCard },
  { id: "expenses", label: "Transaksi", icon: ReceiptText },
] satisfies Array<{ id: AdminView; label: string; icon: typeof LayoutDashboard }>;

export function BootcampTrackerApp() {
  const [activeView, setActiveView] = useState<View>("overview");
  const [managedBootcamps, setManagedBootcamps] = useState<BootcampRecord[]>([]);
  const [allParticipants, setAllParticipants] = useState<ParticipantRecord[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [allNotifications, setAllNotifications] = useState<NotificationRecord[]>([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedBootcampId, setSelectedBootcampId] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseFormMessage, setExpenseFormMessage] = useState("");
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(true);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);

  const participantsById = useMemo(
    () =>
      Object.fromEntries(
        allParticipants.map((participant) => [participant.id, participant]),
      ),
    [allParticipants],
  );
  const currentParticipant =
    participantsById[selectedParticipantId] ??
    participantsById[currentUserId] ??
    allParticipants[0] ??
    null;

  useEffect(() => {
    let isMounted = true;

    fetchAppState()
      .then((state) => {
        if (!isMounted) {
          return;
        }

        const storedParticipantId = loadSelectedParticipantId();
        const nextParticipant =
          state.participants.find(
            (participant: ParticipantRecord) => participant.id === storedParticipantId,
          ) ??
          state.participants.find(
            (participant: ParticipantRecord) => participant.id === currentUserId,
          ) ??
          state.participants[0];
        const params = new URLSearchParams(window.location.search);
        const requestedBootcampId = params.get("bootcampId");
        const storedBootcampId = loadSelectedBootcampId();
        const nextBootcampId =
          requestedBootcampId ??
          storedBootcampId ??
          nextParticipant?.bootcampIds[0] ??
          "";
        const participantBootcampIds = new Set(nextParticipant?.bootcampIds ?? []);

        setManagedBootcamps(state.bootcamps);
        setAllParticipants(state.participants);
        setAllExpenses(state.expenses);
        setAllNotifications(state.notifications);

        if (nextParticipant) {
          setSelectedParticipantId(nextParticipant.id);
          saveSelectedParticipantId(nextParticipant.id);
        }

        if (
          state.bootcamps.some(
            (item: BootcampRecord) =>
              item.id === nextBootcampId && participantBootcampIds.has(item.id),
          )
        ) {
          setSelectedBootcampId(nextBootcampId);
          saveSelectedBootcampId(nextBootcampId);
        } else if (nextParticipant?.bootcampIds[0]) {
          setSelectedBootcampId(nextParticipant.bootcampIds[0]);
          saveSelectedBootcampId(nextParticipant.bootcampIds[0]);
        }
      })
      .catch((error) => {
        if (isMounted) {
          setExpenseFormMessage(
            error instanceof Error ? error.message : "Data dashboard gagal dimuat.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingDashboardData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const participantBootcamp = currentParticipant
    ? managedBootcamps.find(
        (item) =>
          item.id === selectedBootcampId &&
          currentParticipant.bootcampIds.includes(item.id),
      ) ??
      managedBootcamps.find((item) =>
        currentParticipant.bootcampIds.includes(item.id),
      ) ??
      null
    : null;

  const bootcampParticipants = useMemo(
    () => {
      if (!currentParticipant || !participantBootcamp) {
        return [];
      }

      const visibleParticipants = allParticipants.filter((participant) =>
        participant.bootcampIds.includes(participantBootcamp.id),
      );

      return visibleParticipants.some(
        (participant) => participant.id === currentParticipant.id,
      )
        ? visibleParticipants
        : [currentParticipant, ...visibleParticipants];
    },
    [allParticipants, currentParticipant, participantBootcamp],
  );

  const bootcampExpenses = useMemo(
    () => {
      if (!participantBootcamp) {
        return [];
      }

      return allExpenses.filter(
        (expense) => expense.bootcampId === participantBootcamp.id,
      );
    },
    [allExpenses, participantBootcamp],
  );

  const bootcampNotifications = useMemo(
    () => {
      if (!participantBootcamp) {
        return [];
      }

      return allNotifications.filter(
        (notification) => notification.bootcampId === participantBootcamp.id,
      );
    },
    [allNotifications, participantBootcamp],
  );

  const summary = useMemo(
    () =>
      currentParticipant
        ? calculateParticipantSummary(currentParticipant.id, bootcampExpenses)
        : {
            totalPaid: 0,
            totalOwed: 0,
            totalReceivable: 0,
            netBalance: 0,
          },
    [bootcampExpenses, currentParticipant],
  );

  const settlementRows = useMemo(
    () => {
      if (!currentParticipant) {
        return [];
      }

      return calculateSettlementRows(bootcampExpenses, participantsById).filter(
        (row) =>
          row.debtorId === currentParticipant.id ||
          row.payerId === currentParticipant.id,
      );
    },
    [bootcampExpenses, currentParticipant, participantsById],
  );

  const filteredExpenses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return bootcampExpenses;
    }

    return bootcampExpenses.filter((expense) => {
      const payerName = participantsById[expense.payerId]?.name ?? "";

      return [expense.title, expense.expenseDate, String(expense.amount), payerName]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [bootcampExpenses, participantsById, query]);

  const visibleCheckedIds = useMemo(() => {
    const visibleParticipantIds = new Set(
      bootcampParticipants.map((participant) => participant.id),
    );
    return checkedIds.filter((participantId) =>
      visibleParticipantIds.has(participantId),
    );
  }, [bootcampParticipants, checkedIds]);

  const splitPreview = useMemo(() => {
    const numericAmount = Number(amount);

    if (!Number.isInteger(numericAmount) || numericAmount <= 0) {
      return [];
    }

    return splitExpenseEvenly(numericAmount, visibleCheckedIds);
  }, [amount, visibleCheckedIds]);
  const isDashboardBlockingProcess = isSavingExpense;

  if (isLoadingDashboardData) {
    return (
      <DashboardDataShimmer
        as="main"
        label="Memuat data dashboard peserta..."
      />
    );
  }

  if (!currentParticipant || !participantBootcamp) {
    return (
      <main className="min-h-[100dvh] px-4 py-4 text-foreground sm:px-6 lg:px-8">
        <section className="mx-auto max-w-[720px] rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <p className="text-sm font-semibold text-destructive">
            Data dashboard belum tersedia.
          </p>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {expenseFormMessage ||
              "Peserta ini belum terhubung ke bootcamp aktif. Silakan hubungi admin."}
          </p>
        </section>
      </main>
    );
  }

  function toggleParticipant(participantId: string) {
    setCheckedIds((selected) =>
      selected.includes(participantId)
        ? selected.filter((id) => id !== participantId)
        : [...selected, participantId],
    );
  }

  async function handleSaveExpense() {
    if (isSavingExpense) {
      return;
    }

    if (visibleCheckedIds.length === 0) {
      setExpenseFormMessage("Pilih minimal satu peserta yang menanggung.");
      return;
    }

    if (!currentParticipant || !participantBootcamp) {
      setExpenseFormMessage("Data peserta atau bootcamp belum tersedia.");
      return;
    }

    setIsSavingExpense(true);

    try {
      const result = await requestCreateExpense({
        title,
        amount,
        bootcampId: participantBootcamp.id,
        expenseDate,
        payerId: currentParticipant.id,
        participantIds: visibleCheckedIds,
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      setAllNotifications(result.state.notifications);
      setTitle("");
      setAmount("");
      setExpenseDate("");
      setCheckedIds([]);
      setExpenseFormMessage("Pengeluaran tersimpan dan langsung masuk rekap.");
      setActiveView("transactions");
    } catch (error) {
      setExpenseFormMessage(
        error instanceof Error ? error.message : "Pengeluaran belum bisa disimpan.",
      );
    } finally {
      setIsSavingExpense(false);
    }
  }

  return (
    <main className="min-h-[100dvh] px-4 py-4 text-foreground sm:px-6 lg:px-8">
      <FullPageLoadingOverlay
        isVisible={isDashboardBlockingProcess}
        message="Menyimpan pengeluaran..."
      />
      <div className="mx-auto grid max-w-[1440px] gap-4 lg:grid-cols-[280px_1fr]">
        <aside className="rounded-lg border border-border bg-card p-3 shadow-[0_20px_70px_rgba(23,32,26,0.08)] lg:sticky lg:top-4 lg:h-[calc(100dvh-2rem)]">
          <div className="flex items-center gap-3 border-b border-border px-2 pb-4">
            <div className="grid size-10 place-items-center rounded-md bg-primary text-primary-foreground">
              <WalletCards size={21} strokeWidth={1.8} />
            </div>
            <div>
              <p className="text-sm font-semibold">Bootcamp Spending</p>
              <p className="text-xs text-muted-foreground">Batch finance tracker</p>
            </div>
          </div>

          <nav className="mt-4 grid gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;

              return (
                <button
                  className={[
                    "focus-ring flex items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition active:translate-y-px",
                    isActive
                      ? "bg-accent font-semibold text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  ].join(" ")}
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  type="button"
                >
                  <span className="flex items-center gap-3">
                    <Icon size={18} strokeWidth={1.8} />
                    {item.label}
                  </span>
                  {isActive ? <ChevronRight size={16} strokeWidth={1.8} /> : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-5 rounded-lg bg-muted p-4">
            <p className="text-sm font-semibold">{participantBootcamp.name}</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {participantBootcamp.location}, {formatDate(participantBootcamp.startDate)}{" "}
              sampai {formatDate(participantBootcamp.endDate)}
            </p>
            <div className="mt-4 flex items-start gap-2 rounded-md border border-border bg-card/70 p-3">
              <CalendarClock className="mt-0.5 text-accent-foreground" size={17} />
              <div>
                <p className="text-xs font-semibold text-accent-foreground">
                  Payment deadline
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDeadline(participantBootcamp.paymentDeadline)}
                </p>
              </div>
            </div>
          </div>
        </aside>

        <section className="grid gap-4">
          <Header
            activeView={activeView}
            bootcampName={participantBootcamp.name}
            participant={currentParticipant}
          />

          {activeView === "overview" ? (
            <OverviewPanel
              activeBootcamp={participantBootcamp}
              notifications={bootcampNotifications}
              participant={currentParticipant}
              settlementRows={settlementRows}
              summary={summary}
            />
          ) : null}

          {activeView === "transactions" ? (
            <TransactionsPanel
              filteredExpenses={filteredExpenses}
              participantsById={participantsById}
              query={query}
              setQuery={setQuery}
            />
          ) : null}

          {activeView === "add" ? (
            <AddExpensePanel
              amount={amount}
              checkedIds={visibleCheckedIds}
              expenseDate={expenseDate}
              activeParticipant={currentParticipant}
              participantsById={participantsById}
              participants={bootcampParticipants}
              expenseFormMessage={expenseFormMessage}
              isSavingExpense={isSavingExpense}
              onSaveExpense={handleSaveExpense}
              setAmount={setAmount}
              setExpenseDate={setExpenseDate}
              setTitle={setTitle}
              splitPreview={splitPreview}
              title={title}
              toggleParticipant={toggleParticipant}
            />
          ) : null}

          {activeView === "members" ? (
            <MembersPanel participants={bootcampParticipants} />
          ) : null}

          {activeView === "notifications" ? (
            <NotificationsPanel notifications={bootcampNotifications} />
          ) : null}

        </section>
      </div>
    </main>
  );
}

function DashboardDataShimmer({
  as = "section",
  label,
}: {
  as?: "main" | "section";
  label: string;
}) {
  const content = (
    <div
      aria-busy="true"
      aria-label={label}
      className="mx-auto grid w-full max-w-[1440px] gap-4 lg:grid-cols-[280px_1fr]"
      role="status"
    >
      <aside className="rounded-lg border border-border bg-card p-3 shadow-[0_20px_70px_rgba(23,32,26,0.08)] lg:h-[calc(100dvh-2rem)]">
        <div className="flex items-center gap-3 border-b border-border px-2 pb-4">
          <ShimmerBlock className="size-10" />
          <div className="grid flex-1 gap-2">
            <ShimmerBlock className="h-4 w-36" />
            <ShimmerBlock className="h-3 w-28" />
          </div>
        </div>
        <div className="mt-4 grid gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <ShimmerBlock className="h-10 w-full" key={index} />
          ))}
        </div>
        <div className="mt-5 grid gap-3 rounded-lg bg-muted p-4">
          <ShimmerBlock className="h-4 w-3/4" />
          <ShimmerBlock className="h-3 w-full" />
          <ShimmerBlock className="h-3 w-5/6" />
          <ShimmerBlock className="h-16 w-full" />
        </div>
      </aside>

      <section className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <ShimmerBlock className="h-4 w-40" />
          <ShimmerBlock className="mt-3 h-9 w-64 max-w-full" />
          <ShimmerBlock className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]"
              key={index}
            >
              <ShimmerBlock className="size-10" />
              <ShimmerBlock className="mt-5 h-3 w-24" />
              <ShimmerBlock className="mt-3 h-7 w-32" />
            </div>
          ))}
        </div>
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <ShimmerBlock className="h-6 w-52" />
          <div className="mt-5 grid gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <ShimmerBlock className="h-12 w-full" key={index} />
            ))}
          </div>
        </div>
      </section>
      <span className="sr-only">{label}</span>
    </div>
  );

  if (as === "main") {
    return (
      <main className="min-h-[100dvh] px-4 py-4 text-foreground sm:px-6 lg:px-8">
        {content}
      </main>
    );
  }

  return content;
}

function ShimmerBlock({ className }: { className: string }) {
  return (
    <div
      className={[
        "animate-pulse rounded-md bg-muted",
        className,
      ].join(" ")}
    />
  );
}

function Header({
  activeView,
  bootcampName,
  participant,
}: {
  activeView: View;
  bootcampName: string;
  participant: ParticipantRecord;
}) {
  const titleByView: Record<View, string> = {
    overview: "Dashboard peserta",
    transactions: "Rekap pengeluaran",
    add: "Tambah pengeluaran",
    members: "Daftar peserta",
    notifications: "Riwayat notifikasi",
  };

  return (
    <header className="grid gap-4 rounded-lg border border-border bg-card p-4 shadow-[0_20px_70px_rgba(23,32,26,0.07)] md:grid-cols-[1fr_auto] md:items-center">
      <div>
        <p className="text-sm font-medium text-accent-foreground">
          Halo, {participant.name.split(" ")[0]}
        </p>
        <h1 className="mt-1 text-3xl font-semibold tracking-[0] md:text-4xl">
          {titleByView[activeView]}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Scope peserta: {bootcampName}
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <StatusPill label="Peserta aktif" icon={Check} tone="success" />
        <StatusPill label="Email login" icon={Mail} tone="neutral" />
        <StatusPill label="Akses terbuka" icon={LockKeyhole} tone="neutral" />
      </div>
    </header>
  );
}

function OverviewPanel({
  activeBootcamp,
  notifications,
  participant,
  settlementRows,
  summary,
}: {
  activeBootcamp: BootcampRecord;
  notifications: NotificationRecord[];
  participant: ParticipantRecord;
  settlementRows: Array<Record<string, string | number>>;
  summary: {
    totalPaid: number;
    totalOwed: number;
    totalReceivable: number;
    netBalance: number;
  };
}) {
  const unreadNotifications = notifications.filter((item) => !item.isRead).length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={CircleDollarSign}
          label="Total dibayar"
          value={formatRupiah(summary.totalPaid)}
        />
        <MetricCard
          icon={ReceiptText}
          label="Tagihan saya"
          value={formatRupiah(summary.totalOwed)}
        />
        <MetricCard
          icon={Banknote}
          label="Piutang saya"
          value={formatRupiah(summary.totalReceivable)}
        />
        <MetricCard
          icon={Bell}
          label="Notifikasi baru"
          value={`${unreadNotifications} pesan`}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold">Pembayaran yang perlu dilihat</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Baris ini hanya dari transaksi {activeBootcamp.name} yang melibatkan{" "}
                {participant.name}.
              </p>
            </div>
            <span className="rounded-md bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground">
              Net {formatRupiah(summary.netBalance)}
            </span>
          </div>

          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full min-w-[680px] border-collapse bg-card text-sm">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Transaksi</th>
                  <th className="px-4 py-3">Dari</th>
                  <th className="px-4 py-3">Ke</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settlementRows.slice(0, 6).map((row) => (
                  <tr key={`${row.expenseId}-${row.debtorId}-${row.payerId}`}>
                    <td className="px-4 py-3 font-medium">{row.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.debtorName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.payerName}</td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatRupiah(Number(row.amount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <AuthPreviewPanel bootcamp={activeBootcamp} participant={participant} />
      </section>
    </div>
  );
}

function AuthPreviewPanel({
  bootcamp,
  participant,
}: {
  bootcamp: BootcampRecord;
  participant: ParticipantRecord;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex items-center gap-3">
        <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
          <LogIn size={20} strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Akses peserta</h2>
          <p className="text-sm text-muted-foreground">
            Email terdaftar untuk bootcamp ini
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-2 text-sm font-medium">
          Email peserta
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2 text-sm"
              defaultValue={participant.email}
              type="email"
            />
        </label>
        <button
          className="focus-ring flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px"
          type="button"
        >
          Masuk sebagai peserta
          <ArrowRight size={17} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-5 rounded-lg border border-border bg-accent p-4">
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 text-accent-foreground" size={18} />
          <div>
            <p className="text-sm font-semibold text-accent-foreground">
              Scope dashboard peserta
            </p>
            <p className="mt-1 text-sm leading-6 text-accent-foreground/80">
              Data yang tampil dibatasi ke {bootcamp.name}, termasuk peserta,
              transaksi, dan notifikasi.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TransactionsPanel({
  filteredExpenses,
  participantsById,
  query,
  setQuery,
}: {
  filteredExpenses: ExpenseRecord[];
  participantsById: Record<string, ParticipantRecord>;
  query: string;
  setQuery: (value: string) => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transaksi bootcamp saya</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Hanya transaksi dari bootcamp yang sedang diikuti.
          </p>
        </div>
        <label className="focus-within:ring-2 focus-within:ring-ring flex min-w-full items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm md:min-w-[320px]">
          <Search size={17} strokeWidth={1.8} />
          <input
            className="w-full border-0 bg-transparent outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari transaksi"
            value={query}
          />
        </label>
      </div>

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[760px] border-collapse bg-card text-sm">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Judul</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Pembayar</th>
              <th className="px-4 py-3">Peserta dipilih</th>
              <th className="px-4 py-3 text-right">Nominal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id}>
                <td className="px-4 py-3 font-medium">{expense.title}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {formatDate(expense.expenseDate)}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {participantsById[expense.payerId]?.name}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {expense.participants.length} orang
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatRupiah(expense.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AddExpensePanel({
  amount,
  checkedIds,
  expenseDate,
  activeParticipant,
  expenseFormMessage,
  isSavingExpense,
  onSaveExpense,
  participantsById,
  participants,
  setAmount,
  setExpenseDate,
  setTitle,
  splitPreview,
  title,
  toggleParticipant,
}: {
  amount: string;
  checkedIds: string[];
  expenseDate: string;
  activeParticipant: ParticipantRecord;
  expenseFormMessage: string;
  isSavingExpense: boolean;
  onSaveExpense: () => void;
  participantsById: Record<string, ParticipantRecord>;
  participants: ParticipantRecord[];
  setAmount: (value: string) => void;
  setExpenseDate: (value: string) => void;
  setTitle: (value: string) => void;
  splitPreview: Array<{ userId: string; shareAmount: number }>;
  title: string;
  toggleParticipant: (participantId: string) => void;
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-[1fr_420px]">
      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
        <h2 className="text-xl font-semibold">Form pengeluaran</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Judul pengeluaran
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Kopi dan snack review project"
              value={title}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Nominal
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              inputMode="numeric"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="100000"
              value={amount}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tanggal
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setExpenseDate(event.target.value)}
              placeholder="2026-08-18"
              type="date"
              value={expenseDate}
            />
          </label>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold">Pilih peserta yang menanggung</h3>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {participants.map((participant) => {
              const checked = checkedIds.includes(participant.id);

              return (
                <button
                  className={[
                    "focus-ring flex items-center justify-between rounded-md border px-3 py-3 text-left transition active:translate-y-px",
                    checked
                      ? "border-primary bg-accent"
                      : "border-border bg-card hover:bg-muted",
                  ].join(" ")}
                  key={participant.id}
                  onClick={() => toggleParticipant(participant.id)}
                  type="button"
                >
                  <span>
                    <span className="block text-sm font-semibold">{participant.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {participant.id === activeParticipant.id
                        ? "Pencatat, ikut jika dicentang"
                        : participant.email}
                    </span>
                  </span>
                  <span
                    className={[
                      "grid size-5 place-items-center rounded border",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card",
                    ].join(" ")}
                  >
                    {checked ? <Check size={14} strokeWidth={2.2} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
        <h2 className="text-xl font-semibold">Preview rincian bagi</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Total dibagi rata hanya ke peserta yang dicentang.
        </p>
        <div className="mt-5 grid gap-2">
          {splitPreview.length > 0 ? (
            splitPreview.map((share) => (
              <div
                className="flex items-center justify-between rounded-md bg-muted px-3 py-2.5 text-sm"
                key={share.userId}
              >
                <span className="font-medium">{participantsById[share.userId]?.name}</span>
                <span className="font-semibold">{formatRupiah(share.shareAmount)}</span>
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Isi nominal dan pilih minimal satu peserta.
            </div>
          )}
        </div>
        <button
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
          disabled={isSavingExpense || checkedIds.length === 0}
          onClick={onSaveExpense}
          type="button"
        >
          {isSavingExpense ? (
            <LoaderCircle className="animate-spin" size={17} strokeWidth={1.8} />
          ) : (
            <ArrowRight size={17} strokeWidth={1.8} />
          )}
          {isSavingExpense ? "Menyimpan..." : "Simpan pengeluaran"}
        </button>
        {expenseFormMessage ? (
          <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm font-medium text-foreground">
            {expenseFormMessage}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function MembersPanel({ participants }: { participants: ParticipantRecord[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold">Anggota bootcamp</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Rekening peserta yang berada di bootcamp yang sama.
          </p>
        </div>
        <button
          className="focus-ring flex items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px"
          type="button"
        >
          <CreditCard size={17} strokeWidth={1.8} />
          Tambah rekening
        </button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {participants.map((participant) => (
          <article
            className="rounded-lg border border-border bg-card p-4"
            key={participant.id}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-semibold">{participant.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{participant.email}</p>
              </div>
              <div className="grid size-9 place-items-center rounded-md bg-muted text-accent-foreground">
                <Users size={18} strokeWidth={1.8} />
              </div>
            </div>
            <div className="mt-4 rounded-md bg-muted p-3">
              <p className="text-xs font-semibold text-muted-foreground">Rekening aktif</p>
              <p className="mt-1 text-sm font-semibold">
                {participant.bank.bankName} {participant.bank.accountNumber}
              </p>
              <p className="text-xs text-muted-foreground">
                {participant.bank.accountHolderName}
              </p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">{participant.phone}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationsPanel({
  notifications,
}: {
  notifications: NotificationRecord[];
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <h2 className="text-xl font-semibold">Riwayat notifikasi</h2>
      <div className="mt-5 grid gap-3">
        {notifications.map((notification) => (
          <article
            className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[auto_1fr_auto] sm:items-start"
            key={notification.id}
          >
            <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
              <Bell size={18} strokeWidth={1.8} />
            </div>
            <div>
              <h3 className="font-semibold">{notification.title}</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {notification.message}
              </p>
            </div>
            <span className="text-sm text-muted-foreground">{notification.sentAt}</span>
          </article>
        ))}
      </div>
    </section>
  );
}

export function AdminWorkspace() {
  const router = useRouter();
  const [activeAdminView, setActiveAdminView] = useState<AdminView>("summary");
  const [managedBootcamps, setManagedBootcamps] = useState<BootcampRecord[]>([]);
  const [allParticipants, setAllParticipants] = useState<ParticipantRecord[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [newBootcampName, setNewBootcampName] = useState("");
  const [newBootcampLocation, setNewBootcampLocation] = useState("");
  const [newBootcampStartDate, setNewBootcampStartDate] = useState("");
  const [newBootcampEndDate, setNewBootcampEndDate] = useState("");
  const [newBootcampDeadline, setNewBootcampDeadline] = useState("");
  const [newBootcampStatus, setNewBootcampStatus] = useState("");
  const [editingBootcampId, setEditingBootcampId] = useState<string | null>(null);
  const [newParticipantName, setNewParticipantName] = useState("");
  const [newParticipantEmail, setNewParticipantEmail] = useState(
    "",
  );
  const [newParticipantPhone, setNewParticipantPhone] = useState("");
  const [newParticipantBootcampId, setNewParticipantBootcampId] = useState("");
  const [newParticipantBankName, setNewParticipantBankName] = useState("");
  const [newParticipantAccountNumber, setNewParticipantAccountNumber] =
    useState("");
  const [newParticipantAccountHolderName, setNewParticipantAccountHolderName] =
    useState("");
  const [createdBootcampId, setCreatedBootcampId] = useState<string | null>(null);
  const [adminMessage, setAdminMessage] = useState("");
  const [isSavingBootcamp, setIsSavingBootcamp] = useState(false);
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(true);
  const [deletingBootcampId, setDeletingBootcampId] = useState<string | null>(
    null,
  );
  const [deletingParticipantId, setDeletingParticipantId] = useState<
    string | null
  >(null);
  const [deletingExpenseId, setDeletingExpenseId] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] =
    useState<DeleteConfirmation | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetchAppState()
      .then((state) => {
        if (!isMounted) {
          return;
        }

        setManagedBootcamps(state.bootcamps);
        setAllParticipants(state.participants);
        setAllExpenses(state.expenses);
        setNewParticipantBootcampId((current) =>
          state.bootcamps.some((item: BootcampRecord) => item.id === current)
            ? current
            : "",
        );
      })
      .catch((error) => {
        if (isMounted) {
          setAdminMessage(
            error instanceof Error ? error.message : "Data admin gagal dimuat.",
          );
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoadingAdminData(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const activeBootcampCount = managedBootcamps.filter(
    (item) => item.status === "active",
  ).length;
  const bootcampNamesById = Object.fromEntries(
    managedBootcamps.map((item) => [item.id, item.name]),
  );
  const participantsById = Object.fromEntries(
    allParticipants.map((participant) => [participant.id, participant]),
  );
  const totalExpenseAmount = allExpenses.reduce(
    (total, expense) => total + expense.amount,
    0,
  );
  const createdBootcamp = createdBootcampId
    ? managedBootcamps.find((item) => item.id === createdBootcampId)
    : null;
  const isDeletingRecord = Boolean(
    deletingBootcampId || deletingParticipantId || deletingExpenseId,
  );
  const isAdminBlockingProcess =
    isSavingBootcamp || isCreatingParticipant || isLoggingOut || isDeletingRecord;
  const adminBlockingMessage = isLoggingOut
    ? "Memproses logout admin..."
    : isSavingBootcamp
      ? editingBootcampId
        ? "Menyimpan perubahan bootcamp..."
        : "Menyimpan bootcamp baru..."
      : isCreatingParticipant
        ? "Menyimpan peserta baru..."
        : isDeletingRecord
          ? "Menghapus data..."
          : "Memproses...";

  if (isLoadingAdminData) {
    return <DashboardDataShimmer label="Memuat data admin..." />;
  }

  async function handleAdminLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await requestLogout();
      router.push("/admin");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Logout admin gagal diproses.",
      );
      setIsLoggingOut(false);
    }
  }

  async function handleSubmitBootcamp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSavingBootcamp) {
      return;
    }

    setIsSavingBootcamp(true);

    try {
      if (editingBootcampId) {
        const result = await requestUpdateBootcamp(editingBootcampId, {
          name: newBootcampName,
          location: newBootcampLocation,
          startDate: newBootcampStartDate,
          endDate: newBootcampEndDate,
          paymentDeadline: newBootcampDeadline,
          status: newBootcampStatus,
        });

        setManagedBootcamps(result.state.bootcamps);
        setAllParticipants(result.state.participants);
        setAllExpenses(result.state.expenses);
        setEditingBootcampId(null);
        setAdminMessage("Perubahan bootcamp tersimpan.");
      } else {
        const result = await requestCreateBootcamp({
          name: newBootcampName,
          location: newBootcampLocation,
          startDate: newBootcampStartDate,
          endDate: newBootcampEndDate,
          paymentDeadline: newBootcampDeadline,
          status: newBootcampStatus,
        });

        setManagedBootcamps(result.state.bootcamps);
        setAllParticipants(result.state.participants);
        setAllExpenses(result.state.expenses);
        saveSelectedBootcampId(result.bootcamp.id);
        setCreatedBootcampId(result.bootcamp.id);
        setNewParticipantBootcampId(result.bootcamp.id);
        resetBootcampForm();
        setAdminMessage("Bootcamp baru aktif dan muncul di pendaftaran peserta.");
      }
    } catch (error) {
      setAdminMessage(
        error instanceof Error
          ? error.message
          : editingBootcampId
            ? "Bootcamp gagal diperbarui."
            : "Bootcamp gagal dibuat.",
      );
    } finally {
      setIsSavingBootcamp(false);
    }
  }

  function startEditBootcamp(item: BootcampRecord) {
    setEditingBootcampId(item.id);
    setNewBootcampName(item.name);
    setNewBootcampLocation(item.location);
    setNewBootcampStartDate(item.startDate);
    setNewBootcampEndDate(item.endDate);
    setNewBootcampDeadline(toDateTimeLocalInput(item.paymentDeadline));
    setNewBootcampStatus(item.status);
    setActiveAdminView("bootcamps");
    setAdminMessage("");
  }

  function resetBootcampForm() {
    setEditingBootcampId(null);
    setNewBootcampName("");
    setNewBootcampLocation("");
    setNewBootcampStartDate("");
    setNewBootcampEndDate("");
    setNewBootcampDeadline("");
    setNewBootcampStatus("");
  }

  function openDeleteConfirmation(confirmation: DeleteConfirmation) {
    if (isDeletingRecord) {
      return;
    }

    setDeleteConfirmation(confirmation);
  }

  function closeDeleteConfirmation() {
    if (isDeletingRecord) {
      return;
    }

    setDeleteConfirmation(null);
  }

  async function confirmDeleteAction() {
    if (!deleteConfirmation || isDeletingRecord) {
      return;
    }

    const currentConfirmation = deleteConfirmation;

    if (currentConfirmation.kind === "bootcamp") {
      await deleteBootcamp(currentConfirmation.id);
    } else if (currentConfirmation.kind === "participant") {
      await deleteParticipant(currentConfirmation.id);
    } else {
      await deleteExpense(currentConfirmation.id);
    }

    setDeleteConfirmation(null);
  }

  async function deleteBootcamp(bootcampId: string) {
    if (deletingBootcampId) {
      return;
    }

    setDeletingBootcampId(bootcampId);

    try {
      const state = await requestDeleteBootcamp(bootcampId);

      setManagedBootcamps(state.bootcamps);
      setAllParticipants(state.participants);
      setAllExpenses(state.expenses);
      setAdminMessage("Bootcamp dihapus dari daftar admin dan pilihan peserta.");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Bootcamp gagal dihapus.",
      );
    } finally {
      setDeletingBootcampId(null);
    }
  }

  async function handleCreateParticipant(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isCreatingParticipant) {
      return;
    }

    setIsCreatingParticipant(true);

    try {
      const result = await requestCreateParticipant({
        name: newParticipantName,
        email: newParticipantEmail,
        phone: newParticipantPhone,
        bootcampId: newParticipantBootcampId,
        bankName: newParticipantBankName,
        accountNumber: newParticipantAccountNumber,
        accountHolderName: newParticipantAccountHolderName,
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      setNewParticipantName("");
      setNewParticipantEmail("");
      setNewParticipantPhone("");
      setNewParticipantBootcampId("");
      setNewParticipantBankName("");
      setNewParticipantAccountNumber("");
      setNewParticipantAccountHolderName("");
      setAdminMessage("Peserta baru tersimpan dan bisa login dengan emailnya.");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Peserta gagal dibuat.",
      );
    } finally {
      setIsCreatingParticipant(false);
    }
  }

  async function deleteParticipant(participantId: string) {
    if (deletingParticipantId) {
      return;
    }

    setDeletingParticipantId(participantId);

    try {
      const state = await requestDeleteParticipant(participantId);

      setManagedBootcamps(state.bootcamps);
      setAllParticipants(state.participants);
      setAllExpenses(state.expenses);
      setAdminMessage("Peserta dihapus dari daftar dan transaksi terkait diperbarui.");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Peserta gagal dihapus.",
      );
    } finally {
      setDeletingParticipantId(null);
    }
  }

  async function deleteExpense(expenseId: string) {
    if (deletingExpenseId) {
      return;
    }

    setDeletingExpenseId(expenseId);

    try {
      const state = await requestDeleteExpense(expenseId);

      setManagedBootcamps(state.bootcamps);
      setAllParticipants(state.participants);
      setAllExpenses(state.expenses);
      setAdminMessage("Transaksi dihapus dari rekap.");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Transaksi gagal dihapus.",
      );
    } finally {
      setDeletingExpenseId(null);
    }
  }

  return (
    <section className="grid gap-4">
      <FullPageLoadingOverlay
        isVisible={isAdminBlockingProcess}
        message={adminBlockingMessage}
      />
      <header className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)] xl:grid-cols-[1fr_auto] xl:items-end">
        <div>
          <p className="text-sm font-medium text-accent-foreground">Admin workspace</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-[0] md:text-4xl">
            Dashboard admin
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Scope admin: semua bootcamp, semua peserta, dan transaksi lintas batch.
          </p>
        </div>
        <div className="grid gap-3">
          <nav className="grid gap-2 sm:grid-cols-2 md:grid-cols-5">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeAdminView === item.id;

              return (
                <button
                  className={[
                    "focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold transition active:translate-y-px",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  ].join(" ")}
                  key={item.id}
                  onClick={() => setActiveAdminView(item.id)}
                  type="button"
                >
                  <Icon size={17} strokeWidth={1.8} />
                  {item.label}
                </button>
              );
            })}
          </nav>
          <button
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0 md:justify-self-end"
            disabled={isLoggingOut}
            onClick={handleAdminLogout}
            type="button"
          >
            {isLoggingOut ? (
              <LoaderCircle className="animate-spin" size={17} strokeWidth={1.8} />
            ) : (
              <LogOut size={17} strokeWidth={1.8} />
            )}
            {isLoggingOut ? "Keluar..." : "Keluar"}
          </button>
        </div>
      </header>

      {adminMessage ? (
        <div className="rounded-lg border border-border bg-accent px-4 py-3 text-sm font-semibold text-accent-foreground">
          {adminMessage}
        </div>
      ) : null}

      {activeAdminView === "summary" ? (
        <section className="grid gap-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              icon={ClipboardList}
              label="Total bootcamp"
              value={`${managedBootcamps.length} batch`}
            />
            <MetricCard
              icon={Check}
              label="Bootcamp aktif"
              value={`${activeBootcampCount} batch`}
            />
            <MetricCard
              icon={Users}
              label="Semua peserta"
              value={`${allParticipants.length} peserta`}
            />
            <MetricCard
              icon={ReceiptText}
              label="Total transaksi"
              value={formatRupiah(totalExpenseAmount)}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
            <h2 className="text-xl font-semibold">Navigasi data admin</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Gunakan menu Bootcamp, Peserta, Rekening, dan Transaksi untuk
              membuka setiap daftar secara terpisah.
            </p>
          </div>
        </section>
      ) : null}

      {activeAdminView === "bootcamps" ? (
        <section className="grid gap-4">
          <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">
              {editingBootcampId ? "Edit bootcamp" : "Buat bootcamp baru"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Setelah disimpan, bootcamp aktif langsung muncul di pilihan login
              peserta.
            </p>
          </div>
          {createdBootcamp ? (
            <Link
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px"
              href="/"
              onClick={() => saveSelectedBootcampId(createdBootcamp.id)}
            >
              Buka login peserta
              <ArrowRight size={17} strokeWidth={1.8} />
            </Link>
          ) : null}
        </div>

        <form
          className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1.2fr_0.8fr_0.7fr_0.7fr_0.8fr_0.65fr_auto]"
          onSubmit={handleSubmitBootcamp}
        >
          <label className="grid gap-2 text-sm font-medium">
            Nama bootcamp
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampName(event.target.value)}
              placeholder="Data Analytics Batch 10"
              required
              value={newBootcampName}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Lokasi
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampLocation(event.target.value)}
              placeholder="Surabaya"
              required
              value={newBootcampLocation}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Mulai
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampStartDate(event.target.value)}
              placeholder="2026-10-05"
              required
              type="date"
              value={newBootcampStartDate}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Selesai
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampEndDate(event.target.value)}
              placeholder="2026-10-11"
              required
              type="date"
              value={newBootcampEndDate}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Payment deadline
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampDeadline(event.target.value)}
              placeholder="2026-10-24 23:59"
              required
              type="datetime-local"
              value={newBootcampDeadline}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Status
            <select
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) => setNewBootcampStatus(event.target.value)}
              required
              value={newBootcampStatus}
            >
              <option disabled value="">
                Pilih status bootcamp
              </option>
              <option value="active">Aktif</option>
              <option value="completed">Selesai</option>
            </select>
          </label>
          <button
            className="focus-ring flex h-[42px] items-center justify-center gap-2 self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
            disabled={isSavingBootcamp}
            type="submit"
          >
            {isSavingBootcamp ? (
              <LoaderCircle className="animate-spin" size={17} strokeWidth={1.8} />
            ) : editingBootcampId ? (
              <Pencil size={17} strokeWidth={1.8} />
            ) : (
              <Plus size={17} strokeWidth={1.8} />
            )}
            {isSavingBootcamp ? "Menyimpan..." : editingBootcampId ? "Simpan" : "Buat"}
          </button>
        </form>
        {editingBootcampId ? (
          <button
            className="focus-ring mt-3 inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px"
            onClick={resetBootcampForm}
            type="button"
          >
            Batal edit
          </button>
        ) : null}

        {createdBootcamp ? (
          <div className="mt-4 rounded-lg border border-border bg-accent p-4 text-sm text-accent-foreground">
            <span className="font-semibold">{createdBootcamp.name}</span> sudah
            aktif. Peserta bisa memilih bootcamp ini dari halaman login peserta.
          </div>
        ) : null}
          </div>

          <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div>
            <h2 className="text-xl font-semibold">Semua bootcamp</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin melihat batch aktif, selesai, dan batch terjadwal.
            </p>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full min-w-[900px] border-collapse bg-card text-sm">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Nama</th>
                  <th className="px-4 py-3">Lokasi</th>
                  <th className="px-4 py-3">Periode</th>
                  <th className="px-4 py-3">Payment deadline</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {managedBootcamps.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 font-medium">{item.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{item.location}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(item.startDate)} sampai {formatDate(item.endDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDeadline(item.paymentDeadline)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          "rounded-md px-2 py-1 text-xs font-semibold",
                          item.status === "active"
                            ? "bg-accent text-accent-foreground"
                            : "bg-[color-mix(in_oklch,var(--destructive)_12%,transparent)] text-destructive",
                        ].join(" ")}
                        >
                        {item.status === "active" ? "Aktif" : "Selesai"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted active:translate-y-px"
                          onClick={() => startEditBootcamp(item)}
                          title="Edit bootcamp"
                          type="button"
                        >
                          <Pencil size={16} strokeWidth={1.8} />
                        </button>
                        <button
                          className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/15 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-destructive/10 disabled:active:translate-y-0"
                          disabled={Boolean(deletingBootcampId)}
                          onClick={() =>
                            openDeleteConfirmation({
                              kind: "bootcamp",
                              id: item.id,
                              title: "Hapus bootcamp ini?",
                              description:
                                "Peserta dan transaksi terkait akan ikut diperbarui.",
                              itemName: item.name,
                              confirmLabel: "Hapus bootcamp",
                            })
                          }
                          title={
                            deletingBootcampId === item.id
                              ? "Menghapus..."
                              : "Hapus bootcamp"
                          }
                          type="button"
                        >
                          {deletingBootcampId === item.id ? (
                            <LoaderCircle
                              className="animate-spin"
                              size={16}
                              strokeWidth={1.8}
                            />
                          ) : (
                            <Trash2 size={16} strokeWidth={1.8} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          </div>
        </section>
      ) : null}

      {activeAdminView === "participants" ? (
        <section className="grid gap-4">
        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div>
            <h2 className="text-xl font-semibold">Tambah peserta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin bisa mendaftarkan peserta ke bootcamp dan rekening aktif.
            </p>
          </div>
          <form
            className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_1fr_0.8fr_1fr_0.7fr_0.9fr_1fr_auto]"
            onSubmit={handleCreateParticipant}
          >
            <label className="grid gap-2 text-sm font-medium">
              Nama
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) => setNewParticipantName(event.target.value)}
                placeholder="Peserta Baru"
                required
                value={newParticipantName}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Email
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) => setNewParticipantEmail(event.target.value)}
                placeholder="peserta.baru@mail.test"
                required
                type="email"
                value={newParticipantEmail}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              No. HP
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) => setNewParticipantPhone(event.target.value)}
                placeholder="0812-0000-0000"
                required
                value={newParticipantPhone}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Bootcamp
              <select
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) => setNewParticipantBootcampId(event.target.value)}
                required
                value={newParticipantBootcampId}
              >
                <option disabled value="">
                  Pilih bootcamp peserta
                </option>
                {managedBootcamps.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Bank
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) => setNewParticipantBankName(event.target.value)}
                placeholder="BCA"
                required
                value={newParticipantBankName}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              No. rekening
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                inputMode="numeric"
                onChange={(event) =>
                  setNewParticipantAccountNumber(event.target.value)
                }
                placeholder="1234567890"
                required
                value={newParticipantAccountNumber}
              />
            </label>
            <label className="grid gap-2 text-sm font-medium">
              Nama pemilik
              <input
                className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                onChange={(event) =>
                  setNewParticipantAccountHolderName(event.target.value)
                }
                placeholder="Peserta Baru"
                required
                value={newParticipantAccountHolderName}
              />
            </label>
            <button
              className="focus-ring flex h-[42px] items-center justify-center gap-2 self-end rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
              disabled={isCreatingParticipant}
              type="submit"
            >
              {isCreatingParticipant ? (
                <LoaderCircle
                  className="animate-spin"
                  size={17}
                  strokeWidth={1.8}
                />
              ) : (
                <Plus size={17} strokeWidth={1.8} />
              )}
              {isCreatingParticipant ? "Menyimpan..." : "Tambah"}
            </button>
          </form>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div>
            <h2 className="text-xl font-semibold">Semua peserta</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Peserta lintas bootcamp tanpa detail rekening.
            </p>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {allParticipants.map((participant) => (
              <article
                className="rounded-lg border border-border bg-card p-4"
                key={participant.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{participant.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {participant.email}
                    </p>
                  </div>
                  <div className="grid size-9 place-items-center rounded-md bg-muted text-accent-foreground">
                    <Users size={18} strokeWidth={1.8} />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {participant.bootcampIds.map((bootcampId) => (
                    <span
                      className="rounded-md bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground"
                      key={bootcampId}
                    >
                      {bootcampNamesById[bootcampId] ?? bootcampId}
                    </span>
                ))}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">{participant.phone}</p>
                  <button
                    className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/15 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-destructive/10 disabled:active:translate-y-0"
                    disabled={Boolean(deletingParticipantId)}
                    onClick={() =>
                      openDeleteConfirmation({
                        kind: "participant",
                        id: participant.id,
                        title: "Hapus peserta ini?",
                        description:
                          "Transaksi terkait akan ikut diperbarui.",
                        itemName: participant.name,
                        confirmLabel: "Hapus peserta",
                      })
                    }
                    title={
                      deletingParticipantId === participant.id
                        ? "Menghapus..."
                        : "Hapus peserta"
                    }
                    type="button"
                  >
                    {deletingParticipantId === participant.id ? (
                      <LoaderCircle
                        className="animate-spin"
                        size={16}
                        strokeWidth={1.8}
                      />
                    ) : (
                      <Trash2 size={16} strokeWidth={1.8} />
                    )}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
        </section>
      ) : null}

      {activeAdminView === "bankAccounts" ? (
        <section className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div>
            <h2 className="text-xl font-semibold">Semua rekening</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Daftar rekening peserta untuk kebutuhan pembayaran antar peserta.
            </p>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full min-w-[760px] border-collapse bg-card text-sm">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Peserta</th>
                  <th className="px-4 py-3">Bank</th>
                  <th className="px-4 py-3">Nomor rekening</th>
                  <th className="px-4 py-3">Nama pemilik</th>
                  <th className="px-4 py-3">Bootcamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allParticipants.map((participant) => (
                  <tr key={participant.id}>
                    <td className="px-4 py-3 font-medium">{participant.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {participant.bank.bankName}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {participant.bank.accountNumber}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {participant.bank.accountHolderName}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {participant.bootcampIds
                        .map((bootcampId) => bootcampNamesById[bootcampId] ?? bootcampId)
                        .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeAdminView === "expenses" ? (
        <section className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
          <div>
            <h2 className="text-xl font-semibold">Semua transaksi</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Admin melihat pengeluaran dari semua bootcamp dan bisa menghapus
              transaksi yang salah input.
            </p>
          </div>
          <div className="mt-5 overflow-hidden rounded-lg border border-border">
            <table className="w-full min-w-[920px] border-collapse bg-card text-sm">
              <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Bootcamp</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Pembayar</th>
                  <th className="px-4 py-3">Peserta dipilih</th>
                  <th className="px-4 py-3 text-right">Nominal</th>
                  <th className="px-4 py-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allExpenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-4 py-3 font-medium">{expense.title}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {bootcampNamesById[expense.bootcampId] ?? expense.bootcampId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(expense.expenseDate)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {participantsById[expense.payerId]?.name ?? expense.payerId}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {expense.participants.length} orang
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {formatRupiah(expense.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end">
                        <button
                          className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-destructive/30 bg-destructive/10 text-destructive transition hover:bg-destructive/15 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-destructive/10 disabled:active:translate-y-0"
                          disabled={Boolean(deletingExpenseId)}
                          onClick={() =>
                            openDeleteConfirmation({
                              kind: "expense",
                              id: expense.id,
                              title: "Hapus transaksi ini?",
                              description:
                                "Data rekap dan saldo peserta akan ikut diperbarui.",
                              itemName: expense.title,
                              confirmLabel: "Hapus transaksi",
                            })
                          }
                          title={
                            deletingExpenseId === expense.id
                              ? "Menghapus..."
                              : "Hapus transaksi"
                          }
                          type="button"
                        >
                          {deletingExpenseId === expense.id ? (
                            <LoaderCircle
                              className="animate-spin"
                              size={16}
                              strokeWidth={1.8}
                            />
                          ) : (
                            <Trash2 size={16} strokeWidth={1.8} />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <DeleteConfirmationDialog
        confirmation={deleteConfirmation}
        isDeleting={isDeletingRecord}
        onCancel={closeDeleteConfirmation}
        onConfirm={confirmDeleteAction}
      />
    </section>
  );
}

function DeleteConfirmationDialog({
  confirmation,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  confirmation: DeleteConfirmation | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!confirmation) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/30 p-4 backdrop-blur-sm">
      <div
        aria-labelledby="delete-confirmation-title"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-border bg-card p-5 text-foreground shadow-[0_24px_90px_rgba(23,32,26,0.22)]"
        role="dialog"
      >
        <div className="flex items-start gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-md bg-destructive/10 text-destructive">
            <AlertTriangle size={20} strokeWidth={1.9} />
          </div>
          <div>
            <h2
              className="text-lg font-semibold tracking-[0]"
              id="delete-confirmation-title"
            >
              {confirmation.title}
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {confirmation.description}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-md border border-border bg-muted px-3 py-2 text-sm font-semibold">
          {confirmation.itemName}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            className="focus-ring inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0"
            disabled={isDeleting}
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-destructive px-4 text-sm font-semibold text-destructive-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            {isDeleting ? (
              <LoaderCircle className="animate-spin" size={16} strokeWidth={1.8} />
            ) : (
              <Trash2 size={16} strokeWidth={1.8} />
            )}
            {isDeleting ? "Menghapus..." : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[0]">{value}</p>
        </div>
        <div className="grid size-11 place-items-center rounded-md bg-accent text-accent-foreground">
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </div>
    </article>
  );
}

function StatusPill({
  icon: Icon,
  label,
  tone,
}: {
  icon: typeof Check;
  label: string;
  tone: "neutral" | "success";
}) {
  return (
    <span
      className={[
        "inline-flex items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold",
        tone === "success"
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      <Icon size={15} strokeWidth={1.8} />
      {label}
    </span>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatDeadline(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function toDateTimeLocalInput(value: string) {
  return value.replace(/:00\+07:00$/, "").slice(0, 16);
}
