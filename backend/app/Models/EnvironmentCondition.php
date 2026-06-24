<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EnvironmentCondition extends Model
{
    protected $table = 'environment_conditions';

    protected $fillable = ['name', 'description', 'is_active'];

    protected $casts = ['is_active' => 'boolean'];
}
