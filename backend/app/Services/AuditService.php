<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

class AuditService
{
    public static function log(
        string $event,
        Model $model,
        array $oldValues = [],
        array $newValues = [],
        array $tags = []
    ): void {
        $user = Auth::user();

        AuditLog::create([
            'user_id' => $user?->id,
            'user_name' => $user?->name,
            'event' => $event,
            'auditable_type' => get_class($model),
            'auditable_id' => $model->getKey(),
            'old_values' => $oldValues ?: null,
            'new_values' => $newValues ?: null,
            'tags' => $tags ?: null,
            'ip_address' => Request::ip(),
            'user_agent' => Request::userAgent(),
            'url' => Request::fullUrl(),
        ]);
    }

    public static function logCreated(Model $model): void
    {
        self::log('created', $model, [], $model->getAttributes());
    }

    public static function logUpdated(Model $model, array $original): void
    {
        self::log('updated', $model, $original, $model->getChanges());
    }

    public static function logDeleted(Model $model): void
    {
        self::log('deleted', $model, $model->getAttributes());
    }

    public static function logAction(string $action, Model $model, array $data = []): void
    {
        self::log($action, $model, [], $data);
    }
}
