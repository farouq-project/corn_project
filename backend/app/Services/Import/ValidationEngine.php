<?php

namespace App\Services\Import;

use App\Models\Genotype;
use App\Models\Season;
use App\Models\SeedInventory;
use App\Models\StorageUnit;
use App\Models\Trial;

/**
 * Row-level validation engine for the import pipeline.
 *
 * Operates on normalized data.
 * Returns structured error/warning arrays compatible with staging table JSON fields.
 */
class ValidationEngine
{
    private array $errors = [];
    private array $warnings = [];

    // Caches to avoid N+1 during batch validation
    private array $genotypeCache = [];
    private array $storageUnitCache = [];
    private array $seasonCache = [];
    private array $trialCache = [];
    private array $existingPackageCodes = [];
    private array $filePackageCodes = [];

    public function __construct(private NormalizationService $normalizer)
    {
        // Pre-load all genotype codes for O(1) lookup
        Genotype::whereIn('status', ['active', 'inactive'])
            ->select(['id', 'genotype_code', 'old_code'])
            ->get()
            ->each(function ($g) {
                $this->genotypeCache[strtoupper($g->genotype_code)] = $g->id;
                if ($g->old_code) {
                    $this->genotypeCache[strtoupper($g->old_code)] = $g->id;
                }
            });

        StorageUnit::where('is_active', true)
            ->select(['id', 'unit_code'])
            ->get()
            ->each(fn($u) => $this->storageUnitCache[strtoupper($u->unit_code)] = $u->id);

        Season::select(['id', 'season_code'])
            ->get()
            ->each(fn($s) => $this->seasonCache[strtoupper($s->season_code)] = $s->id);

        Trial::select(['id', 'trial_code'])
            ->get()
            ->each(fn($t) => $this->trialCache[strtoupper($t->trial_code)] = $t->id);

        // Load all existing package codes from DB
        $this->existingPackageCodes = SeedInventory::withTrashed()
            ->pluck('package_code')
            ->map('strtoupper')
            ->flip()
            ->toArray();
    }

    /**
     * Register all package codes from the file before validation
     * so we can detect within-file duplicates.
     */
    public function registerFileCodes(array $packageCodes): void
    {
        $seen = [];
        foreach ($packageCodes as $code) {
            $upper = strtoupper($code ?? '');
            if ($upper === '') continue;
            $seen[$upper] = ($seen[$upper] ?? 0) + 1;
        }
        $this->filePackageCodes = $seen;
    }

    /**
     * Validate a single normalized staging row.
     *
     * @param  array $norm  The norm_* fields from staging
     * @param  array $raw   The raw_* fields for context in error messages
     * @param  int   $rowNumber
     * @return array ['status' => 'valid'|'warning'|'invalid'|'duplicate',
     *                'errors' => [...], 'warnings' => [...],
     *                'resolved' => [...resolved FK ids...]]
     */
    public function validateInventoryRow(array $norm, array $raw, int $rowNumber): array
    {
        $this->errors = [];
        $this->warnings = [];
        $resolved = [];
        $isDuplicateInFile = false;
        $isDuplicateInDb = false;

        // ── REQUIRED FIELDS ─────────────────────────────────────────────────

        $packageCode = $norm['package_code'] ?? null;
        if (empty($packageCode)) {
            $this->addError('package_code', 'required', 'Kode paket (package_code) wajib diisi');
        } else {
            $upper = strtoupper($packageCode);

            // Within-file duplicate
            if (($this->filePackageCodes[$upper] ?? 0) > 1) {
                $isDuplicateInFile = true;
                $this->addError('package_code', 'duplicate_in_file',
                    "Kode paket '{$packageCode}' muncul lebih dari satu kali dalam file ini");
            }

            // DB duplicate
            if (isset($this->existingPackageCodes[$upper])) {
                $isDuplicateInDb = true;
                $this->addError('package_code', 'duplicate_in_db',
                    "Kode paket '{$packageCode}' sudah ada dalam database");
            }
        }

        // ── GENOTYPE RESOLUTION ──────────────────────────────────────────────

        $genotypeId = null;
        $normGenotypeCode = $norm['genotype_code'] ?? null;

        if (empty($normGenotypeCode)) {
            $this->addError('genotype_code', 'required', 'Kode genotipe wajib diisi');
        } else {
            $candidates = $this->normalizer->genotypeCodeCandidates($raw['genotype_code'] ?? $normGenotypeCode);
            foreach ($candidates as $candidate) {
                if (isset($this->genotypeCache[strtoupper($candidate)])) {
                    $genotypeId = $this->genotypeCache[strtoupper($candidate)];
                    $resolved['genotype_id'] = $genotypeId;
                    break;
                }
            }

            if (!$genotypeId) {
                $this->addError('genotype_code', 'not_found',
                    "Kode genotipe '{$raw['genotype_code']}' tidak ditemukan dalam master data. " .
                    "Kandidat yang dicoba: " . implode(', ', $candidates));
            }
        }

        // ── STORAGE UNIT RESOLUTION ──────────────────────────────────────────

        $storageUnitId = null;
        $normUnitCode = $norm['storage_unit_code'] ?? null;

        if (empty($normUnitCode)) {
            $this->addError('storage_unit_code', 'required', 'Kode unit penyimpanan wajib diisi');
        } else {
            $upper = strtoupper($normUnitCode);
            if (isset($this->storageUnitCache[$upper])) {
                $storageUnitId = $this->storageUnitCache[$upper];
                $resolved['storage_unit_id'] = $storageUnitId;
            } else {
                $this->addError('storage_unit_code', 'not_found',
                    "Unit penyimpanan '{$raw['storage_unit_code']}' tidak ditemukan. " .
                    "Unit yang tersedia: " . implode(', ', array_keys($this->storageUnitCache)));
            }
        }

        // ── DATE VALIDATION ──────────────────────────────────────────────────

        $storageDate = $norm['storage_date'] ?? null;
        if (empty($storageDate)) {
            // Not required for historical import — default to today
            $this->addWarning('storage_date', 'defaulted',
                "Tanggal penyimpanan tidak diisi — akan diisi tanggal hari ini (" . now()->format('Y-m-d') . ")");
        } elseif (!$this->isValidDate($storageDate)) {
            $this->addError('storage_date', 'invalid_date',
                "Format tanggal penyimpanan tidak valid: '{$raw['storage_date']}'. Gunakan format DD/MM/YYYY atau YYYY-MM-DD");
        }

        // Harvest date optional, but must make sense
        $harvestDate = $norm['harvest_date'] ?? null;
        if ($harvestDate && $storageDate && $harvestDate > $storageDate) {
            $this->addWarning('harvest_date', 'date_order',
                "Tanggal panen ({$harvestDate}) lebih baru dari tanggal penyimpanan ({$storageDate})");
        }

        // Expiry date must be after storage date
        $expiryDate = $norm['expiry_date'] ?? null;
        if ($expiryDate && $storageDate && $expiryDate < $storageDate) {
            $this->addError('expiry_date', 'before_storage',
                "Tanggal kadaluarsa ({$expiryDate}) sebelum tanggal penyimpanan ({$storageDate})");
        }

        // ── WEIGHT VALIDATION ─────────────────────────────────────────────────

        $initialWeight = $norm['initial_weight_g'] ?? null;
        $remainingWeight = $norm['remaining_weight_g'] ?? null;

        if ($initialWeight === null) {
            // Not required — default to 0 for historical import (unknown weight)
            $this->addWarning('initial_weight_g', 'defaulted',
                "Berat awal tidak diisi — diset ke 0g. Perbarui setelah penimbangan ulang.");
        } elseif ($initialWeight < 0) {
            $this->addError('initial_weight_g', 'negative',
                "Berat awal tidak boleh negatif: {$raw['initial_weight_g']}");
        } elseif ($initialWeight > 50000) {
            $this->addWarning('initial_weight_g', 'unusually_large',
                "Berat awal sangat besar ({$initialWeight}g = " . round($initialWeight/1000, 1) . "kg). Harap konfirmasi satuan.");
        }

        if ($remainingWeight === null) {
            // Default remaining = initial if not provided
            $this->addWarning('remaining_weight_g', 'defaulted',
                "Berat sisa tidak diisi — diasumsikan sama dengan berat awal");
        } elseif ($remainingWeight < 0) {
            $this->addError('remaining_weight_g', 'negative',
                "Berat sisa tidak boleh negatif: {$raw['remaining_weight_g']}");
        } elseif ($initialWeight !== null && $remainingWeight > $initialWeight) {
            $this->addError('remaining_weight_g', 'exceeds_initial',
                "Berat sisa ({$remainingWeight}g) melebihi berat awal ({$initialWeight}g)");
        }

        // ── MOISTURE VALIDATION ───────────────────────────────────────────────

        $moisture = $norm['moisture_content'] ?? null;
        if ($moisture !== null) {
            if ($moisture < 0 || $moisture > 100) {
                $this->addError('moisture_content', 'out_of_range',
                    "Kadar air harus antara 0–100%, ditemukan: {$raw['moisture_content']}");
            } elseif ($moisture < 8) {
                $this->addWarning('moisture_content', 'unusually_low',
                    "Kadar air sangat rendah ({$moisture}%). Pastikan satuan benar.");
            } elseif ($moisture > 14) {
                $this->addWarning('moisture_content', 'high_moisture',
                    "Kadar air {$moisture}% melebihi batas aman (14%). Benih berisiko.");
            }
        }

        // ── GERMINATION VALIDATION ────────────────────────────────────────────

        $germination = $norm['germination_percentage'] ?? null;
        if ($germination !== null) {
            if ($germination < 0 || $germination > 100) {
                $this->addError('germination_percentage', 'out_of_range',
                    "Daya kecambah harus 0–100%, ditemukan: {$raw['germination_percentage']}");
            } elseif ($germination < 70) {
                $this->addWarning('germination_percentage', 'low_germination',
                    "Daya kecambah rendah ({$germination}%). Di bawah standar benih bersertifikat (70%).");
            }
        }

        // ── STATUS VALIDATION ─────────────────────────────────────────────────

        $status = $norm['storage_status'] ?? null;
        if (empty($status)) {
            $this->addWarning('storage_status', 'defaulted',
                "Status penyimpanan tidak diisi — diatur ke 'good'");
        } elseif (!in_array($status, ['good', 'warning', 'critical', 'expired', 'depleted', 'discarded'])) {
            $this->addError('storage_status', 'invalid_enum',
                "Status tidak valid: '{$raw['storage_status']}'. Nilai yang diterima: good, warning, critical, expired, depleted, discarded");
        }

        // ── OPTIONAL FK RESOLUTION ────────────────────────────────────────────

        $seasonCode = $norm['season_code'] ?? null;
        if ($seasonCode) {
            $upper = strtoupper($seasonCode);
            if (isset($this->seasonCache[$upper])) {
                $resolved['season_id'] = $this->seasonCache[$upper];
            } else {
                $this->addWarning('season_code', 'not_found',
                    "Musim '{$raw['season_code']}' tidak ditemukan — kolom season_id akan dikosongkan");
            }
        }

        $trialCode = $norm['source_trial_code'] ?? null;
        if ($trialCode) {
            $upper = strtoupper($trialCode);
            if (isset($this->trialCache[$upper])) {
                $resolved['source_trial_id'] = $this->trialCache[$upper];
            } else {
                $this->addWarning('source_trial_code', 'not_found',
                    "Trial '{$raw['source_trial_code']}' tidak ditemukan — source_trial_id akan dikosongkan");
            }
        }

        // ── DETERMINE FINAL STATUS ────────────────────────────────────────────

        if ($isDuplicateInFile || $isDuplicateInDb) {
            $status = 'duplicate';
        } elseif (!empty($this->errors)) {
            $status = 'invalid';
        } elseif (!empty($this->warnings)) {
            $status = 'warning';
        } else {
            $status = 'valid';
        }

        return [
            'status' => $status,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'resolved' => $resolved,
            'is_duplicate_in_file' => $isDuplicateInFile,
            'is_duplicate_in_db' => $isDuplicateInDb,
        ];
    }

    /**
     * Validate a storage unit row.
     */
    public function validateStorageUnitRow(array $norm, array $raw, int $rowNumber): array
    {
        $this->errors = [];
        $this->warnings = [];
        $isDuplicateInDb = false;

        $unitCode = $norm['unit_code'] ?? null;
        if (empty($unitCode)) {
            $this->addError('unit_code', 'required', 'Kode unit wajib diisi');
        } else {
            $upper = strtoupper($unitCode);
            if (isset($this->storageUnitCache[$upper])) {
                $isDuplicateInDb = true;
                $this->addError('unit_code', 'duplicate_in_db',
                    "Unit '{$unitCode}' sudah ada dalam database");
            }
        }

        if (empty($norm['unit_name'])) {
            $this->addError('unit_name', 'required', 'Nama unit wajib diisi');
        }

        $validTypes = ['refrigerator', 'freezer', 'cold_room', 'dry_room', 'cabinet', 'shelf'];
        if (!in_array($norm['unit_type'] ?? '', $validTypes)) {
            $this->addError('unit_type', 'invalid_enum',
                "Tipe unit tidak valid: '{$raw['unit_type']}'. Nilai: " . implode(', ', $validTypes));
        }

        // Temperature range sanity
        $tMin = $norm['temperature_min'] ?? null;
        $tMax = $norm['temperature_max'] ?? null;
        if ($tMin !== null && $tMax !== null && $tMin > $tMax) {
            $this->addError('temperature', 'invalid_range',
                "Suhu minimum ({$tMin}°C) lebih besar dari suhu maksimum ({$tMax}°C)");
        }

        $status = $isDuplicateInDb ? 'duplicate'
            : (!empty($this->errors) ? 'invalid'
            : (!empty($this->warnings) ? 'warning' : 'valid'));

        return [
            'status' => $status,
            'errors' => $this->errors,
            'warnings' => $this->warnings,
            'resolved' => [],
            'is_duplicate_in_file' => false,
            'is_duplicate_in_db' => $isDuplicateInDb,
        ];
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private function addError(string $field, string $rule, string $message): void
    {
        $this->errors[] = compact('field', 'rule', 'message');
    }

    private function addWarning(string $field, string $rule, string $message): void
    {
        $this->warnings[] = compact('field', 'rule', 'message');
    }

    private function isValidDate(?string $date): bool
    {
        if (!$date) return false;
        try {
            \Carbon\Carbon::parse($date);
            return true;
        } catch (\Exception) {
            return false;
        }
    }
}
