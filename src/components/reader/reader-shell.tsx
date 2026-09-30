"use client";
import dynamic from "next/dynamic";

import type { ReaderData } from "@/components/reader/types";

const PdfReader = dynamic(() => import("@/components/reader/pdf-reader").then((m) => m.PdfReader), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Opening…</p>,
});

const EpubReader = dynamic(() => import("@/components/reader/epub-reader").then((m) => m.EpubReader), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Opening…</p>,
});

export function ReaderShell({ data }: { data: ReaderData }) {
  return data.format === "epub" ? <EpubReader data={data} /> : <PdfReader data={data} />;
}
