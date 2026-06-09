<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class UsersSeeder extends Seeder
{
    public function run(): void
    {
        $users = [
            [
                'name' => 'Super Admin',
                'email' => 'admin@cornbreed-unpad.ac.id',
                'password' => Hash::make('password'),
                'employee_id' => 'SA001',
                'institution' => 'UNPAD',
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'super_admin',
            ],
            [
                'name' => 'Dr. Ahmad Researcher',
                'email' => 'researcher@cornbreed-unpad.ac.id',
                'password' => Hash::make('password'),
                'employee_id' => 'PR001',
                'institution' => 'UNPAD - Faculty of Agriculture',
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'principal_researcher',
            ],
            [
                'name' => 'Budi Field Officer',
                'email' => 'field@cornbreed-unpad.ac.id',
                'password' => Hash::make('password'),
                'employee_id' => 'FR001',
                'institution' => 'UNPAD',
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'field_researcher',
            ],
            [
                'name' => 'Siti Storage Officer',
                'email' => 'storage@cornbreed-unpad.ac.id',
                'password' => Hash::make('password'),
                'employee_id' => 'SO001',
                'institution' => 'UNPAD',
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'storage_officer',
            ],
            [
                'name' => 'Rini Finance Staff',
                'email' => 'finance@cornbreed-unpad.ac.id',
                'password' => Hash::make('password'),
                'employee_id' => 'FS001',
                'institution' => 'UNPAD',
                'status' => 'active',
                'email_verified_at' => now(),
                'role' => 'finance_staff',
            ],
        ];

        foreach ($users as $userData) {
            $role = $userData['role'];
            unset($userData['role']);

            $user = User::firstOrCreate(['email' => $userData['email']], $userData);
            $user->assignRole($role);
        }
    }
}
