<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Role;

return new class extends Migration {
    public function up(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        foreach (['researcher', 'field_team', 'colaborator'] as $name) {
            Role::firstOrCreate(['name' => $name, 'guard_name' => 'web']);
        }
    }

    public function down(): void
    {
        Role::whereIn('name', ['researcher', 'field_team', 'colaborator'])->delete();
    }
};
