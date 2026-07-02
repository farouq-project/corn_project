<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AuditService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules\Password;

class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = User::with('roles')
            ->when($request->search, fn($q) => $q->where(function ($q) use ($request) {
                $q->where('name', 'ilike', "%{$request->search}%")
                  ->orWhere('email', 'ilike', "%{$request->search}%")
                  ->orWhere('employee_id', 'ilike', "%{$request->search}%");
            }))
            ->when($request->role, fn($q) => $q->role($request->role))
            ->when($request->status, fn($q) => $q->where('status', $request->status));

        $paginated = $query->orderBy('name')->paginate($request->per_page ?? 20);

        // Replace each user's roles with plain role name strings
        $paginated->getCollection()->transform(fn($u) => $this->formatUser($u));

        return response()->json($paginated);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'unique:users'],
            'password' => ['required', Password::min(8)],
            'employee_id' => ['nullable', 'string', 'unique:users'],
            'phone' => ['nullable', 'string'],
            'institution' => ['nullable', 'string'],
            'role' => ['required', 'string', 'exists:roles,name'],
        ]);

        $user = User::create([
            ...$data,
            'password' => Hash::make($data['password']),
            'email_verified_at' => now(),
        ]);

        $user->assignRole($data['role']);
        AuditService::logCreated($user);

        return response()->json($this->formatUser($user), 201);
    }

    public function show(User $user): JsonResponse
    {
        return response()->json($this->formatUser($user->load('trialAssignments')));
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'employee_id' => ['nullable', 'string', "unique:users,employee_id,{$user->id}"],
            'phone' => ['nullable', 'string'],
            'institution' => ['nullable', 'string'],
            'status' => ['sometimes', 'in:active,inactive,suspended'],
            'role' => ['sometimes', 'string', 'exists:roles,name'],
        ]);

        $original = $user->getAttributes();
        $user->update($data);

        if (isset($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        AuditService::logUpdated($user, $original);

        return response()->json($this->formatUser($user));
    }

    public function destroy(User $user): JsonResponse
    {
        AuditService::logDeleted($user);
        $user->delete();
        return response()->json(null, 204);
    }

    public function pending(Request $request): JsonResponse
    {
        $paginated = User::with('roles')
            ->where('status', 'pending')
            ->orderBy('created_at', 'desc')
            ->paginate($request->per_page ?? 20);

        $paginated->getCollection()->transform(fn($u) => $this->formatUser($u));

        return response()->json($paginated);
    }

    public function approve(Request $request, User $user): JsonResponse
    {
        $data = $request->validate(['role' => ['required', 'string', 'exists:roles,name']]);

        $original = $user->getAttributes();
        $user->update(['status' => 'active']);
        $user->syncRoles([$data['role']]);
        AuditService::logUpdated($user, $original);

        return response()->json(['message' => 'Pengguna berhasil disetujui.', 'user' => $this->formatUser($user)]);
    }

    public function reject(User $user): JsonResponse
    {
        $original = $user->getAttributes();
        $user->update(['status' => 'inactive']);
        AuditService::logUpdated($user, $original);

        return response()->json(['message' => 'Pengguna berhasil ditolak.']);
    }

    public function resetPassword(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'password' => ['required', 'confirmed', Password::min(8)],
        ]);

        $user->update(['password' => Hash::make($data['password'])]);
        $user->tokens()->delete();

        AuditService::logAction('password_reset', $user);

        return response()->json(['message' => 'Password reset successfully']);
    }

    /** Serialize a user with roles as plain strings, not Spatie Role objects. */
    private function formatUser(User $user): array
    {
        $user->loadMissing('roles');

        return [
            'id'           => $user->id,
            'name'         => $user->name,
            'email'        => $user->email,
            'employee_id'  => $user->employee_id,
            'phone'        => $user->phone,
            'institution'  => $user->institution,
            'avatar'       => $user->avatar,
            'status'       => $user->status,
            'last_login_at'=> $user->last_login_at,
            'roles'        => $user->getRoleNames()->values(),      // ["super_admin"]
            'permissions'  => $user->getAllPermissions()->pluck('name')->values(),
        ];
    }
}
