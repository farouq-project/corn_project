<?php

namespace App\Services\Import;

use App\Models\Characteristic;
use App\Models\Environment;
use App\Models\Genotype;
use App\Models\ObservationRecord;

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

        Environment::select(['id', 'environment_code', 'name'])
            ->get()
            ->each(function ($e) {
                $this->environmentCache[strtoupper($e->environment_code)] = $e->id;
                // Also index by user-defined name so "NORMAL" matches a Lingkungan named "Normal"
                if ($e->name) {
                    $this->environmentCache[strtoupper($e->name)] = $e->id;
                }
            });

        Characteristic::active()
            ->get(['id', 'code', 'decimal_places'])
            ->each(fn($c) => $this->characteristicCache[strtoupper($c->code)] = [
                'id' => $c->id,
                'decimal_places' => $c->decimal_places,
            ]);
    }

    /**
     * Validate a single normalized staging row.
     * Returns ['status' => 'valid'|'warning'|'invalid', 'errors' => [...], 'warnings' => [...], 'resolved' => [...]]
     */
    public function validateObservationRow(array $norm, array $raw, int $rowNumber): array
    {
        $errors = [];
        $warnings = [];

        // Required: plot_no
        if (blank($norm['plot_no'] ?? null)) {
            $errors[] = "Baris {$rowNumber}: No Plot kosong.";
        }

        // Required: genotype_code must resolve
        $genotypeId = null;
        if (blank($norm['genotype_code'] ?? null)) {
            $errors[] = "Baris {$rowNumber}: Kode Genotipe kosong.";
        } else {
            $genotypeId = $this->genotypeCache[strtoupper($norm['genotype_code'])] ?? null;
            if (!$genotypeId) {
                $errors[] = "Baris {$rowNumber}: Genotipe '{$norm['genotype_code']}' tidak ditemukan.";
            }
        }

        // Required: environment_code must resolve (warn rather than error — confirmImport auto-creates if missing)
        $environmentId = null;
        if (blank($norm['environment_code'] ?? null)) {
            $errors[] = "Baris {$rowNumber}: Environment kosong.";
        } else {
            $environmentId = $this->environmentCache[strtoupper($norm['environment_code'])] ?? null;
            if (!$environmentId) {
                // Warn, not error — confirmImport will create a Lokasi with this name if it doesn't exist
                $warnings[] = "Baris {$rowNumber}: Lokasi '{$norm['environment_code']}' belum ada di Master Data — akan dibuat otomatis saat konfirmasi.";
            }
        }

        // Required: replication must be positive integer
        $replication = $norm['replication'] ?? null;
        if ($replication === null || $replication < 1) {
            $errors[] = "Baris {$rowNumber}: Ulangan (R) harus berupa bilangan bulat positif.";
        }

        // Warn about characteristic codes not in master data
        foreach (array_keys($norm['values'] ?? []) as $code) {
            if (!isset($this->characteristicCache[strtoupper($code)])) {
                $warnings[] = "Baris {$rowNumber}: Kolom '{$code}' tidak cocok dengan karakter aktif manapun — akan diabaikan.";
            }
        }

        // Warn about duplicate in DB
        if ($genotypeId && $environmentId && $replication && $norm['plot_no']) {
            $existsInDb = ObservationRecord::where('environment_id', $environmentId)
                ->where('plot_no', $norm['plot_no'])
                ->where('replication', $replication)
                ->exists();
            if ($existsInDb) {
                $warnings[] = "Baris {$rowNumber}: Plot '{$norm['plot_no']}' R{$replication} sudah ada — nilai akan ditimpa.";
            }
        }

        $status = count($errors) > 0 ? 'invalid' : (count($warnings) > 0 ? 'warning' : 'valid');

        return [
            'status' => $status,
            'errors' => $errors,
            'warnings' => $warnings,
            'resolved' => [
                'genotype_id' => $genotypeId,
                'environment_id' => $environmentId,
            ],
        ];
    }
}
