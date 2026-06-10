<?php

namespace App\Services\Import;

/**
 * Phase 2 scaffolding: normalization helpers for the phenotyping
 * observation import pipeline. Mirrors NormalizationService's
 * pure-function style (input -> normalized output, never throws).
 *
 * Delegates generic normalization (decimals, codes) to the existing
 * NormalizationService so both pipelines stay consistent.
 */
class PhenotypingNormalizationService
{
    public function __construct(private NormalizationService $normalizer) {}

    /**
     * Normalize "No Plot" — free text identifier, trimmed/uppercased
     * for consistent comparison but stored as-is otherwise.
     */
    public function normalizePlotNo(?string $raw): ?string
    {
        if (blank($raw)) return null;

        return trim($raw);
    }

    /**
     * Normalize "Kode Gen" using the existing genotype code normalizer
     * so import lookups match the same conventions as inventory import.
     */
    public function normalizeGenotypeCode(?string $raw): ?string
    {
        return $this->normalizer->normalizeGenotypeCode($raw);
    }

    /**
     * Normalize "R" (replication) to a positive integer.
     */
    public function normalizeReplication(?string $raw): ?int
    {
        return $this->normalizer->normalizeInteger($raw);
    }

    /**
     * Normalize a characteristic cell value to a decimal, honoring
     * the characteristic's configured decimal_places.
     */
    public function normalizeNumericValue(?string $raw, int $decimalPlaces = 2): ?float
    {
        return $this->normalizer->normalizeDecimal($raw, $decimalPlaces);
    }
}
