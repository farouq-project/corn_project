<?php

namespace App\Services;

use App\Models\Environment;
use App\Models\Genotype;
use App\Models\Trial;
use App\Models\TrialBlock;
use App\Models\TrialLayout;
use App\Models\TrialPlot;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class RcbdService
{
    /**
     * Generate RCBD plot structure for a trial × environment.
     *
     * For 14 genotypes × 3 replications:
     *   - Creates 3 blocks (replications)
     *   - Creates 14 plots per block = 42 total plots
     *   - Randomizes genotype order within each block
     *
     * @param  Trial       $trial
     * @param  Environment $environment
     * @param  array       $genotypes  [['genotype_id' => x, 'entry_number' => y, 'is_check' => bool]]
     * @param  int         $seed       random seed for reproducibility
     * @return array       ['blocks' => [...], 'plots' => [...], 'layout' => [...]]
     */
    public function generateRcbd(
        Trial $trial,
        Environment $environment,
        array $genotypes,
        int $replications,
        array $plotDimensions = [],
        int $seed = 0
    ): array {
        if ($seed === 0) {
            $seed = random_int(1000, 9999);
        }

        mt_srand($seed);

        $createdBlocks = [];
        $createdPlots = [];
        $plotGrid = [];
        $plotCounter = 1;

        for ($rep = 1; $rep <= $replications; $rep++) {
            // Create block
            $block = TrialBlock::create([
                'trial_id' => $trial->id,
                'environment_id' => $environment->id,
                'block_number' => $rep,
                'block_label' => "R{$rep}",
                'row_start' => ($rep - 1) * count($genotypes) + 1,
                'row_end' => $rep * count($genotypes),
            ]);

            $createdBlocks[] = $block;

            // Randomize genotype order within block (Fisher-Yates)
            $randomized = $genotypes;
            $n = count($randomized);
            for ($i = $n - 1; $i > 0; $i--) {
                $j = mt_rand(0, $i);
                [$randomized[$i], $randomized[$j]] = [$randomized[$j], $randomized[$i]];
            }

            $blockRow = [];
            foreach ($randomized as $order => $gEntry) {
                $genotypeId = $gEntry['genotype_id'];
                $entryNumber = $gEntry['entry_number'];
                $isCheck = $gEntry['is_check'] ?? false;

                $plotCode = $this->generatePlotCode($trial, $environment, $rep, $entryNumber);

                $plot = TrialPlot::create([
                    'plot_code' => $plotCode,
                    'trial_id' => $trial->id,
                    'environment_id' => $environment->id,
                    'trial_block_id' => $block->id,
                    'genotype_id' => $genotypeId,
                    'entry_number' => $entryNumber,
                    'is_check' => $isCheck,
                    'plot_number' => $plotCounter,
                    'row_position' => ($rep - 1) * count($genotypes) + $order + 1,
                    'column_position' => 1,
                    'randomization_order' => $order + 1,
                    'plot_length_m' => $plotDimensions['length'] ?? null,
                    'plot_width_m' => $plotDimensions['width'] ?? null,
                    'plant_spacing_cm' => $plotDimensions['plant_spacing'] ?? null,
                    'row_spacing_cm' => $plotDimensions['row_spacing'] ?? null,
                ]);

                $createdPlots[] = $plot;
                $blockRow[] = [
                    'plot_id' => $plot->id,
                    'plot_code' => $plotCode,
                    'plot_number' => $plotCounter,
                    'genotype_id' => $genotypeId,
                    'entry_number' => $entryNumber,
                    'block' => $rep,
                    'is_check' => $isCheck,
                ];
                $plotCounter++;
            }

            $plotGrid[] = $blockRow;
        }

        // Store layout
        $layout = TrialLayout::updateOrCreate(
            ['trial_id' => $trial->id, 'environment_id' => $environment->id],
            [
                'total_rows' => $replications * count($genotypes),
                'total_columns' => 1,
                'layout_direction' => 'row_first',
                'randomization_method' => 'rcbd_random',
                'randomization_seed' => $seed,
                'randomized_at' => now(),
                'plot_grid' => $plotGrid,
            ]
        );

        // Update trial stats
        $trial->increment('num_genotypes', 0); // trigger update check
        $trial->update([
            'num_genotypes' => count($genotypes),
            'num_locations' => $trial->environments()->count(),
        ]);

        return [
            'blocks' => $createdBlocks,
            'plots' => $createdPlots,
            'layout' => $layout,
            'seed' => $seed,
            'total_plots' => count($createdPlots),
            'summary' => "{$replications} replications × " . count($genotypes) . " genotypes = " . count($createdPlots) . " plots",
        ];
    }

    /**
     * Get plot matrix for display: [block][entry] = plot
     */
    public function getPlotMatrix(Trial $trial, Environment $environment): Collection
    {
        $plots = TrialPlot::with(['genotype', 'block'])
            ->where('trial_id', $trial->id)
            ->where('environment_id', $environment->id)
            ->orderBy('trial_block_id')
            ->orderBy('randomization_order')
            ->get();

        return $plots->groupBy('trial_block_id')->map(function ($blockPlots, $blockId) {
            return $blockPlots->sortBy('randomization_order')->values();
        });
    }

    /**
     * Calculate summary statistics for ANOVA structure check.
     * Returns the design balance (equal reps per genotype).
     */
    public function checkDesignBalance(Trial $trial): array
    {
        $plots = TrialPlot::where('trial_id', $trial->id)
            ->selectRaw('genotype_id, environment_id, count(*) as rep_count')
            ->groupBy('genotype_id', 'environment_id')
            ->get();

        $repCounts = $plots->pluck('rep_count')->unique();
        $isBalanced = $repCounts->count() === 1;

        return [
            'is_balanced' => $isBalanced,
            'replications_per_genotype' => $plots->groupBy('genotype_id')->map->count(),
            'environments' => $plots->pluck('environment_id')->unique()->count(),
            'total_plots' => TrialPlot::where('trial_id', $trial->id)->count(),
        ];
    }

    private function generatePlotCode(Trial $trial, Environment $environment, int $rep, int $entry): string
    {
        $trialCode = Str::upper(Str::substr($trial->trial_code, 0, 6));
        $locCode = Str::upper(Str::substr($environment->environment_code, 0, 4));
        return "{$trialCode}-{$locCode}-R{$rep}-E" . str_pad($entry, 2, '0', STR_PAD_LEFT);
    }
}
