import type { Metadata } from "next";

import { DataActions } from "@/components/settings/data-actions";
import { ThemeChoice } from "@/components/settings/theme-choice";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
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

      <section aria-labelledby="data-heading" className="mt-6 rounded-lg border bg-card p-4 sm:p-6">
        <h2 id="data-heading" className="text-base font-semibold">
          Your data
        </h2>
        <DataActions />
      </section>
    </div>
  );
}
