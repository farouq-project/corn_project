<?php

use App\Http\Controllers\Api\V1\AuditController;
use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\DashboardController;
use App\Http\Controllers\Api\V1\DiseaseController;
use App\Http\Controllers\Api\V1\InventoryImportController;
use App\Http\Controllers\Api\V1\EnvironmentController;
use App\Http\Controllers\Api\V1\ExpenseController;
use App\Http\Controllers\Api\V1\FieldActivityController;
use App\Http\Controllers\Api\V1\GenotypeController;
use App\Http\Controllers\Api\V1\MasterDataController;
use App\Http\Controllers\Api\V1\CharacteristicController;
use App\Http\Controllers\Api\V1\ObservationRecordController;
use App\Http\Controllers\Api\V1\ObservationScheduleController;
use App\Http\Controllers\Api\V1\PhenotypeController;
use App\Http\Controllers\Api\V1\PhenotypingImportController;
use App\Http\Controllers\Api\V1\PlotObservationController;
use App\Http\Controllers\Api\V1\ResearchDocumentController;
use App\Http\Controllers\Api\V1\StorageController;
use App\Http\Controllers\Api\V1\TrialController;
use App\Http\Controllers\Api\V1\TrialPlotController;
use App\Http\Controllers\Api\V1\UserController;
use App\Http\Controllers\Api\V1\EnvironmentConditionController;
use App\Http\Controllers\Api\V1\MediaController;
use App\Http\Controllers\Api\V1\StorageMonitorController;
use App\Http\Controllers\Api\V1\VarietyCandidateController;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function () {

    // Public auth routes
    Route::prefix('auth')->group(function () {
        Route::post('login', [AuthController::class, 'login']);
    });

    // Public downloads (no auth needed — static templates only)
    Route::get('import/template', [InventoryImportController::class, 'downloadTemplate']);
    Route::get('genotypes/import-template', [GenotypeController::class, 'downloadTemplate']);
    Route::get('phenotyping/import/template', [PhenotypingImportController::class, 'downloadTemplate']);
    Route::get('phenotyping/characteristics/import/template', [CharacteristicController::class, 'downloadTemplate']);
    Route::get('storage-monitor/template', [StorageMonitorController::class, 'downloadTemplate']);

    // Protected routes
    Route::middleware('auth:sanctum')->group(function () {

        // General file upload (receipts, activity photos, etc.)
        Route::post('media/upload', [MediaController::class, 'upload']);

        // Environment conditions (treatment types: Normal, Shading, Drought, etc.)
        Route::get('environment-conditions', [EnvironmentConditionController::class, 'index']);
        Route::post('environment-conditions', [EnvironmentConditionController::class, 'store']);
        Route::put('environment-conditions/{environmentCondition}', [EnvironmentConditionController::class, 'update']);
        Route::delete('environment-conditions/{environmentCondition}', [EnvironmentConditionController::class, 'destroy']);

        // Storage Monitor
        Route::get('storage-monitor', [StorageMonitorController::class, 'index']);
        Route::post('storage-monitor', [StorageMonitorController::class, 'store']);
        Route::delete('storage-monitor/{storageMonitorEntry}', [StorageMonitorController::class, 'destroy']);
        Route::put('storage-monitor/{storageMonitorEntry}', [StorageMonitorController::class, 'update']);
        Route::post('storage-monitor/import', [StorageMonitorController::class, 'import']);

        // Auth
        Route::prefix('auth')->group(function () {
            Route::post('logout', [AuthController::class, 'logout']);
            Route::get('me', [AuthController::class, 'me']);
            Route::put('profile', [AuthController::class, 'updateProfile']);
            Route::post('change-password', [AuthController::class, 'changePassword']);
        });

        // Dashboard
        Route::get('dashboard', [DashboardController::class, 'index']);
        Route::get('dashboard/analytics', [DashboardController::class, 'analytics']);

        // User Management
        Route::apiResource('users', UserController::class);
        Route::post('users/{user}/reset-password', [UserController::class, 'resetPassword']);

        // Master Data - Seasons
        Route::get('seasons', [MasterDataController::class, 'seasonIndex']);
        Route::post('seasons', [MasterDataController::class, 'seasonStore']);
        Route::put('seasons/{season}', [MasterDataController::class, 'seasonUpdate']);
        Route::delete('seasons/{season}', [MasterDataController::class, 'seasonDestroy']);

        // Master Data - Locations
        Route::get('locations', [MasterDataController::class, 'locationIndex']);
        Route::post('locations', [MasterDataController::class, 'locationStore']);
        Route::put('locations/{location}', [MasterDataController::class, 'locationUpdate']);
        Route::delete('locations/{location}', [MasterDataController::class, 'locationDestroy']);

        // Master Data - Trial Types
        Route::get('trial-types', [MasterDataController::class, 'trialTypeIndex']);
        Route::post('trial-types', [MasterDataController::class, 'trialTypeStore']);

        // Genotypes — explicit routes MUST come before apiResource
        // (apiResource registers a wildcard {genotype} that would swallow them otherwise)
        Route::post('genotypes/bulk', [GenotypeController::class, 'bulkStore']);
        Route::post('genotypes/import-file', [GenotypeController::class, 'importFromFile']);
        Route::apiResource('genotypes', GenotypeController::class);

        // Storage Units
        Route::prefix('storage')->group(function () {
            Route::get('dashboard', [StorageController::class, 'dashboard']);
            Route::get('lookup', [StorageController::class, 'lookupByQr']);

            // Storage Units
            Route::get('units', [StorageController::class, 'unitIndex']);
            Route::post('units', [StorageController::class, 'unitStore']);
            Route::get('units/{unit}', [StorageController::class, 'unitShow']);
            Route::put('units/{unit}', [StorageController::class, 'unitUpdate']);
            Route::delete('units/{unit}', [StorageController::class, 'unitDestroy']);
            Route::post('units/{unit}/readings', [StorageController::class, 'recordReading']);
            Route::get('units/{unit}/readings', [StorageController::class, 'readingHistory']);

            // Seed Inventory
            Route::get('inventory', [StorageController::class, 'inventoryIndex']);
            Route::post('inventory', [StorageController::class, 'inventoryStore']);
            Route::get('inventory/{inventory}', [StorageController::class, 'inventoryShow']);
            Route::put('inventory/{inventory}', [StorageController::class, 'inventoryUpdate']);
            Route::post('inventory/{inventory}/movements', [StorageController::class, 'recordMovement']);
            Route::get('inventory/{inventory}/movements', [StorageController::class, 'movementIndex']);
        });

        // Environments (Location × Season)
        Route::get('environments', [EnvironmentController::class, 'index']);
        Route::post('environments', [EnvironmentController::class, 'store']);
        Route::get('environments/{environment}', [EnvironmentController::class, 'show']);
        Route::put('environments/{environment}', [EnvironmentController::class, 'update']);
        Route::delete('environments/{environment}', [EnvironmentController::class, 'destroy']);
        Route::get('environments/{environment}/soil-analyses', [EnvironmentController::class, 'soilAnalyses']);
        Route::post('environments/{environment}/soil-analyses', [EnvironmentController::class, 'storeSoilAnalysis']);

        // Trials
        Route::apiResource('trials', TrialController::class);
        Route::post('trials/{trial}/genotypes', [TrialController::class, 'assignGenotypes']);
        Route::post('trials/{trial}/researchers', [TrialController::class, 'assignResearchers']);

        // Trial Plots & RCBD Design
        Route::prefix('trials/{trial}')->group(function () {
            Route::get('plots', [TrialPlotController::class, 'index']);
            Route::get('plots/matrix', [TrialPlotController::class, 'matrix']);
            Route::get('plots/balance-check', [TrialPlotController::class, 'checkBalance']);
            Route::post('plots/generate-rcbd', [TrialPlotController::class, 'generateRcbd']);
            Route::delete('plots/by-environment', [TrialPlotController::class, 'destroyByEnvironment']);
        });
        Route::get('plots/{plot}', [TrialPlotController::class, 'show']);

        // Plot-level Observations (new scientific observations)
        Route::prefix('plot-observations')->group(function () {
            Route::get('/', [PlotObservationController::class, 'index']);
            Route::post('/', [PlotObservationController::class, 'store']);
            Route::get('data-matrix', [PlotObservationController::class, 'dataMatrix']);
            Route::get('missing-report', [PlotObservationController::class, 'missingReport']);
            Route::get('{observation}', [PlotObservationController::class, 'show']);
            Route::put('{observation}', [PlotObservationController::class, 'update']);
            Route::post('{observation}/approve', [PlotObservationController::class, 'approve']);
        });

        // Disease Resistance Evaluation
        Route::prefix('disease')->group(function () {
            Route::get('types', [DiseaseController::class, 'typeIndex']);
            Route::get('evaluations', [DiseaseController::class, 'index']);
            Route::post('evaluations', [DiseaseController::class, 'store']);
            Route::get('evaluations/{evaluation}', [DiseaseController::class, 'show']);
            Route::post('evaluations/{evaluation}/scores', [DiseaseController::class, 'storeScores']);
            Route::delete('evaluations/{evaluation}', [DiseaseController::class, 'destroy']);
            Route::post('evaluations/{evaluation}/approve', [DiseaseController::class, 'approve']);
            Route::get('resistance-summary', [DiseaseController::class, 'resistanceSummary']);
        });

        // Research Documents
        Route::prefix('documents')->group(function () {
            Route::get('categories', [ResearchDocumentController::class, 'categories']);
            Route::get('/', [ResearchDocumentController::class, 'index']);
            Route::post('/', [ResearchDocumentController::class, 'store']);
            Route::get('{document}', [ResearchDocumentController::class, 'show']);
            Route::delete('{document}', [ResearchDocumentController::class, 'destroy']);
        });

        // Observation Scheduler
        Route::prefix('schedules')->group(function () {
            Route::get('/', [ObservationScheduleController::class, 'index']);
            Route::post('/', [ObservationScheduleController::class, 'store']);
            Route::put('{schedule}', [ObservationScheduleController::class, 'update']);
            Route::get('calendar', [ObservationScheduleController::class, 'calendarView']);
            Route::get('missing-data-alerts', [ObservationScheduleController::class, 'missingDataAlerts']);
        });

        // Variety Release Pipeline
        Route::prefix('variety-candidates')->group(function () {
            Route::get('/', [VarietyCandidateController::class, 'index']);
            Route::post('/', [VarietyCandidateController::class, 'store']);
            Route::get('{candidate}', [VarietyCandidateController::class, 'show']);
            Route::put('{candidate}', [VarietyCandidateController::class, 'update']);
            Route::post('{candidate}/calculate-summary', [VarietyCandidateController::class, 'calculateSummary']);
        });

        // Phenotyping (new spreadsheet-based workflow)
        Route::prefix('phenotyping')->group(function () {
            Route::get('characteristics', [CharacteristicController::class, 'index']);
            Route::post('characteristics', [CharacteristicController::class, 'store']);
            Route::put('characteristics/{characteristic}', [CharacteristicController::class, 'update']);
            Route::delete('characteristics/{characteristic}', [CharacteristicController::class, 'destroy']);
            Route::post('characteristics/import', [CharacteristicController::class, 'import']);

            Route::get('records', [ObservationRecordController::class, 'index']);
            Route::post('records', [ObservationRecordController::class, 'store']);
            Route::put('records/{record}', [ObservationRecordController::class, 'update']);
            Route::delete('records/{record}', [ObservationRecordController::class, 'destroy']);

            Route::get('aggregate', [ObservationRecordController::class, 'aggregate']);

            // Bulk import (Phase 2 scaffolding — only template download + upload work)
            Route::prefix('import')->group(function () {
                Route::get('batches', [PhenotypingImportController::class, 'batchIndex']);
                Route::get('batches/{batch}', [PhenotypingImportController::class, 'batchShow']);
                Route::post('upload', [PhenotypingImportController::class, 'upload']);
                Route::post('batches/{batch}/validate', [PhenotypingImportController::class, 'validateBatch']);
                Route::get('batches/{batch}/preview', [PhenotypingImportController::class, 'preview']);
                Route::post('batches/{batch}/confirm', [PhenotypingImportController::class, 'confirm']);
                Route::post('batches/{batch}/rollback', [PhenotypingImportController::class, 'rollback']);
                Route::post('batches/{batch}/reset', [PhenotypingImportController::class, 'resetBatch']);
                Route::delete('batches/{batch}', [PhenotypingImportController::class, 'deleteBatch']);
            });
        });

        // Phenotyping (legacy, plot-level)
        Route::prefix('phenotype')->group(function () {
            // Variables (trait definitions)
            Route::get('variables', [PhenotypeController::class, 'variableIndex']);
            Route::post('variables', [PhenotypeController::class, 'variableStore']);
            Route::put('variables/{variable}', [PhenotypeController::class, 'variableUpdate']);

            // Observations
            Route::get('observations', [PhenotypeController::class, 'observationIndex']);
            Route::post('observations', [PhenotypeController::class, 'observationStore']);
            Route::get('observations/{observation}', [PhenotypeController::class, 'observationShow']);
            Route::put('observations/{observation}', [PhenotypeController::class, 'observationUpdate']);
            Route::post('observations/{observation}/approve', [PhenotypeController::class, 'approveObservation']);

            // Analysis
            Route::get('trial-summary', [PhenotypeController::class, 'trialSummary']);
        });

        // Field Activities
        Route::apiResource('field-activities', FieldActivityController::class)
            ->parameters(['field-activities' => 'activity']);
        Route::post('field-activities/{activity}/approve', [FieldActivityController::class, 'approve']);

        // ── Import Pipeline ────────────────────────────────────────────────────
        // NOTE: GET import/template is registered as a PUBLIC route above (no auth required)
        Route::prefix('import')->group(function () {
            // Normalization preview tool
            Route::post('normalize-preview', [InventoryImportController::class, 'normalizePreview']);

            // Batch lifecycle
            Route::get('batches', [InventoryImportController::class, 'batchIndex']);
            Route::get('batches/{batch}', [InventoryImportController::class, 'batchShow']);

            // Step 1: Upload & Parse
            Route::post('upload', [InventoryImportController::class, 'upload']);

            // Step 2: Validate (normalize + run rules)
            Route::post('batches/{batch}/validate', [InventoryImportController::class, 'validate_batch']);

            // Step 3: Preview results
            Route::get('batches/{batch}/preview', [InventoryImportController::class, 'preview']);
            Route::get('batches/{batch}/rows/{rowNumber}', [InventoryImportController::class, 'rowDetail']);
            Route::get('batches/{batch}/error-report', [InventoryImportController::class, 'downloadErrorReport']);

            // Step 4: Confirm import
            Route::post('batches/{batch}/confirm', [InventoryImportController::class, 'confirm']);

            // Rollback
            Route::post('batches/{batch}/rollback', [InventoryImportController::class, 'rollback']);
        });

        // Expenses & Finance
        Route::prefix('finance')->group(function () {
            Route::get('categories', [ExpenseController::class, 'categoryIndex']);
            Route::get('dashboard', [ExpenseController::class, 'dashboard']);
            Route::get('monthly-report', [ExpenseController::class, 'monthlyReport']);

            Route::get('budgets', [ExpenseController::class, 'budgetIndex']);
            Route::post('budgets', [ExpenseController::class, 'budgetStore']);
            Route::put('budgets/{budget}', [ExpenseController::class, 'budgetUpdate']);
            Route::delete('budgets/{budget}', [ExpenseController::class, 'budgetDestroy']);

            Route::get('expenses', [ExpenseController::class, 'expenseIndex']);
            Route::post('expenses', [ExpenseController::class, 'expenseStore']);
            Route::post('expenses/batch', [ExpenseController::class, 'batchStore']);
            Route::get('expenses/{expense}', [ExpenseController::class, 'expenseShow']);
            Route::put('expenses/{expense}', [ExpenseController::class, 'expenseUpdate']);
            Route::delete('expenses/{expense}', [ExpenseController::class, 'expenseDestroy']);
            Route::post('expenses/{expense}/approve', [ExpenseController::class, 'approveExpense']);
        });

        // Audit Trail
        Route::prefix('audit')->group(function () {
            Route::get('/', [AuditController::class, 'index']);
            Route::get('/model-history', [AuditController::class, 'modelHistory']);
            Route::get('/{auditLog}', [AuditController::class, 'show']);
        });
    });
});
