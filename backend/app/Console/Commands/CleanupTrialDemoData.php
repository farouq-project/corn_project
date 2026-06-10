<?php

namespace App\Console\Commands;

use App\Models\Trial;
use App\Services\AuditService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Removes the legacy trial/plot/observation demo data (and its
 * dependent disease, schedule, and finance/activity rows) now that
 * the "Data Pengamatan" / "Data Rata-Rata" workflow has replaced
 * plot-level phenotyping.
 *
 * `variety_candidates` and `disease_types` are intentionally left
 * untouched and are not covered by this command.
 */
class CleanupTrialDemoData extends Command
{
    protected $signature = 'phenotyping:cleanup-trial-data {--dry-run : Show row counts that would be deleted without changing anything}';

    protected $description = 'Remove legacy trial/plot/observation demo data after migrating to the new phenotyping workflow';

    /**
     * Tables truncated in full, in dependency order.
     */
    private const FULL_TABLES = [
        'plot_observation_values',
        'plot_observations',
        'disease_scores',
        'disease_evaluations',
        'trial_layouts',
        'trial_plots',
        'trial_blocks',
        'trial_environments',
        'trial_genotypes',
        'trial_researchers',
        'observation_schedules',
    ];

    public function handle(): int
    {
        $counts = [];
        foreach (self::FULL_TABLES as $table) {
            $counts[$table] = DB::table($table)->count();
        }
        $counts['field_activities (trial_id IS NOT NULL)'] = DB::table('field_activities')->whereNotNull('trial_id')->count();
        $counts['expenses (trial_id IS NOT NULL)'] = DB::table('expenses')->whereNotNull('trial_id')->count();
        $counts['trials'] = DB::table('trials')->count();

        $this->table(['Table', 'Rows to delete'], collect($counts)->map(fn ($c, $t) => [$t, $c])->values());

        if ($this->option('dry-run')) {
            $this->info('Dry run — no changes made.');

            return self::SUCCESS;
        }

        if (array_sum($counts) === 0) {
            $this->info('Nothing to clean up.');

            return self::SUCCESS;
        }

        if (!$this->confirm('This will permanently delete the trial/plot/observation demo data shown above. Continue?')) {
            $this->info('Aborted.');

            return self::SUCCESS;
        }

        $firstTrial = Trial::first();

        DB::transaction(function () use ($counts, $firstTrial) {
            foreach (self::FULL_TABLES as $table) {
                DB::table($table)->delete();
            }

            DB::table('field_activities')->whereNotNull('trial_id')->delete();
            DB::table('expenses')->whereNotNull('trial_id')->delete();
            DB::table('trials')->delete();

            if ($firstTrial) {
                AuditService::logAction('trial_demo_data_cleanup', $firstTrial, ['deleted_counts' => $counts]);
            }
        });

        if (!$firstTrial) {
            $this->warn('No trial records existed to attach the audit log entry to; cleanup still completed.');
        }

        $this->info('Cleanup complete.');
        $this->table(['Table', 'Rows deleted'], collect($counts)->map(fn ($c, $t) => [$t, $c])->values());

        return self::SUCCESS;
    }
}
