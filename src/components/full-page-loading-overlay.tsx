"use client";

import { LoaderCircle } from "lucide-react";

export function FullPageLoadingOverlay({
  isVisible,
  message,
}: {
  isVisible: boolean;
  message: string;
}) {
  if (!isVisible) {
    return null;
  }

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[60] grid place-items-center bg-background/80 p-4 text-foreground backdrop-blur-sm"
      role="status"
    >
      <div className="flex w-full max-w-[320px] flex-col items-center gap-3 rounded-lg border border-border bg-card px-6 py-5 text-center text-card-foreground shadow-[0_24px_90px_rgba(23,32,26,0.22)]">
        <div className="grid size-11 place-items-center rounded-md bg-primary text-primary-foreground">
          <LoaderCircle className="animate-spin" size={23} strokeWidth={1.9} />
        </div>
        <div>
          <p className="text-sm font-semibold">{message}</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Mohon tunggu, proses sedang berjalan.
          </p>
        </div>
      </div>
    </div>
  );
}
