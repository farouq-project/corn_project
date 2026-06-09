<?php

namespace App\Services\Import;

use Carbon\Carbon;
use Carbon\Exceptions\InvalidFormatException;

/**
 * Reusable normalization functions for the import pipeline.
 *
 * All methods are pure functions: input → normalized output.
 * They never throw — they return null on unrecoverable input.
 */
class NormalizationService
{
    // ── Genotype Code ─────────────────────────────────────────────────────────

    /**
     * Normalize genotype codes from various field formats.
     *
     * Input variations observed in UNPAD spreadsheets:
     *   "HJ01", "HJ-01", "HJ_01", "HJ UNPAD 01", "hj-unpad-01"
     *   "UB-D001", "UBD-001", " G7 ", "Galur 7"
     *
     * Strategy: uppercase → collapse separators → strip redundant spaces.
     * Does NOT enforce a specific format — returns cleaned string for DB lookup.
     */
    public function normalizeGenotypeCode(string|null $raw): ?string
    {
        if (blank($raw)) return null;

        $code = trim($raw);
        $code = strtoupper($code);

        // Collapse all whitespace, underscores to single dash
        $code = preg_replace('/[\s_]+/', '-', $code);

        // Collapse multiple dashes
        $code = preg_replace('/-+/', '-', $code);

        // Strip leading/trailing dashes
        $code = trim($code, '-');

        return $code ?: null;
    }

    /**
     * Try multiple normalizations to find a DB match.
     * Returns list of candidate codes to try in order.
     */
    public function genotypeCodeCandidates(string|null $raw): array
    {
        if (blank($raw)) return [];

        $normalized = $this->normalizeGenotypeCode($raw);
        if (!$normalized) return [];

        $candidates = [$normalized];

        // Also try without dashes
        $noDash = str_replace('-', '', $normalized);
        if ($noDash !== $normalized) $candidates[] = $noDash;

        // Also try original trimmed uppercase
        $plain = strtoupper(trim($raw));
        if (!in_array($plain, $candidates)) $candidates[] = $plain;

        return array_unique($candidates);
    }

    // ── Storage Unit Code ─────────────────────────────────────────────────────

    public function normalizeStorageUnitCode(string|null $raw): ?string
    {
        if (blank($raw)) return null;
        return strtoupper(preg_replace('/\s+/', '-', trim($raw)));
    }

    // ── Season Code ───────────────────────────────────────────────────────────

    public function normalizeSeasonCode(string|null $raw): ?string
    {
        if (blank($raw)) return null;
        return strtoupper(trim(preg_replace('/\s+/', '', $raw)));
    }

    // ── Decimal / Numeric ─────────────────────────────────────────────────────

    /**
     * Normalize decimal values from messy spreadsheet inputs.
     *
     * Handles:
     *   "14,5"     → 14.5   (Indonesian comma decimal separator)
     *   "14 %"     → 14.0
     *   "KA 14.5"  → 14.5
     *   "14.500"   → 14.5   (European thousands separator)
     *   "≈ 85"     → 85.0
     *   ""         → null
     */
    public function normalizeDecimal(string|null $raw, int $decimals = 2): ?float
    {
        if (blank($raw)) return null;

        $cleaned = $raw;

        // Remove common prefix labels (KA, MC, %, etc.)
        $cleaned = preg_replace('/^[A-Za-z\s%≈~≤≥]+/', '', $cleaned);
        $cleaned = preg_replace('/[A-Za-z%\s]+$/', '', $cleaned);

        // Trim
        $cleaned = trim($cleaned);

        if ($cleaned === '' || $cleaned === '-') return null;

        // Detect Indonesian/European comma as decimal: "14,5" → "14.5"
        // But NOT "1.500,00" (European thousands) — detect by position of last sep
        $lastComma = strrpos($cleaned, ',');
        $lastDot = strrpos($cleaned, '.');

        if ($lastComma !== false && $lastDot !== false) {
            // Both present — comma after dot means comma is decimal: 1.500,50
            if ($lastComma > $lastDot) {
                $cleaned = str_replace('.', '', $cleaned);
                $cleaned = str_replace(',', '.', $cleaned);
            } else {
                // dot after comma means dot is decimal: 1,500.50
                $cleaned = str_replace(',', '', $cleaned);
            }
        } elseif ($lastComma !== false) {
            // Only comma — treat as decimal if ≤ 2 digits after it
            $afterComma = substr($cleaned, $lastComma + 1);
            if (strlen($afterComma) <= 2) {
                $cleaned = str_replace(',', '.', $cleaned);
            } else {
                // Thousands separator
                $cleaned = str_replace(',', '', $cleaned);
            }
        }

        if (!is_numeric($cleaned)) return null;

        return round((float) $cleaned, $decimals);
    }

    public function normalizeInteger(string|null $raw): ?int
    {
        $decimal = $this->normalizeDecimal($raw, 0);
        return $decimal !== null ? (int) $decimal : null;
    }

    // ── Date ──────────────────────────────────────────────────────────────────

    /**
     * Normalize dates from spreadsheet hell.
     *
     * Handles:
     *   "14/05/2026"   DD/MM/YYYY (Indonesian standard)
     *   "2026-05-14"   ISO (already correct)
     *   "14-05-2026"   DD-MM-YYYY
     *   "14 Mei 2026"  Indonesian month name
     *   "May 14, 2026" English
     *   Excel serial   44930 (days since 1900-01-01)
     *   "2026/05"      partial — rejected
     */
    public function normalizeDate(string|null $raw): ?string
    {
        if (blank($raw)) return null;

        $cleaned = trim($raw);

        // Excel numeric date serial
        if (is_numeric($cleaned)) {
            $serial = (int) $cleaned;
            if ($serial > 1000 && $serial < 100000) {
                try {
                    $date = Carbon::createFromFormat('Y-m-d', '1899-12-30')->addDays($serial);
                    return $date->format('Y-m-d');
                } catch (\Exception) {}
            }
            return null; // bare number that isn't a serial
        }

        // Indonesian month names
        $idMonths = [
            'januari' => '01', 'februari' => '02', 'maret' => '03',
            'april' => '04', 'mei' => '05', 'juni' => '06',
            'juli' => '07', 'agustus' => '08', 'september' => '09',
            'oktober' => '10', 'november' => '11', 'desember' => '12',
        ];

        $lower = strtolower($cleaned);
        foreach ($idMonths as $name => $num) {
            if (str_contains($lower, $name)) {
                $cleaned = str_ireplace($name, $num, $lower);
                break;
            }
        }

        // Try parsing with Carbon using multiple formats
        $formats = [
            'Y-m-d', 'd/m/Y', 'd-m-Y', 'd/m/y', 'm/d/Y',
            'Y/m/d', 'd.m.Y', 'F j, Y', 'j F Y', 'd n Y',
            'd/n/Y', 'Y-m', 'n/Y',
        ];

        foreach ($formats as $format) {
            try {
                $parsed = Carbon::createFromFormat($format, trim($cleaned));
                // Sanity check: year should be between 1990 and 2099
                if ($parsed->year >= 1990 && $parsed->year <= 2099) {
                    return $parsed->format('Y-m-d');
                }
            } catch (\Exception) {
                continue;
            }
        }

        // Last resort: Carbon's flexible parse
        try {
            $parsed = Carbon::parse($cleaned);
            if ($parsed->year >= 1990 && $parsed->year <= 2099) {
                return $parsed->format('Y-m-d');
            }
        } catch (\Exception) {}

        return null;
    }

    // ── Storage Status ────────────────────────────────────────────────────────

    /**
     * Map raw status values to our ENUM.
     * Handles Indonesian labels, typos, and old system values.
     */
    public function normalizeStorageStatus(string|null $raw): ?string
    {
        if (blank($raw)) return 'good'; // safe default

        $map = [
            // Direct matches
            'good'      => 'good',
            'warning'   => 'warning',
            'critical'  => 'critical',
            'expired'   => 'expired',
            'depleted'  => 'depleted',
            'discarded' => 'discarded',

            // Indonesian
            'baik'        => 'good',
            'bagus'       => 'good',
            'ok'          => 'good',
            'normal'      => 'good',
            'peringatan'  => 'warning',
            'waspada'     => 'warning',
            'kritis'      => 'critical',
            'bahaya'      => 'critical',
            'kadaluarsa'  => 'expired',
            'kedaluwarsa' => 'expired',
            'exp'         => 'expired',
            'habis'       => 'depleted',
            'kosong'      => 'depleted',
            'buang'       => 'discarded',
            'dibuang'     => 'discarded',
            'rusak'       => 'discarded',

            // Old system codes
            'g' => 'good',
            'w' => 'warning',
            'c' => 'critical',
            'e' => 'expired',
            'd' => 'depleted',
            'x' => 'discarded',
            '1' => 'good',
            '2' => 'warning',
            '3' => 'critical',
        ];

        $key = strtolower(trim($raw));
        return $map[$key] ?? null;
    }

    // ── Storage Unit Type ─────────────────────────────────────────────────────

    public function normalizeUnitType(string|null $raw): ?string
    {
        if (blank($raw)) return null;

        $map = [
            'refrigerator' => 'refrigerator',
            'kulkas'       => 'refrigerator',
            'lemari es'    => 'refrigerator',
            'fridge'       => 'refrigerator',
            'freezer'      => 'freezer',
            'cold room'    => 'cold_room',
            'cold_room'    => 'cold_room',
            'ruang dingin' => 'cold_room',
            'dry room'     => 'dry_room',
            'dry_room'     => 'dry_room',
            'ruang kering' => 'dry_room',
            'cabinet'      => 'cabinet',
            'kabinet'      => 'cabinet',
            'lemari'       => 'cabinet',
            'shelf'        => 'shelf',
            'rak'          => 'shelf',
        ];

        $key = strtolower(trim($raw));
        return $map[$key] ?? null;
    }

    // ── Boolean ───────────────────────────────────────────────────────────────

    public function normalizeBoolean(string|null $raw): ?bool
    {
        if (blank($raw)) return null;

        $truthyValues = ['1', 'y', 'yes', 'true', 'aktif', 'active', 'ya', 'iya', 'benar'];
        $falsyValues  = ['0', 'n', 'no', 'false', 'tidak aktif', 'inactive', 'tidak', 'salah'];

        $key = strtolower(trim($raw));

        if (in_array($key, $truthyValues)) return true;
        if (in_array($key, $falsyValues)) return false;

        return null;
    }

    // ── Package Code ──────────────────────────────────────────────────────────

    public function normalizePackageCode(string|null $raw): ?string
    {
        if (blank($raw)) return null;
        // Uppercase, remove surrounding whitespace, collapse internal spaces to dash
        $code = strtoupper(trim($raw));
        $code = preg_replace('/\s+/', '-', $code);
        return $code ?: null;
    }

    // ── Weight ────────────────────────────────────────────────────────────────

    /**
     * Normalize weight strings to grams.
     * Converts kg → g automatically if unit suffix is present.
     *
     * "500 g"  → 500.00
     * "0.5 kg" → 500.00
     * "500"    → 500.00 (assumed grams)
     * "500gr"  → 500.00
     */
    public function normalizeWeightToGrams(string|null $raw): ?float
    {
        if (blank($raw)) return null;

        $cleaned = trim($raw);
        $isKg = (bool) preg_match('/kg/i', $cleaned);

        // Strip units
        $numeric = preg_replace('/[A-Za-z\s%]+/', '', $cleaned);
        $value = $this->normalizeDecimal($numeric);

        if ($value === null) return null;

        return $isKg ? round($value * 1000, 2) : $value;
    }
}
