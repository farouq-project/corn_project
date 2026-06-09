<?php

namespace App\Services;

use App\Models\SeedInventory;
use App\Models\SystemNotification;
use App\Models\User;

class NotificationService
{
    public function create(int $userId, string $type, string $title, string $message, array $data = [], ?string $actionUrl = null): SystemNotification
    {
        return SystemNotification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'data' => $data ?: null,
            'action_url' => $actionUrl,
        ]);
    }

    public function notifyRoles(array $roles, string $type, string $title, string $message, array $data = []): void
    {
        $users = User::role($roles)->where('status', 'active')->pluck('id');

        foreach ($users as $userId) {
            $this->create($userId, $type, $title, $message, $data);
        }
    }

    public function checkStorageAlerts(): void
    {
        $lowStock = SeedInventory::with('genotype')
            ->where('remaining_weight_g', '<=', 50)
            ->whereNotIn('storage_status', ['depleted', 'discarded'])
            ->get();

        foreach ($lowStock as $inventory) {
            $this->notifyRoles(
                ['storage_officer', 'principal_researcher'],
                'low_stock',
                "Low Stock Alert: {$inventory->genotype?->genotype_name}",
                "Package {$inventory->package_code} has only {$inventory->remaining_weight_g}g remaining."
            );
        }
    }
}
