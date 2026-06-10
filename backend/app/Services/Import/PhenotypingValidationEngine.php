<?php

namespace App\Services\Import;

use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\Genotype;

/**
 * Phase 2 scaffolding: row-level validation for the phenotyping
 * observation import pipeline. Mirrors ValidationEngine's shape
 * (pre-loaded lookup caches + validate*Row returning a structured result)
 * so the same staging/preview/confirm UI patterns can be reused.
 */
class PhenotypingValidationEngine
{
    private array $genotypeCache = [];
    private array $environmentCache = [];
    private array $characteristicCache = [];

    public function __construct(private PhenotypingNormalizationService $normalizer)
    {
        Genotype::whereIn('status', ['active', 'inactive'])
            ->select(['id', 'genotype_code', 'old_code'])
            ->get()
            ->each(function ($g) {
                $this->genotypeCache[strtoupper($g->genotype_code)] = $g->id;
                if ($g->old_code) {
                    $this->genotypeCache[strtoupper($g->old_code)] = $g->id;
                }
            });

        Environment::select(['id', 'environment_code'])
            ->get()
            ->each(fn($e) => $this->environmentCache[strtoupper($e->environment_code)] = $e->id);

        Characteristic::active()
            ->get(['id', 'code', 'decimal_places'])
            ->each(fn($c) => $this->characteristicCache[strtoupper($c->code)] = ['id' => $c->id, 'decimal_places' => $c->decimal_places]);
    }

    /**
     * Validate a single normalized staging row.
     *
     * @param  array $norm  Normalized fields: plot_no, genotype_code, environment_code,
     *                       replication, values (characteristic_code => float|null)
     * @param  array $raw   Raw spreadsheet row, for error messages
     * @param  int   $rowNumber
     * @return array ['status' => 'valid'|'warning'|'invalid',
     *                'errors' => [...], 'warnings' => [...],
     *                'resolved' => ['genotype_id' => ?int, 'environment_id' => ?int]]
     *
     * TODO Phase 2: implement full validation:
     *  - required fields present (plot_no, genotype_code, environment_code, replication)
     *  - genotype_code / environment_code resolve via genotypeCache / environmentCache
     *  - replication is a positive integer
     *  - characteristic values within plausible ranges (warning, not error)
     *  - duplicate (environment_id, season_id, plot_no, replication) within file or DB
     */
    public function validateObservationRow(array $norm, array $raw, int $rowNumber): array
    {
        return [
            'status' => 'pending',
            'errors' => [],
            'warnings' => [],
            'resolved' => [
                'genotype_id' => null,
                'environment_id' => null,
            ],
        ];
    }
}
