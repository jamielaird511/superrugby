import { Suspense } from "react";
import PaperBetsPrintClient from "./PaperBetsPrintClient";

export default function AdminPrintPaperBetsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 16 }}>Loading…</div>}>
      <PaperBetsPrintClient />
    </Suspense>
  );
}
