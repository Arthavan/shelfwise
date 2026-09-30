"use client";
import dynamic from "next/dynamic";

import type { ReaderData } from "@/components/reader/types";

const PdfReader = dynamic(() => import("@/components/reader/pdf-reader").then((m) => m.PdfReader), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-muted-foreground">Opening…</p>,
});

export function ReaderShell({ data }: { data: ReaderData }) {
  return <PdfReader data={data} />;
}
