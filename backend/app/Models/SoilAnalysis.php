<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SoilAnalysis extends Model
{
    protected $fillable = [
        'environment_id', 'sample_date', 'sample_depth_cm', 'lab_name', 'lab_reference',
        'ph_h2o', 'ph_kcl', 'organic_c_percent', 'organic_matter_percent',
        'total_n_percent', 'available_p_ppm', 'available_k_ppm', 'cation_exchange_capacity',
        'sand_percent', 'silt_percent', 'clay_percent', 'texture_class',
        'bulk_density_g_cm3', 'micronutrients', 'document_path', 'notes', 'recorded_by',
    ];

    protected $casts = [
        'sample_date' => 'date',
        'micronutrients' => 'array',
    ];

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function recorder()
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
