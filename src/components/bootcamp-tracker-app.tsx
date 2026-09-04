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
  recordSettlementPayment as requestRecordSettlementPayment,
  updateBootcamp as requestUpdateBootcamp,
  updateExpense as requestUpdateExpense,
} from "../lib/api-client.js";
import {
  bootcamps,
  expenses,
  notifications,
  participants,
} from "../lib/mock-data.js";
import {
  buildParticipantSettlementGroups,
  calculateParticipantSummary,
  calculateSettlementRows,
  formatRupiah,
  formatRupiahInput,
  parseRupiahInput,
  splitExpenseEvenly,
} from "../lib/finance.js";

type View =
  | "overview"
  | "transactions"
  | "add"
  | "members"
  | "notifications"
  | "payables"
  | "receivables";

const currentUserId = "bima";

type BootcampRecord = (typeof bootcamps)[number];
type ExpenseRecord = (typeof expenses)[number];
type NotificationRecord = (typeof notifications)[number];
type ParticipantRecord = (typeof participants)[number];
type SettlementPaymentRecord = {
  debtorId: string;
  expenseId: string;
  id: string;
  paidAt: string;
  payerId: string;
};
type SettlementPaymentItem = {
  amount: number;
  debtorId: string;
  expenseId: string;
  paidAt: string | null;
  payerId: string;
  status: "paid" | "unpaid";
  title: string;
};
type SettlementPaymentGroup = {
  bank: ParticipantRecord["bank"] | null;
  items: SettlementPaymentItem[];
  paidAmount: number;
  participantId: string;
  participantName: string;
  totalAmount: number;
  unpaidAmount: number;
};
type PaymentTarget = {
  bank: ParticipantRecord["bank"] | null;
  items: SettlementPaymentItem[];
  recipientName: string;
  totalAmount: number;
};
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
type ExpenseShareValues = Record<string, string>;

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

function createEvenExpenseShareValues(
  amount: string,
  participantIds: string[],
): ExpenseShareValues {
  const numericAmount = parseRupiahInput(amount);

  if (
    !Number.isInteger(numericAmount) ||
    numericAmount <= 0 ||
    participantIds.length === 0
  ) {
    return Object.fromEntries(participantIds.map((id) => [id, ""]));
  }

  return Object.fromEntries(
    splitExpenseEvenly(numericAmount, participantIds).map((share) => [
      share.userId,
      formatRupiahInput(share.shareAmount),
    ]),
  );
}

export function BootcampTrackerApp() {
  const router = useRouter();
  const [activeView, setActiveView] = useState<View>("overview");
  const [managedBootcamps, setManagedBootcamps] = useState<BootcampRecord[]>([]);
  const [allParticipants, setAllParticipants] = useState<ParticipantRecord[]>([]);
  const [allExpenses, setAllExpenses] = useState<ExpenseRecord[]>([]);
  const [allNotifications, setAllNotifications] = useState<NotificationRecord[]>([]);
  const [allSettlementPayments, setAllSettlementPayments] = useState<
    SettlementPaymentRecord[]
  >([]);
  const [selectedParticipantId, setSelectedParticipantId] = useState("");
  const [selectedBootcampId, setSelectedBootcampId] = useState("");
  const [query, setQuery] = useState("");
  const [amount, setAmount] = useState("");
  const [title, setTitle] = useState("");
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseFormMessage, setExpenseFormMessage] = useState("");
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [participantEditingExpenseId, setParticipantEditingExpenseId] =
    useState<string | null>(null);
  const [participantEditExpenseTitle, setParticipantEditExpenseTitle] =
    useState("");
  const [participantEditExpenseAmount, setParticipantEditExpenseAmount] =
    useState("");
  const [participantEditExpenseDate, setParticipantEditExpenseDate] =
    useState("");
  const [
    participantEditExpenseParticipantIds,
    setParticipantEditExpenseParticipantIds,
  ] = useState<string[]>([]);
  const [isSavingParticipantExpenseEdit, setIsSavingParticipantExpenseEdit] =
    useState(false);
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null);
  const [isSavingSettlementPayment, setIsSavingSettlementPayment] =
    useState(false);
  const [isLoggingOutParticipant, setIsLoggingOutParticipant] = useState(false);
  const [isLoadingDashboardData, setIsLoadingDashboardData] = useState(true);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [expenseShareValues, setExpenseShareValues] =
    useState<ExpenseShareValues>({});

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
        setAllSettlementPayments(state.settlementPayments ?? []);

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

  const payableGroups = useMemo<SettlementPaymentGroup[]>(() => {
    if (!currentParticipant) {
      return [];
    }

    return buildParticipantSettlementGroups(
      settlementRows,
      participantsById,
      currentParticipant.id,
      "payable",
      allSettlementPayments,
    );
  }, [allSettlementPayments, currentParticipant, participantsById, settlementRows]);

  const receivableGroups = useMemo<SettlementPaymentGroup[]>(() => {
    if (!currentParticipant) {
      return [];
    }

    return buildParticipantSettlementGroups(
      settlementRows,
      participantsById,
      currentParticipant.id,
      "receivable",
      allSettlementPayments,
    );
  }, [allSettlementPayments, currentParticipant, participantsById, settlementRows]);
  const payableTotal = payableGroups.reduce(
    (total, group) => total + group.unpaidAmount,
    0,
  );
  const receivableTotal = receivableGroups.reduce(
    (total, group) => total + group.unpaidAmount,
    0,
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

  const participantEditVisibleCheckedIds = useMemo(() => {
    const visibleParticipantIds = new Set(
      bootcampParticipants.map((participant) => participant.id),
    );
    return participantEditExpenseParticipantIds.filter((participantId) =>
      visibleParticipantIds.has(participantId),
    );
  }, [bootcampParticipants, participantEditExpenseParticipantIds]);

  const splitPreview = useMemo(() => {
    return visibleCheckedIds.map((userId) => ({
      userId,
      shareAmount: parseRupiahInput(expenseShareValues[userId]),
    }));
  }, [expenseShareValues, visibleCheckedIds]);
  const splitTotal = splitPreview.reduce(
    (total, share) => total + share.shareAmount,
    0,
  );
  const numericExpenseAmount = parseRupiahInput(amount);
  const isSplitTotalValid =
    Number.isInteger(numericExpenseAmount) &&
    numericExpenseAmount > 0 &&
    splitTotal === numericExpenseAmount &&
    splitPreview.every((share) => Number.isInteger(share.shareAmount) && share.shareAmount > 0);
  const isDashboardBlockingProcess =
    isSavingExpense ||
    isSavingParticipantExpenseEdit ||
    isSavingSettlementPayment ||
    isLoggingOutParticipant;
  const dashboardBlockingMessage = isLoggingOutParticipant
    ? "Memproses logout peserta..."
    : isSavingSettlementPayment
      ? "Memproses pembayaran..."
    : isSavingParticipantExpenseEdit
      ? "Menyimpan perubahan pengeluaran..."
      : "Menyimpan pengeluaran...";

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
    const nextCheckedIds = checkedIds.includes(participantId)
      ? checkedIds.filter((id) => id !== participantId)
      : [...checkedIds, participantId];
    const visibleParticipantIds = new Set(
      bootcampParticipants.map((participant) => participant.id),
    );
    const nextVisibleCheckedIds = nextCheckedIds.filter((id) =>
      visibleParticipantIds.has(id),
    );

    setCheckedIds(nextCheckedIds);
    setExpenseShareValues(
      createEvenExpenseShareValues(amount, nextVisibleCheckedIds),
    );
  }

  function setAllExpenseParticipants() {
    const participantIds = bootcampParticipants.map((participant) => participant.id);

    setCheckedIds(participantIds);
    setExpenseShareValues(createEvenExpenseShareValues(amount, participantIds));
  }

  function clearExpenseParticipants() {
    setCheckedIds([]);
    setExpenseShareValues({});
  }

  function handleExpenseAmountChange(value: string) {
    const nextAmount = formatRupiahInput(value);

    setAmount(formatRupiahInput(value));
    setExpenseShareValues(
      createEvenExpenseShareValues(nextAmount, visibleCheckedIds),
    );
  }

  function handleExpenseShareAmountChange(participantId: string, value: string) {
    setExpenseShareValues((current) => ({
      ...current,
      [participantId]: formatRupiahInput(value),
    }));
  }

  function startParticipantExpenseEdit(expense: ExpenseRecord) {
    if (expense.payerId !== currentParticipant.id) {
      return;
    }

    setParticipantEditingExpenseId(expense.id);
    setParticipantEditExpenseTitle(expense.title);
    setParticipantEditExpenseAmount(formatRupiahInput(expense.amount));
    setParticipantEditExpenseDate(expense.expenseDate);
    setParticipantEditExpenseParticipantIds(
      expense.participants.map((participant) => participant.userId),
    );
    setExpenseFormMessage("");
  }

  function resetParticipantExpenseEditForm() {
    setParticipantEditingExpenseId(null);
    setParticipantEditExpenseTitle("");
    setParticipantEditExpenseAmount("");
    setParticipantEditExpenseDate("");
    setParticipantEditExpenseParticipantIds([]);
  }

  function toggleParticipantExpenseEditParticipant(participantId: string) {
    setParticipantEditExpenseParticipantIds((selected) =>
      selected.includes(participantId)
        ? selected.filter((id) => id !== participantId)
        : [...selected, participantId],
    );
  }

  async function handleSubmitParticipantExpenseEdit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !participantEditingExpenseId ||
      isSavingParticipantExpenseEdit ||
      !participantBootcamp
    ) {
      return;
    }

    const participantBootcampId = participantBootcamp.id;

    if (participantEditVisibleCheckedIds.length === 0) {
      setExpenseFormMessage("Pilih minimal satu peserta yang menanggung.");
      return;
    }

    setIsSavingParticipantExpenseEdit(true);

    try {
      const result = await requestUpdateExpense(participantEditingExpenseId, {
        amount: participantEditExpenseAmount,
        bootcampId: participantBootcampId,
        expenseDate: participantEditExpenseDate,
        participantIds: participantEditVisibleCheckedIds,
        payerId: currentParticipant.id,
        title: participantEditExpenseTitle,
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      setAllNotifications(result.state.notifications);
      setAllSettlementPayments(result.state.settlementPayments ?? []);
      resetParticipantExpenseEditForm();
      setExpenseFormMessage("Perubahan pengeluaran tersimpan.");
    } catch (error) {
      setExpenseFormMessage(
        error instanceof Error ? error.message : "Pengeluaran gagal diperbarui.",
      );
    } finally {
      setIsSavingParticipantExpenseEdit(false);
    }
  }

  function startSettlementPayment(group: SettlementPaymentGroup) {
    const unpaidItems = group.items.filter((item) => item.status === "unpaid");

    if (unpaidItems.length === 0) {
      return;
    }

    setPaymentTarget({
      bank: group.bank,
      items: unpaidItems,
      recipientName: group.participantName,
      totalAmount: group.unpaidAmount,
    });
    setExpenseFormMessage("");
  }

  async function handleConfirmSettlementPayment() {
    if (!paymentTarget || isSavingSettlementPayment) {
      return;
    }

    setIsSavingSettlementPayment(true);

    try {
      const result = await requestRecordSettlementPayment({
        payments: paymentTarget.items.map((item) => ({
          debtorId: currentParticipant.id,
          expenseId: item.expenseId,
          payerId: item.payerId,
        })),
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      setAllNotifications(result.state.notifications);
      setAllSettlementPayments(result.state.settlementPayments ?? []);
      setPaymentTarget(null);
      setExpenseFormMessage("Pembayaran ditandai sudah bayar.");
    } catch (error) {
      setExpenseFormMessage(
        error instanceof Error ? error.message : "Pembayaran gagal diproses.",
      );
    } finally {
      setIsSavingSettlementPayment(false);
    }
  }

  async function handleParticipantLogout() {
    if (isLoggingOutParticipant) {
      return;
    }

    setIsLoggingOutParticipant(true);

    try {
      await requestLogout();
      router.push("/");
    } catch (error) {
      setExpenseFormMessage(
        error instanceof Error ? error.message : "Logout peserta gagal diproses.",
      );
      setIsLoggingOutParticipant(false);
    }
  }

  async function handleSaveExpense() {
    if (isSavingExpense) {
      return;
    }

    if (visibleCheckedIds.length === 0) {
      setExpenseFormMessage("Pilih minimal satu peserta yang menanggung.");
      return;
    }

    if (!Number.isInteger(numericExpenseAmount) || numericExpenseAmount <= 0) {
      setExpenseFormMessage("Nominal pengeluaran harus lebih dari 0.");
      return;
    }

    if (
      splitPreview.some(
        (share) => !Number.isInteger(share.shareAmount) || share.shareAmount <= 0,
      )
    ) {
      setExpenseFormMessage("Nominal setiap peserta harus lebih dari 0.");
      return;
    }

    if (!isSplitTotalValid) {
      setExpenseFormMessage(
        "Total belum sesuai. Total pembayaran peserta harus sama dengan nominal pengeluaran.",
      );
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
        participantShares: splitPreview,
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      setAllNotifications(result.state.notifications);
      setAllSettlementPayments(result.state.settlementPayments ?? []);
      setTitle("");
      setAmount("");
      setExpenseDate("");
      setCheckedIds([]);
      setExpenseShareValues({});
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
        message={dashboardBlockingMessage}
      />
      {paymentTarget ? (
        <PaymentConfirmationDialog
          isSaving={isSavingSettlementPayment}
          onCancel={() => setPaymentTarget(null)}
          onConfirm={handleConfirmSettlementPayment}
          payment={paymentTarget}
        />
      ) : null}
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

          <button
            className="focus-ring mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0"
            disabled={isLoggingOutParticipant}
            onClick={handleParticipantLogout}
            title="Keluar dari dashboard peserta"
            type="button"
          >
            {isLoggingOutParticipant ? (
              <LoaderCircle className="animate-spin" size={17} strokeWidth={1.8} />
            ) : (
              <LogOut size={17} strokeWidth={1.8} />
            )}
            {isLoggingOutParticipant ? "Keluar..." : "Keluar"}
          </button>
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
              onOpenPayables={() => setActiveView("payables")}
              onOpenReceivables={() => setActiveView("receivables")}
              participant={currentParticipant}
              payableTotal={payableTotal}
              receivableTotal={receivableTotal}
              settlementRows={settlementRows}
              summary={summary}
            />
          ) : null}

          {activeView === "transactions" ? (
            <TransactionsPanel
              currentParticipant={currentParticipant}
              filteredExpenses={filteredExpenses}
              isSavingParticipantExpenseEdit={isSavingParticipantExpenseEdit}
              onCancelParticipantExpenseEdit={resetParticipantExpenseEditForm}
              onStartParticipantExpenseEdit={startParticipantExpenseEdit}
              onSubmitParticipantExpenseEdit={handleSubmitParticipantExpenseEdit}
              participantEditExpenseAmount={participantEditExpenseAmount}
              participantEditExpenseDate={participantEditExpenseDate}
              participantEditExpenseParticipantIds={participantEditVisibleCheckedIds}
              participantEditExpenseTitle={participantEditExpenseTitle}
              participantEditingExpenseId={participantEditingExpenseId}
              participantsById={participantsById}
              participants={bootcampParticipants}
              query={query}
              setQuery={setQuery}
              setParticipantEditExpenseAmount={setParticipantEditExpenseAmount}
              setParticipantEditExpenseDate={setParticipantEditExpenseDate}
              setParticipantEditExpenseTitle={setParticipantEditExpenseTitle}
              toggleParticipantExpenseEditParticipant={
                toggleParticipantExpenseEditParticipant
              }
            />
          ) : null}

          {activeView === "payables" ? (
            <PayableSettlementsPanel
              groups={payableGroups}
              onBack={() => setActiveView("overview")}
              onPayGroup={startSettlementPayment}
            />
          ) : null}

          {activeView === "receivables" ? (
            <ReceivableSettlementsPanel
              groups={receivableGroups}
              onBack={() => setActiveView("overview")}
            />
          ) : null}

          {activeView === "add" ? (
            <AddExpensePanel
              amount={amount}
              checkedIds={visibleCheckedIds}
              clearExpenseParticipants={clearExpenseParticipants}
              expenseDate={expenseDate}
              activeParticipant={currentParticipant}
              participantsById={participantsById}
              participants={bootcampParticipants}
              expenseFormMessage={expenseFormMessage}
              isSplitTotalValid={isSplitTotalValid}
              isSavingExpense={isSavingExpense}
              onSelectAllParticipants={setAllExpenseParticipants}
              onSaveExpense={handleSaveExpense}
              onShareAmountChange={handleExpenseShareAmountChange}
              onAmountChange={handleExpenseAmountChange}
              setExpenseDate={setExpenseDate}
              setTitle={setTitle}
              shareValues={expenseShareValues}
              splitTotal={splitTotal}
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
    payables: "Tagihan saya",
    receivables: "Piutang saya",
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
  onOpenPayables,
  onOpenReceivables,
  participant,
  payableTotal,
  receivableTotal,
  settlementRows,
  summary,
}: {
  activeBootcamp: BootcampRecord;
  onOpenPayables: () => void;
  onOpenReceivables: () => void;
  participant: ParticipantRecord;
  payableTotal: number;
  receivableTotal: number;
  settlementRows: Array<Record<string, string | number>>;
  summary: {
    totalPaid: number;
    totalOwed: number;
    totalReceivable: number;
    netBalance: number;
  };
}) {
  return (
    <div className="grid gap-4">
      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          icon={CircleDollarSign}
          label="Total dibayar"
          value={formatRupiah(summary.totalPaid)}
        />
        <MetricCard
          icon={ReceiptText}
          label="Tagihan saya"
          onClick={onOpenPayables}
          value={formatRupiah(payableTotal)}
        />
        <MetricCard
          icon={Banknote}
          label="Piutang saya"
          onClick={onOpenReceivables}
          value={formatRupiah(receivableTotal)}
        />
      </section>

      <section className="grid gap-4">
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
      </section>
    </div>
  );
}

function PayableSettlementsPanel({
  groups,
  onBack,
  onPayGroup,
}: {
  groups: SettlementPaymentGroup[];
  onBack: () => void;
  onPayGroup: (group: SettlementPaymentGroup) => void;
}) {
  return (
    <section className="grid gap-4">
      <SettlementPanelHeader
        icon={ReceiptText}
        onBack={onBack}
        title="Tagihan yang harus dibayar"
      />

      {groups.length === 0 ? (
        <SettlementEmptyState message="Tidak ada tagihan yang perlu dibayar." />
      ) : (
        groups.map((group) => (
          <SettlementGroupCard
            group={group}
            key={group.participantId}
            mode="payable"
            onPayGroup={onPayGroup}
          />
        ))
      )}
    </section>
  );
}

function ReceivableSettlementsPanel({
  groups,
  onBack,
}: {
  groups: SettlementPaymentGroup[];
  onBack: () => void;
}) {
  return (
    <section className="grid gap-4">
      <SettlementPanelHeader
        icon={Banknote}
        onBack={onBack}
        title="Piutang yang harus diterima"
      />

      {groups.length === 0 ? (
        <SettlementEmptyState message="Tidak ada piutang dari peserta lain." />
      ) : (
        groups.map((group) => (
          <SettlementGroupCard group={group} key={group.participantId} mode="receivable" />
        ))
      )}
    </section>
  );
}

function SettlementPanelHeader({
  icon: Icon,
  onBack,
  title,
}: {
  icon: typeof LayoutDashboard;
  onBack: () => void;
  title: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <Icon size={20} strokeWidth={1.8} />
          </div>
          <h2 className="text-xl font-semibold">{title}</h2>
        </div>
        <button
          className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px"
          onClick={onBack}
          type="button"
        >
          <ArrowRight className="rotate-180" size={17} strokeWidth={1.8} />
          Kembali ke dashboard
        </button>
      </div>
    </div>
  );
}

function SettlementGroupCard({
  group,
  mode,
  onPayGroup,
}: {
  group: SettlementPaymentGroup;
  mode: "payable" | "receivable";
  onPayGroup?: (group: SettlementPaymentGroup) => void;
}) {
  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {mode === "payable" ? "Bayar ke" : "Dibayar oleh"}
          </p>
          <h3 className="mt-1 text-xl font-semibold">{group.participantName}</h3>
          {group.bank ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {group.bank.bankName} {group.bank.accountNumber}
            </p>
          ) : null}
        </div>
        <div className="grid gap-3 text-left md:justify-items-end md:text-right">
          <p className="text-sm text-muted-foreground">Total per peserta</p>
          <p className="text-2xl font-semibold">{formatRupiah(group.totalAmount)}</p>
          <p className="text-sm text-muted-foreground">
            Belum bayar {formatRupiah(group.unpaidAmount)}
          </p>
          {mode === "payable" ? (
            group.unpaidAmount > 0 ? (
              <button
                className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px"
                onClick={() => onPayGroup?.(group)}
                type="button"
              >
                <WalletCards size={16} strokeWidth={1.8} />
                Bayar
              </button>
            ) : (
              <span className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold text-accent-foreground">
                Semua sudah bayar
              </span>
            )
          ) : null}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[720px] border-collapse bg-card text-sm">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Transaksi</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {group.items.map((item) => (
              <tr key={`${item.expenseId}-${item.debtorId}-${item.payerId}`}>
                <td className="px-4 py-3 font-medium">{item.title}</td>
                <td className="px-4 py-3 text-right font-semibold">
                  {formatRupiah(item.amount)}
                </td>
                <td className="px-4 py-3">
                  <SettlementStatusBadge status={item.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

function SettlementStatusBadge({ status }: { status: "paid" | "unpaid" }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-md px-2.5 py-1 text-xs font-semibold",
        status === "paid"
          ? "bg-accent text-accent-foreground"
          : "bg-muted text-muted-foreground",
      ].join(" ")}
    >
      {status === "paid" ? "Sudah bayar" : "Belum bayar"}
    </span>
  );
}

function SettlementEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card p-8 text-center text-sm font-medium text-muted-foreground">
      {message}
    </div>
  );
}

function PaymentConfirmationDialog({
  isSaving,
  onCancel,
  onConfirm,
  payment,
}: {
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  payment: PaymentTarget;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-foreground/35 px-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-lg border border-border bg-card p-5 text-foreground shadow-[0_30px_90px_rgba(23,32,26,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Bayar</p>
            <h2 className="mt-1 text-xl font-semibold">{payment.recipientName}</h2>
          </div>
          <div className="grid size-10 place-items-center rounded-md bg-accent text-accent-foreground">
            <WalletCards size={20} strokeWidth={1.8} />
          </div>
        </div>

        <div className="mt-5 grid gap-3 rounded-lg border border-border bg-muted p-4">
          <PaymentInfoRow label="Total tagihan" value={formatRupiah(payment.totalAmount)} />
          <PaymentInfoRow
            label="Jumlah transaksi"
            value={`${payment.items.length} transaksi`}
          />
          <PaymentInfoRow
            label="Bank"
            value={payment.bank?.bankName ?? "Rekening belum tersedia"}
          />
          <PaymentInfoRow
            label="Nomor rekening"
            value={payment.bank?.accountNumber ?? "-"}
          />
          <PaymentInfoRow
            label="Nama pemilik rekening"
            value={payment.bank?.accountHolderName ?? "-"}
          />
        </div>

        <div className="mt-4 max-h-52 overflow-auto rounded-lg border border-border">
          <table className="w-full border-collapse bg-card text-sm">
            <thead className="sticky top-0 bg-muted text-left text-xs font-semibold text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Transaksi</th>
                <th className="px-3 py-2 text-right">Nominal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {payment.items.map((item) => (
                <tr key={`${item.expenseId}-${item.debtorId}-${item.payerId}`}>
                  <td className="px-3 py-2 font-medium">{item.title}</td>
                  <td className="px-3 py-2 text-right font-semibold">
                    {formatRupiah(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            className="focus-ring inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSaving}
            onClick={onCancel}
            type="button"
          >
            Batal
          </button>
          <button
            className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
            disabled={isSaving}
            onClick={onConfirm}
            type="button"
          >
            {isSaving ? (
              <LoaderCircle className="animate-spin" size={16} strokeWidth={1.8} />
            ) : (
              <WalletCards size={16} strokeWidth={1.8} />
            )}
            {isSaving ? "Memproses..." : "Bayar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaymentInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[160px_1fr] sm:items-center">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

function TransactionsPanel({
  currentParticipant,
  filteredExpenses,
  isSavingParticipantExpenseEdit,
  onCancelParticipantExpenseEdit,
  onStartParticipantExpenseEdit,
  onSubmitParticipantExpenseEdit,
  participantEditExpenseAmount,
  participantEditExpenseDate,
  participantEditExpenseParticipantIds,
  participantEditExpenseTitle,
  participantEditingExpenseId,
  participantsById,
  participants,
  query,
  setQuery,
  setParticipantEditExpenseAmount,
  setParticipantEditExpenseDate,
  setParticipantEditExpenseTitle,
  toggleParticipantExpenseEditParticipant,
}: {
  currentParticipant: ParticipantRecord;
  filteredExpenses: ExpenseRecord[];
  isSavingParticipantExpenseEdit: boolean;
  onCancelParticipantExpenseEdit: () => void;
  onStartParticipantExpenseEdit: (expense: ExpenseRecord) => void;
  onSubmitParticipantExpenseEdit: (
    event: React.FormEvent<HTMLFormElement>,
  ) => void;
  participantEditExpenseAmount: string;
  participantEditExpenseDate: string;
  participantEditExpenseParticipantIds: string[];
  participantEditExpenseTitle: string;
  participantEditingExpenseId: string | null;
  participantsById: Record<string, ParticipantRecord>;
  participants: ParticipantRecord[];
  query: string;
  setQuery: (value: string) => void;
  setParticipantEditExpenseAmount: (value: string) => void;
  setParticipantEditExpenseDate: (value: string) => void;
  setParticipantEditExpenseTitle: (value: string) => void;
  toggleParticipantExpenseEditParticipant: (participantId: string) => void;
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

      {participantEditingExpenseId ? (
        <form
          className="mt-5 grid gap-4 rounded-lg border border-border bg-muted p-4 md:grid-cols-2 xl:grid-cols-[1fr_0.75fr_0.75fr]"
          onSubmit={onSubmitParticipantExpenseEdit}
        >
          <div className="md:col-span-2 xl:col-span-3">
            <h3 className="text-base font-semibold">Edit pengeluaran</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Peserta hanya bisa mengubah transaksi yang dibuat sendiri.
            </p>
          </div>
          <label className="grid gap-2 text-sm font-medium">
            Judul
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) =>
                setParticipantEditExpenseTitle(event.target.value)
              }
              placeholder="Kopi dan snack review project"
              required
              value={participantEditExpenseTitle}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Nominal
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              inputMode="numeric"
              onChange={(event) =>
                setParticipantEditExpenseAmount(formatRupiahInput(event.target.value))
              }
              placeholder="100.000"
              required
              value={participantEditExpenseAmount}
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            Tanggal
            <input
              className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
              onChange={(event) =>
                setParticipantEditExpenseDate(event.target.value)
              }
              required
              type="date"
              value={participantEditExpenseDate}
            />
          </label>
          <div className="grid gap-2 md:col-span-2 xl:col-span-3">
            <p className="text-sm font-medium">Peserta yang menanggung</p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {participants.map((participant) => {
                const checked = participantEditExpenseParticipantIds.includes(
                  participant.id,
                );

                return (
                  <button
                    className={[
                      "focus-ring flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left text-sm transition active:translate-y-px",
                      checked
                        ? "border-primary bg-accent"
                        : "border-border hover:bg-card/70",
                    ].join(" ")}
                    key={participant.id}
                    onClick={() =>
                      toggleParticipantExpenseEditParticipant(participant.id)
                    }
                    type="button"
                  >
                    <span>
                      <span className="block font-semibold">{participant.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {participant.id === currentParticipant.id
                          ? "Pencatat transaksi"
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
          <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:justify-end xl:col-span-3">
            <button
              className="focus-ring inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-card/70 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0"
              disabled={isSavingParticipantExpenseEdit}
              onClick={onCancelParticipantExpenseEdit}
              type="button"
            >
              Batal edit pengeluaran
            </button>
            <button
              className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
              disabled={
                isSavingParticipantExpenseEdit ||
                participantEditExpenseParticipantIds.length === 0
              }
              type="submit"
            >
              {isSavingParticipantExpenseEdit ? (
                <LoaderCircle
                  className="animate-spin"
                  size={17}
                  strokeWidth={1.8}
                />
              ) : (
                <Pencil size={17} strokeWidth={1.8} />
              )}
              {isSavingParticipantExpenseEdit ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </div>
        </form>
      ) : null}

      <div className="mt-5 overflow-hidden rounded-lg border border-border">
        <table className="w-full min-w-[840px] border-collapse bg-card text-sm">
          <thead className="bg-muted text-left text-xs font-semibold text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Judul</th>
              <th className="px-4 py-3">Tanggal</th>
              <th className="px-4 py-3">Pembayar</th>
              <th className="px-4 py-3">Peserta dipilih</th>
              <th className="px-4 py-3 text-right">Nominal</th>
              <th className="px-4 py-3 text-right">Aksi</th>
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
                <td className="px-4 py-3">
                  <div className="flex justify-end">
                    {expense.payerId === currentParticipant.id ? (
                      <button
                        className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-card disabled:active:translate-y-0"
                        disabled={isSavingParticipantExpenseEdit}
                        onClick={() => onStartParticipantExpenseEdit(expense)}
                        title="Edit pengeluaran"
                        type="button"
                      >
                        <Pencil size={16} strokeWidth={1.8} />
                      </button>
                    ) : null}
                  </div>
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
  clearExpenseParticipants,
  expenseDate,
  activeParticipant,
  expenseFormMessage,
  isSplitTotalValid,
  isSavingExpense,
  onSelectAllParticipants,
  onSaveExpense,
  onShareAmountChange,
  onAmountChange,
  participantsById,
  participants,
  setExpenseDate,
  setTitle,
  shareValues,
  splitTotal,
  splitPreview,
  title,
  toggleParticipant,
}: {
  amount: string;
  checkedIds: string[];
  clearExpenseParticipants: () => void;
  expenseDate: string;
  activeParticipant: ParticipantRecord;
  expenseFormMessage: string;
  isSplitTotalValid: boolean;
  isSavingExpense: boolean;
  onSelectAllParticipants: () => void;
  onSaveExpense: () => void;
  onShareAmountChange: (participantId: string, value: string) => void;
  onAmountChange: (value: string) => void;
  participantsById: Record<string, ParticipantRecord>;
  participants: ParticipantRecord[];
  setExpenseDate: (value: string) => void;
  setTitle: (value: string) => void;
  shareValues: ExpenseShareValues;
  splitTotal: number;
  splitPreview: Array<{ userId: string; shareAmount: number }>;
  title: string;
  toggleParticipant: (participantId: string) => void;
}) {
  const allParticipantsSelected =
    participants.length > 0 && checkedIds.length === participants.length;

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
              onChange={(event) => onAmountChange(event.target.value)}
              placeholder="100.000"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold">Pilih peserta yang menanggung</h3>
            <div className="flex gap-2">
              <button
                className="focus-ring inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                disabled={participants.length === 0 || allParticipantsSelected}
                onClick={onSelectAllParticipants}
                type="button"
              >
                <Check size={14} strokeWidth={2.2} />
                Pilih semua
              </button>
              <button
                className="focus-ring inline-flex h-9 items-center justify-center rounded-md border border-border bg-card px-3 text-xs font-semibold text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-60"
                disabled={checkedIds.length === 0}
                onClick={clearExpenseParticipants}
                type="button"
              >
                Kosongkan
              </button>
            </div>
          </div>
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
          Nominal awal dibagi rata, lalu bisa disesuaikan per peserta.
        </p>
        <div className="mt-5 grid gap-2">
          {splitPreview.length > 0 ? (
            splitPreview.map((share) => (
              <div
                className="grid gap-2 rounded-md bg-muted px-3 py-2.5 text-sm sm:grid-cols-[1fr_150px] sm:items-center"
                key={share.userId}
              >
                <span className="font-medium">{participantsById[share.userId]?.name}</span>
                <input
                  aria-label={`Nilai pembayaran ${participantsById[share.userId]?.name}`}
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2 text-right text-sm font-semibold"
                  inputMode="numeric"
                  onChange={(event) =>
                    onShareAmountChange(share.userId, event.target.value)
                  }
                  placeholder="0"
                  value={shareValues[share.userId] ?? ""}
                />
              </div>
            ))
          ) : (
            <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
              Isi nominal dan pilih minimal satu peserta.
            </div>
          )}
        </div>
        {splitPreview.length > 0 ? (
          <div
            className={[
              "mt-4 rounded-md border px-3 py-2 text-sm font-semibold",
              isSplitTotalValid
                ? "border-accent bg-accent text-accent-foreground"
                : "border-destructive/25 bg-destructive/10 text-destructive",
            ].join(" ")}
          >
            {isSplitTotalValid
              ? `Total sudah sesuai: ${formatRupiah(splitTotal)}`
              : `Total belum sesuai: ${formatRupiah(splitTotal)}`}
          </div>
        ) : null}
        <button
          className="focus-ring mt-5 flex w-full items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
          disabled={isSavingExpense || checkedIds.length === 0 || !isSplitTotalValid}
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
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [editExpenseTitle, setEditExpenseTitle] = useState("");
  const [editExpenseAmount, setEditExpenseAmount] = useState("");
  const [editExpenseBootcampId, setEditExpenseBootcampId] = useState("");
  const [editExpenseDate, setEditExpenseDate] = useState("");
  const [editExpensePayerId, setEditExpensePayerId] = useState("");
  const [editExpenseParticipantIds, setEditExpenseParticipantIds] = useState<
    string[]
  >([]);
  const [adminMessage, setAdminMessage] = useState("");
  const [isSavingBootcamp, setIsSavingBootcamp] = useState(false);
  const [isCreatingParticipant, setIsCreatingParticipant] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isLoadingAdminData, setIsLoadingAdminData] = useState(true);
  const [isSavingExpenseEdit, setIsSavingExpenseEdit] = useState(false);
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
  const editExpenseParticipants = allParticipants.filter((participant) =>
    participant.bootcampIds.includes(editExpenseBootcampId),
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
    isSavingBootcamp ||
    isCreatingParticipant ||
    isLoggingOut ||
    isSavingExpenseEdit ||
    isDeletingRecord;
  const adminBlockingMessage = isLoggingOut
    ? "Memproses logout admin..."
    : isSavingBootcamp
      ? editingBootcampId
        ? "Menyimpan perubahan bootcamp..."
        : "Menyimpan bootcamp baru..."
      : isCreatingParticipant
        ? "Menyimpan peserta baru..."
        : isSavingExpenseEdit
          ? "Menyimpan perubahan transaksi..."
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

  function startEditExpense(expense: ExpenseRecord) {
    setEditingExpenseId(expense.id);
    setEditExpenseTitle(expense.title);
    setEditExpenseAmount(formatRupiahInput(expense.amount));
    setEditExpenseBootcampId(expense.bootcampId);
    setEditExpenseDate(expense.expenseDate);
    setEditExpensePayerId(expense.payerId);
    setEditExpenseParticipantIds(
      expense.participants.map((participant) => participant.userId),
    );
    setActiveAdminView("expenses");
    setAdminMessage("");
  }

  function resetExpenseEditForm() {
    setEditingExpenseId(null);
    setEditExpenseTitle("");
    setEditExpenseAmount("");
    setEditExpenseBootcampId("");
    setEditExpenseDate("");
    setEditExpensePayerId("");
    setEditExpenseParticipantIds([]);
  }

  function handleEditExpenseBootcampChange(bootcampId: string) {
    setEditExpenseBootcampId(bootcampId);
    setEditExpensePayerId("");
    setEditExpenseParticipantIds([]);
  }

  function toggleEditExpenseParticipant(participantId: string) {
    setEditExpenseParticipantIds((selected) =>
      selected.includes(participantId)
        ? selected.filter((id) => id !== participantId)
        : [...selected, participantId],
    );
  }

  async function handleSubmitExpenseEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingExpenseId || isSavingExpenseEdit) {
      return;
    }

    if (editExpenseParticipantIds.length === 0) {
      setAdminMessage("Pilih minimal satu peserta yang menanggung transaksi.");
      return;
    }

    setIsSavingExpenseEdit(true);

    try {
      const result = await requestUpdateExpense(editingExpenseId, {
        amount: editExpenseAmount,
        bootcampId: editExpenseBootcampId,
        expenseDate: editExpenseDate,
        participantIds: editExpenseParticipantIds,
        payerId: editExpensePayerId,
        title: editExpenseTitle,
      });

      setManagedBootcamps(result.state.bootcamps);
      setAllParticipants(result.state.participants);
      setAllExpenses(result.state.expenses);
      resetExpenseEditForm();
      setAdminMessage("Perubahan transaksi tersimpan.");
    } catch (error) {
      setAdminMessage(
        error instanceof Error ? error.message : "Transaksi gagal diperbarui.",
      );
    } finally {
      setIsSavingExpenseEdit(false);
    }
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
              Admin melihat pengeluaran dari semua bootcamp dan bisa mengedit atau menghapus
              transaksi yang salah input.
            </p>
          </div>
          {editingExpenseId ? (
            <form
              className="mt-5 grid gap-4 rounded-lg border border-border bg-muted p-4 md:grid-cols-2 xl:grid-cols-[1fr_0.7fr_0.9fr_0.75fr_0.9fr]"
              onSubmit={handleSubmitExpenseEdit}
            >
              <div className="md:col-span-2 xl:col-span-5">
                <h3 className="text-base font-semibold">Edit transaksi</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ubah detail transaksi, lalu pilih ulang peserta yang menanggung.
                </p>
              </div>
              <label className="grid gap-2 text-sm font-medium">
                Judul
                <input
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                  onChange={(event) => setEditExpenseTitle(event.target.value)}
                  placeholder="Kopi dan snack review project"
                  required
                  value={editExpenseTitle}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Nominal
                <input
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                  inputMode="numeric"
                  onChange={(event) =>
                    setEditExpenseAmount(formatRupiahInput(event.target.value))
                  }
                  placeholder="100.000"
                  required
                  value={editExpenseAmount}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Bootcamp
                <select
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                  onChange={(event) =>
                    handleEditExpenseBootcampChange(event.target.value)
                  }
                  required
                  value={editExpenseBootcampId}
                >
                  <option disabled value="">
                    Pilih bootcamp transaksi
                  </option>
                  {managedBootcamps.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Tanggal
                <input
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                  onChange={(event) => setEditExpenseDate(event.target.value)}
                  required
                  type="date"
                  value={editExpenseDate}
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                Pembayar
                <select
                  className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
                  onChange={(event) => setEditExpensePayerId(event.target.value)}
                  required
                  value={editExpensePayerId}
                >
                  <option disabled value="">
                    Pilih pembayar
                  </option>
                  {editExpenseParticipants.map((participant) => (
                    <option key={participant.id} value={participant.id}>
                      {participant.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid gap-2 md:col-span-2 xl:col-span-5">
                <p className="text-sm font-medium">Peserta yang menanggung</p>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {editExpenseParticipants.map((participant) => {
                    const checked = editExpenseParticipantIds.includes(participant.id);

                    return (
                      <button
                        className={[
                          "focus-ring flex items-center justify-between rounded-md border bg-card px-3 py-2.5 text-left text-sm transition active:translate-y-px",
                          checked
                            ? "border-primary bg-accent"
                            : "border-border hover:bg-card/70",
                        ].join(" ")}
                        key={participant.id}
                        onClick={() => toggleEditExpenseParticipant(participant.id)}
                        type="button"
                      >
                        <span>
                          <span className="block font-semibold">{participant.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {participant.email}
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
              <div className="flex flex-col gap-2 md:col-span-2 md:flex-row md:justify-end xl:col-span-5">
                <button
                  className="focus-ring inline-flex h-10 items-center justify-center rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-card/70 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:active:translate-y-0"
                  disabled={isSavingExpenseEdit}
                  onClick={resetExpenseEditForm}
                  type="button"
                >
                  Batal edit transaksi
                </button>
                <button
                  className="focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-95 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:brightness-100 disabled:active:translate-y-0"
                  disabled={
                    isSavingExpenseEdit || editExpenseParticipantIds.length === 0
                  }
                  type="submit"
                >
                  {isSavingExpenseEdit ? (
                    <LoaderCircle
                      className="animate-spin"
                      size={17}
                      strokeWidth={1.8}
                    />
                  ) : (
                    <Pencil size={17} strokeWidth={1.8} />
                  )}
                  {isSavingExpenseEdit ? "Menyimpan..." : "Simpan perubahan"}
                </button>
              </div>
            </form>
          ) : null}
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
                      <div className="flex justify-end gap-2">
                        <button
                          className="focus-ring inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground transition hover:bg-muted active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:bg-card disabled:active:translate-y-0"
                          disabled={isSavingExpenseEdit}
                          onClick={() => startEditExpense(expense)}
                          title="Edit transaksi"
                          type="button"
                        >
                          <Pencil size={16} strokeWidth={1.8} />
                        </button>
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
  onClick,
  value,
}: {
  icon: typeof LayoutDashboard;
  label: string;
  onClick?: () => void;
  value: string;
}) {
  const content = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-2 text-2xl font-semibold tracking-[0]">{value}</p>
      </div>
      <div className="flex items-center gap-2">
        {onClick ? (
          <ChevronRight className="text-muted-foreground" size={18} strokeWidth={1.8} />
        ) : null}
        <div className="grid size-11 place-items-center rounded-md bg-accent text-accent-foreground">
          <Icon size={21} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button
        className="focus-ring rounded-lg border border-border bg-card p-5 text-left shadow-[0_20px_70px_rgba(23,32,26,0.07)] transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80 active:translate-y-0"
        onClick={onClick}
        type="button"
      >
        {content}
      </button>
    );
  }

  return (
    <article className="rounded-lg border border-border bg-card p-5 shadow-[0_20px_70px_rgba(23,32,26,0.07)]">
      {content}
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
