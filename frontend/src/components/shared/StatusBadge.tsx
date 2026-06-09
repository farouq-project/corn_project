import { cn, getStatusColor } from "@/lib/utils";

const statusLabels: Record<string, string> = {
  active: "Aktif", inactive: "Tidak Aktif", suspended: "Ditangguhkan",
  good: "Baik", warning: "Peringatan", critical: "Kritis", expired: "Kadaluarsa",
  depleted: "Habis", discarded: "Dibuang",
  approved: "Disetujui", pending: "Menunggu", rejected: "Ditolak", revision_needed: "Perlu Revisi",
  planned: "Direncanakan", started: "Dimulai", completed: "Selesai", cancelled: "Dibatalkan",
  harvested: "Dipanen", archived: "Diarsipkan",
  draft: "Draft", submitted: "Dikirim",
  upcoming: "Akan Datang",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "sm" }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-full",
        size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-3 py-1",
        getStatusColor(status),
        className
      )}
    >
      {statusLabels[status] ?? status}
    </span>
  );
}
