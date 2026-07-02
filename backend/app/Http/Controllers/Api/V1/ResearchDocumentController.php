<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ResearchDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ResearchDocumentController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = ResearchDocument::with(['trial', 'uploader'])
            ->when($request->category, fn($q) => $q->where('category', $request->category))
            ->when($request->trial_id, fn($q) => $q->where('trial_id', $request->trial_id))
            ->when($request->season_id, fn($q) => $q->where('season_id', $request->season_id))
            ->when($request->search, fn($q) => $q->where('title', 'ilike', "%{$request->search}%"))
            ->where('is_latest_version', true);

        return response()->json($query->orderBy('created_at', 'desc')->paginate($request->per_page ?? 20));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'category' => ['required', 'string', 'max:50'],
            'trial_id' => ['nullable', 'exists:trials,id'],
            'environment_id' => ['nullable', 'exists:environments,id'],
            'season_id' => ['nullable', 'exists:seasons,id'],
            'document_date' => ['nullable', 'date'],
            'description' => ['nullable', 'string'],
            'is_public' => ['boolean'],
            'tags' => ['nullable', 'array'],
            'file' => ['required', 'file', 'max:51200', 'mimes:pdf,jpg,jpeg,png,xlsx,xls,csv,docx,doc,zip'],
        ]);

        $file = $request->file('file');
        $folder = 'documents/' . $data['category'] . '/' . date('Y/m');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();

        // Always store on 'public' disk so URL generation works
        $path = $file->storeAs($folder, $filename, 'public');

        $document = ResearchDocument::create([
            'document_code' => 'DOC-' . strtoupper(Str::random(10)),
            'title' => $data['title'],
            'category' => $data['category'],
            'trial_id' => $data['trial_id'] ?? null,
            'environment_id' => $data['environment_id'] ?? null,
            'season_id' => $data['season_id'] ?? null,
            'disk' => 'public',
            'file_path' => $path,
            'original_filename' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'file_size_bytes' => $file->getSize(),
            'document_date' => $data['document_date'] ?? null,
            'description' => $data['description'] ?? null,
            'is_public' => $data['is_public'] ?? false,
            'tags' => $data['tags'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        return response()->json($document->load(['trial', 'uploader'])->append(['url', 'human_size']), 201);
    }

    public function show(ResearchDocument $document): JsonResponse
    {
        return response()->json($document->load(['trial', 'environment.location', 'season', 'uploader', 'versions'])
            ->append(['url', 'human_size']));
    }

    public function destroy(ResearchDocument $document): JsonResponse
    {
        Storage::disk($document->disk)->delete($document->file_path);
        $document->delete();
        return response()->json(null, 204);
    }

    public function categories(): JsonResponse
    {
        return response()->json([
            ['code' => 'research_plan', 'label' => 'Research Plan'],
        ]);
    }
}
