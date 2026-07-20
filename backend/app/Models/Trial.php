<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Trial extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'trial_code', 'trial_name', 'season_id', 'location_id', 'environment_id', 'environment_condition_id', 'trial_type_id',
        'trial_category', 'objective_category', 'target_release_year',
        'objective', 'layout_design', 'replications', 'plot_size_m2',
        'num_genotypes', 'num_locations', 'num_seasons',
        'row_spacing_cm', 'plant_spacing_cm', 'planting_date', 'harvest_date',
        'num_plots', 'num_samples', 'status', 'notes', 'principal_researcher_id', 'created_by',
    ];

    protected $casts = [
        'planting_date' => 'date',
        'harvest_date' => 'date',
    ];

    // ── Legacy / single-location relationships ───────────────────────────────

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function location()
    {
        return $this->belongsTo(Location::class);
    }

    public function trialType()
    {
        return $this->belongsTo(TrialType::class);
    }

    public function principalResearcher()
    {
        return $this->belongsTo(User::class, 'principal_researcher_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // ── Genotype / researcher assignments ────────────────────────────────────

    public function genotypes()
    {
        return $this->belongsToMany(Genotype::class, 'trial_genotypes')
            ->withPivot('entry_number', 'treatment_label', 'is_check', 'notes')
            ->withTimestamps();
    }

    public function researchers()
    {
        return $this->belongsToMany(User::class, 'trial_researchers', 'trial_id', 'user_id')
            ->withPivot('role')
            ->withTimestamps();
    }

    // ── New multilocation structure ───────────────────────────────────────────

    public function environments()
    {
        return $this->belongsToMany(Environment::class, 'trial_environments')
            ->withPivot('local_trial_code', 'status', 'local_coordinator_id', 'notes')
            ->withTimestamps();
    }

    public function trialEnvironments()
    {
        return $this->hasMany(TrialEnvironment::class);
    }

    public function blocks()
    {
        return $this->hasMany(TrialBlock::class);
    }

    public function plots()
    {
        return $this->hasMany(TrialPlot::class);
    }

    public function plotObservations()
    {
        return $this->hasMany(PlotObservation::class);
    }

    public function diseaseEvaluations()
    {
        return $this->hasMany(DiseaseEvaluation::class);
    }

    public function layouts()
    {
        return $this->hasMany(TrialLayout::class);
    }

    public function observationSchedules()
    {
        return $this->hasMany(ObservationSchedule::class);
    }

    // ── Legacy relationships (kept for backward compat) ───────────────────────

    public function phenotypeObservations()
    {
        return $this->hasMany(PhenotypeObservation::class);
    }

    public function fieldActivities()
    {
        return $this->hasMany(FieldActivity::class);
    }

    public function expenses()
    {
        return $this->hasMany(Expense::class);
    }

    public function seedInventories()
    {
        return $this->hasMany(SeedInventory::class, 'source_trial_id');
    }

    public function researchDocuments()
    {
        return $this->hasMany(ResearchDocument::class);
    }

    // ── Computed attributes ───────────────────────────────────────────────────

    public function getTotalExpenseAttribute(): float
    {
        return (float) $this->expenses()->where('approval_status', 'approved')->sum('amount');
    }

    public function getTotalPlotsAttribute(): int
    {
        return $this->plots()->count();
    }

    public function getObservationCompletionRateAttribute(): float
    {
        $totalPlots = $this->plots()->where('status', 'active')->count();
        if ($totalPlots === 0) return 0;
        $observed = $this->plotObservations()->whereIn('status', ['submitted', 'approved'])->distinct('trial_plot_id')->count('trial_plot_id');
        return round(($observed / $totalPlots) * 100, 1);
    }
}
