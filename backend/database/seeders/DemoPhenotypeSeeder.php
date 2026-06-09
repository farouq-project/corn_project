<?php

namespace Database\Seeders;

use App\Models\Genotype;
use App\Models\PlotObservation;
use App\Models\PlotObservationValue;
use App\Models\PhenotypeVariable;
use App\Models\Trial;
use App\Models\TrialBlock;
use App\Models\TrialPlot;
use App\Models\Environment;
use App\Models\User;
use Illuminate\Database\Seeder;

class DemoPhenotypeSeeder extends Seeder
{
    public function run(): void
    {
        $trial = Trial::where('trial_code', 'T-MH2025-D01')->first()
            ?? Trial::first();
        $env = Environment::where('environment_code', 'JTIC-MH2025')->first()
            ?? Environment::first();
        $recorder = User::role('field_researcher')->first();
        $approver = User::role('principal_researcher')->first();

        if (!$trial || !$env || !$recorder) {
            $this->command->warn('Prerequisites missing, skip DemoPhenotypeSeeder.');
            return;
        }

        $variables = PhenotypeVariable::whereIn('variable_code', [
            'PH', 'LN', 'SD', 'CCI', 'DTA', 'DTS', 'ASI',
            'EL', 'ED', 'KRN', 'KPR', 'YIELD', 'DSW', 'DS', 'PS',
        ])->get()->keyBy('variable_code');

        $genotypes = $trial->genotypes()->orderBy('pivot_entry_number')->get();
        if ($genotypes->isEmpty()) {
            $this->command->warn('No genotypes in trial, skip.');
            return;
        }

        // Ensure we have blocks R1, R2, R3
        $blocks = [];
        for ($rep = 1; $rep <= 3; $rep++) {
            $blocks[$rep] = TrialBlock::firstOrCreate(
                ['trial_id' => $trial->id, 'environment_id' => $env->id, 'block_number' => $rep],
                ['block_label' => "R{$rep}",
                 'row_start' => ($rep - 1) * $genotypes->count() + 1,
                 'row_end'   => $rep * $genotypes->count()]
            );
        }

        // Observation sets: per replication, per growth stage
        $stages = [
            ['stage' => 'tasseling_VT', 'dap' => 62,  'date' => '2026-01-15', 'status' => 'approved'],
            ['stage' => 'silking_R1',   'dap' => 65,  'date' => '2026-01-20', 'status' => 'approved'],
            ['stage' => 'dough_R4',     'dap' => 85,  'date' => '2026-02-10', 'status' => 'submitted'],
            ['stage' => 'maturity_R6',  'dap' => 106, 'date' => '2026-03-05', 'status' => 'submitted'],
            ['stage' => 'harvest',      'dap' => 110, 'date' => '2026-03-12', 'status' => 'draft'],
        ];

        // Value ranges per variable per stage
        $valueRanges = [
            'PH'   => [[200, 280], [220, 290], [230, 295], [235, 300], [235, 300]],
            'LN'   => [[10, 14],   [12, 15],   [13, 16],   [14, 16],   [14, 16]],
            'SD'   => [[2.0, 3.5], [2.2, 3.8], [2.3, 4.0], [2.3, 4.0], [2.3, 4.0]],
            'CCI'  => [[38, 52],   [42, 56],   [40, 54],   [35, 50],   [28, 42]],
            'DTA'  => [[60, 68],   [60, 68],   null, null, null],
            'DTS'  => [[62, 71],   [62, 71],   null, null, null],
            'ASI'  => [[1, 5],     [1, 5],     null, null, null],
            'EL'   => [null, null, [15, 22],   [16, 23],   [16, 23]],
            'ED'   => [null, null, [3.5, 5.5], [3.8, 5.8], [3.8, 5.8]],
            'KRN'  => [null, null, [12, 18],   [12, 18],   [12, 18]],
            'KPR'  => [null, null, [28, 42],   [28, 42],   [28, 42]],
            'YIELD'=> [null, null, null,        [5.5, 9.5], [5.5, 9.5]],
            'DSW'  => [null, null, null,        [180, 350], [180, 350]],
            'DS'   => [null, [1, 5], [1, 6],    [1, 7],     [1, 7]],
            'PS'   => [null, [1, 4], [1, 5],    [1, 5],     [1, 5]],
        ];

        $counter = PlotObservation::count();

        foreach ($stages as $si => $stageInfo) {
            // Use replications 1-3
            for ($repIdx = 1; $repIdx <= 3; $repIdx++) {
                $block = $blocks[$repIdx];
                // Pick 5 genotypes per replication per stage
                foreach ($genotypes->slice(0, 5) as $gi => $genotype) {
                    $counter++;

                    $plot = TrialPlot::firstOrCreate(
                        ['trial_id' => $trial->id, 'environment_id' => $env->id,
                         'trial_block_id' => $block->id, 'genotype_id' => $genotype->id],
                        [
                            'plot_code'          => sprintf('T-D01-JTIC-R%d-E%02d', $repIdx, $gi + 1),
                            'entry_number'       => $gi + 1,
                            'plot_number'        => ($repIdx - 1) * 5 + $gi + 1,
                            'row_position'       => ($repIdx - 1) * 5 + $gi + 1,
                            'column_position'    => 1,
                            'randomization_order'=> $gi + 1,
                            'plot_length_m'      => 6,
                            'plot_width_m'       => 3,
                        ]
                    );

                    $obsCode = sprintf('OBS-%04d', $counter);

                    $obs = PlotObservation::firstOrCreate(
                        ['observation_code' => $obsCode],
                        [
                            'trial_plot_id'       => $plot->id,
                            'trial_id'            => $trial->id,
                            'environment_id'      => $env->id,
                            'trial_block_id'      => $block->id,
                            'genotype_id'         => $genotype->id,
                            'observation_date'    => $stageInfo['date'],
                            'growth_stage'        => $stageInfo['stage'],
                            'days_after_planting' => $stageInfo['dap'],
                            'status'              => $stageInfo['status'],
                            'general_notes'       => "Pengamatan stadia {$stageInfo['stage']}, ulangan R{$repIdx}, plot " . ($gi + 1),
                            'total_variables_expected' => count(array_filter(array_column($valueRanges, $si))),
                            'total_variables_filled'   => count(array_filter(array_column($valueRanges, $si))),
                            'recorded_by'         => $recorder->id,
                            'approved_by'         => $stageInfo['status'] === 'approved' ? $approver->id : null,
                            'approved_at'         => $stageInfo['status'] === 'approved' ? now()->subDays(rand(2, 10)) : null,
                        ]
                    );

                    if ($obs->wasRecentlyCreated) {
                        foreach ($valueRanges as $varCode => $ranges) {
                            $range = $ranges[$si] ?? null;
                            if (!$range) continue;
                            $var = $variables[$varCode] ?? null;
                            if (!$var) continue;

                            [$min, $max] = $range;
                            $isInt = in_array($varCode, ['LN', 'KRN', 'KPR']);
                            $value = $isInt
                                ? rand((int)$min, (int)$max)
                                : round($min + (($max - $min) * (mt_rand(0, 10000) / 10000)), 2);

                            // Add genotype effect (higher entry = slightly higher yield potential)
                            if (in_array($varCode, ['YIELD', 'EL', 'PH'])) {
                                $value = round($value * (1 + ($gi * 0.02)), 2);
                            }

                            PlotObservationValue::create([
                                'observation_id' => $obs->id,
                                'variable_id'    => $var->id,
                                'numeric_value'  => $value,
                                'is_missing'     => false,
                            ]);
                        }
                    }
                }
            }
        }

        $total = PlotObservation::count();
        $this->command->info("  Phenotype observations total: {$total}");
    }
}
