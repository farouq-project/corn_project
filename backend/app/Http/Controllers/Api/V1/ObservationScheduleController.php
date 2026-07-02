<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ObservationSchedule;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ObservationScheduleController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ObservationSchedule::with(['trial', 'environment.location', 'assignee'])
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->assigned_to, fn($q) => $q->where('assigned_to', $request->assigned_to))
            ->when($request->status, fn($q) => $q->where('status', $request->status))
            ->when($request->from_date, fn($q) => $q->where('scheduled_date', '>=', $request->from_date))
            ->when($request->to_date, fn($q) => $q->where('scheduled_date', '<=', $request->to_date));

        // Upcoming for current user
        if ($request->boolean('my_schedule')) {
            $query->where('assigned_to', $request->user()->id)
                ->where('status', 'pending')
                ->where('scheduled_date', '>=', now()->toDateString());
        }

        // Overdue
        if ($request->boolean('overdue')) {
            $query->where('status', 'pending')
                ->where('scheduled_date', '<', now()->toDateString());
        }

        return response()->json($query->orderBy('scheduled_date')->paginate(30));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'trial_id' => ['required', 'exists:trials,id'],
            'environment_id' => ['nullable', 'exists:environments,id'],
            'schedule_title' => ['required', 'string', 'max:255'],
            'observation_type' => ['required', 'in:phenotype,disease_evaluation,field_activity,yield_harvest,sampling'],
            'variable_category' => ['nullable', 'string'],
            'scheduled_date' => ['required', 'date'],
            'deadline_date' => ['nullable', 'date', 'after:scheduled_date'],
            'growth_stage_target' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'reminder_days_before' => ['integer', 'min:0', 'max:30'],
            'instructions' => ['nullable', 'string'],
        ]);

        $data['created_by'] = $request->user()->id;
        $schedule = ObservationSchedule::create($data);

        return response()->json($schedule->load(['trial', 'environment.location', 'assignee']), 201);
    }

    public function update(Request $request, ObservationSchedule $schedule): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:pending,in_progress,completed,missed,cancelled'],
            'completion_date' => ['nullable', 'date'],
            'completion_rate_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'notes' => ['nullable', 'string'],
            'assigned_to' => ['nullable', 'exists:users,id'],
            'scheduled_date' => ['sometimes', 'date'],
        ]);

        $schedule->update($data);
        return response()->json($schedule->load(['assignee']));
    }

    public function destroy(ObservationSchedule $schedule): JsonResponse
    {
        $schedule->delete();
        return response()->json(null, 204);
    }

    public function calendarView(Request $request): JsonResponse
    {
        $request->validate([
            'year' => ['required', 'digits:4'],
            'month' => ['required', 'integer', 'min:1', 'max:12'],
        ]);

        $start = "{$request->year}-" . str_pad($request->month, 2, '0', STR_PAD_LEFT) . "-01";
        $end = date('Y-m-t', strtotime($start));

        $schedules = ObservationSchedule::with(['trial', 'environment.location', 'assignee'])
            ->where('scheduled_date', '>=', $start)
            ->where('scheduled_date', '<=', $end)
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->orderBy('scheduled_date')
            ->get();

        // Group by date for calendar display
        return response()->json($schedules->groupBy(fn($s) => $s->scheduled_date->format('Y-m-d')));
    }

    public function missingDataAlerts(Request $request): JsonResponse
    {
        // Schedules that are past due with no completion
        $overdue = ObservationSchedule::with(['trial', 'environment.location', 'assignee'])
            ->where('status', 'pending')
            ->where('scheduled_date', '<', now()->toDateString())
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->orderBy('scheduled_date')
            ->get();

        return response()->json([
            'overdue_count' => $overdue->count(),
            'overdue_schedules' => $overdue,
        ]);
    }
}
