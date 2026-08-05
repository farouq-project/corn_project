"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import SeedCounter from "@/components/seed-counter/SeedCounter";

export default function SeedCounterPage() {
  return (
    <div className="p-4 sm:p-6 space-y-6">
      <PageHeader
        title="Seed Counter"
        description="Hitung benih secara otomatis dari foto menggunakan pemrosesan gambar di browser — tanpa koneksi server"
      />
      <SeedCounter />
    </div>
  );
}
