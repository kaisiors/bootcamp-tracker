const bankOptions = [
  "BCA",
  "BNI",
  "BRI",
  "Mandiri",
  "BSI",
  "BTN",
  "CIMB Niaga",
  "Danamon",
  "OCBC",
  "Permata",
  "Bank Jago",
  "SeaBank",
  "blu by BCA Digital",
] as const;

const otherBankValue = "__other_bank__";

export function BankSelectField({
  disabled = false,
  label = "Bank",
  onChange,
  value,
}: {
  disabled?: boolean;
  label?: string;
  onChange: (value: string) => void;
  value: string;
}) {
  const isKnownBank = bankOptions.some((bank) => bank === value);
  const isCustomBank = value === otherBankValue || Boolean(value && !isKnownBank);

  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      <select
        className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        required
        value={isCustomBank ? otherBankValue : value}
      >
        <option disabled value="">
          Pilih bank
        </option>
        {bankOptions.map((bank) => (
          <option key={bank} value={bank}>
            {bank}
          </option>
        ))}
        <option value={otherBankValue}>Bank lainnya</option>
      </select>
      {isCustomBank ? (
        <input
          aria-label="Nama bank lainnya"
          className="focus-ring rounded-md border border-border bg-card px-3 py-2.5 text-sm"
          disabled={disabled}
          onChange={(event) => onChange(event.target.value || otherBankValue)}
          placeholder="Nama bank"
          required
          value={value === otherBankValue ? "" : value}
        />
      ) : null}
    </label>
  );
}
