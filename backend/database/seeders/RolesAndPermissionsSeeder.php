<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        $permissions = [
            // Users
            'users.view', 'users.create', 'users.edit', 'users.delete',
            // Genotypes
            'genotypes.view', 'genotypes.create', 'genotypes.edit', 'genotypes.delete',
            // Trials
            'trials.view', 'trials.create', 'trials.edit', 'trials.delete', 'trials.approve',
            // Storage
            'storage.view', 'storage.create', 'storage.edit', 'storage.delete', 'storage.movements',
            // Phenotype
            'phenotype.view', 'phenotype.create', 'phenotype.edit', 'phenotype.approve',
            // Field Activities
            'activities.view', 'activities.create', 'activities.edit', 'activities.delete', 'activities.approve',
            // Finance
            'finance.view', 'finance.create', 'finance.edit', 'finance.approve',
            // Master Data
            'master_data.view', 'master_data.manage',
            // Audit
            'audit.view',
            // Reports
            'reports.view', 'reports.export',
        ];

        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Super Admin - full access
        $superAdmin = Role::firstOrCreate(['name' => 'super_admin']);
        $superAdmin->givePermissionTo(Permission::all());

        // Principal Researcher
        $principalResearcher = Role::firstOrCreate(['name' => 'principal_researcher']);
        $principalResearcher->givePermissionTo([
            'genotypes.view', 'genotypes.create', 'genotypes.edit',
            'trials.view', 'trials.create', 'trials.edit', 'trials.approve',
            'storage.view', 'storage.movements',
            'phenotype.view', 'phenotype.create', 'phenotype.edit', 'phenotype.approve',
            'activities.view', 'activities.create', 'activities.approve',
            'finance.view', 'finance.approve',
            'master_data.view', 'master_data.manage',
            'audit.view', 'reports.view', 'reports.export',
        ]);

        // Field Researcher
        $fieldResearcher = Role::firstOrCreate(['name' => 'field_researcher']);
        $fieldResearcher->givePermissionTo([
            'genotypes.view',
            'trials.view',
            'storage.view',
            'phenotype.view', 'phenotype.create', 'phenotype.edit',
            'activities.view', 'activities.create', 'activities.edit',
            'master_data.view',
            'reports.view',
        ]);

        // Storage Officer
        $storageOfficer = Role::firstOrCreate(['name' => 'storage_officer']);
        $storageOfficer->givePermissionTo([
            'genotypes.view',
            'trials.view',
            'storage.view', 'storage.create', 'storage.edit', 'storage.movements',
            'master_data.view',
            'reports.view', 'reports.export',
        ]);

        // Finance Staff
        $financeStaff = Role::firstOrCreate(['name' => 'finance_staff']);
        $financeStaff->givePermissionTo([
            'trials.view',
            'finance.view', 'finance.create', 'finance.edit',
            'reports.view', 'reports.export',
        ]);
    }
}
