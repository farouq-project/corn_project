<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TrialType extends Model
{
    protected $fillable = ['type_code', 'type_name', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];

    public function trials()
    {
        return $this->hasMany(Trial::class);
    }
}
