<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DiseaseType extends Model
{
    protected $fillable = [
        'disease_code', 'disease_name', 'disease_name_en', 'pathogen',
        'disease_category', 'severity_scale', 'scale_description',
        'description', 'is_active', 'sort_order',
    ];

    protected $casts = [
        'scale_description' => 'array',
        'is_active' => 'boolean',
    ];

    public function evaluations()
    {
        return $this->hasMany(DiseaseEvaluation::class);
    }
}
