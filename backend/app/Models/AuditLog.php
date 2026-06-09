<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $fillable = [
        'user_id', 'user_name', 'event', 'auditable_type', 'auditable_id',
        'old_values', 'new_values', 'tags', 'ip_address', 'user_agent', 'url',
    ];

    public $timestamps = true;
    public const UPDATED_AT = null;

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
        'tags' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function auditable()
    {
        return $this->morphTo();
    }
}
