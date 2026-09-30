import type { Metadata } from "next";

import { DataActions } from "@/components/settings/data-actions";
import { ThemeChoice } from "@/components/settings/theme-choice";
import { storageUsedBytes } from "@/lib/file-storage";
import { formatBytes } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const used = await storageUsedBytes();
  return (
    <div className="max-w-2xl">
      <header className="mb-6 sm:mb-8">
        <h1 className="font-serif text-2xl font-medium tracking-tight sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Appearance and your data.</p>
      </header>

      <section aria-labelledby="appearance-heading" className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="appearance-heading" className="text-base font-semibold">
          Appearance
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Choose how Shelfwise looks on this device.</p>
        <ThemeChoice />
      </section>

      <section aria-labelledby="files-heading" className="mt-6 rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="files-heading" className="text-base font-semibold">
          Book files
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">Storage used: {formatBytes(used)}</p>
      </section>

      <section aria-labelledby="data-heading" className="mt-6 rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="data-heading" className="text-base font-semibold">
          Your data
        </h2>
        <DataActions />
      </section>
    </div>
  );
}
