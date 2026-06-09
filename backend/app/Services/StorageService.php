<?php

namespace App\Services;

use App\Models\SeedInventory;
use App\Models\SeedMovement;
use App\Models\StorageUnit;
use App\Models\SystemNotification;
use Illuminate\Support\Str;

class StorageService
{
    public function createInventory(array $data): SeedInventory
    {
        $data['package_code'] = $data['package_code'] ?? $this->generatePackageCode();

        $inventory = SeedInventory::create($data);

        $this->checkAndNotifyStorageAlerts($inventory);
        AuditService::logCreated($inventory);

        return $inventory->load(['genotype', 'storageUnit']);
    }

    public function recordMovement(SeedInventory $inventory, array $data): SeedMovement
    {
        $data['movement_code'] = $this->generateMovementCode();
        $data['seed_inventory_id'] = $inventory->id;
        $data['balance_after_g'] = $inventory->remaining_weight_g - ($data['quantity_g'] ?? 0);

        $movement = SeedMovement::create($data);

        $inventory->update(['remaining_weight_g' => $movement->balance_after_g]);

        if ($movement->balance_after_g <= 0) {
            $inventory->update(['storage_status' => 'depleted']);
        } elseif ($inventory->isLowStock()) {
            $inventory->update(['storage_status' => 'warning']);
        }

        AuditService::logAction('seed_movement', $inventory, [
            'movement_type' => $data['movement_type'],
            'quantity_g' => $data['quantity_g'],
            'balance_after_g' => $movement->balance_after_g,
        ]);

        return $movement->load(['seedInventory.genotype', 'performer']);
    }

    public function getDashboardStats(): array
    {
        $totalInventory = SeedInventory::whereNotIn('storage_status', ['depleted', 'discarded'])->count();
        $lowStock = SeedInventory::where('storage_status', 'good')
            ->where('remaining_weight_g', '<=', 50)->count();
        $highMoisture = SeedInventory::where('moisture_content', '>', 14)->count();
        $expiredSoon = SeedInventory::whereNotNull('expiry_date')
            ->where('expiry_date', '<=', now()->addDays(30))
            ->where('storage_status', '!=', 'expired')
            ->count();

        $storageUnits = StorageUnit::where('is_active', true)
            ->with(['seedInventories' => fn($q) => $q->whereNotIn('storage_status', ['depleted', 'discarded'])])
            ->get()
            ->map(fn($unit) => [
                'id' => $unit->id,
                'name' => $unit->unit_name,
                'code' => $unit->unit_code,
                'occupancy_rate' => $unit->occupancy_rate,
                'capacity' => ($unit->capacity_racks ?? 0) * ($unit->capacity_boxes_per_rack ?? 1),
                'used' => $unit->seedInventories->count(),
            ]);

        return compact('totalInventory', 'lowStock', 'highMoisture', 'expiredSoon', 'storageUnits');
    }

    private function checkAndNotifyStorageAlerts(SeedInventory $inventory): void
    {
        if ($inventory->isHighMoisture()) {
            $this->createAlert(
                'high_moisture',
                "High Moisture Alert: {$inventory->package_code}",
                "Seed package {$inventory->package_code} ({$inventory->genotype?->genotype_name}) has moisture content of {$inventory->moisture_content}% which exceeds the safe threshold.",
                $inventory->created_by
            );
        }
    }

    private function createAlert(string $type, string $title, string $message, ?int $userId): void
    {
        if (!$userId) return;

        SystemNotification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
        ]);
    }

    private function generatePackageCode(): string
    {
        return 'PKG-' . strtoupper(Str::random(8));
    }

    private function generateMovementCode(): string
    {
        return 'MOV-' . date('Ymd') . '-' . strtoupper(Str::random(6));
    }
}
