<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ResearchDocument;
use App\Services\FileUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ResearchDocumentController extends Controller
{
    public function __construct(private FileUploadService $fileUploadService) {}

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
            'category' => ['required', 'in:sop,rainfall_data,soil_analysis,genotype_list,field_documentation,harvest_report,statistical_output,variety_release,financial,protocol,other'],
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
        $folder = "documents/{$data['category']}/" . date('Y/m');

        $attachment = $this->fileUploadService->upload($file, $folder, null, $data['category']);

        $document = ResearchDocument::create([
            'document_code' => 'DOC-' . strtoupper(Str::random(10)),
            'title' => $data['title'],
            'category' => $data['category'],
            'trial_id' => $data['trial_id'] ?? null,
            'environment_id' => $data['environment_id'] ?? null,
            'season_id' => $data['season_id'] ?? null,
            'disk' => $attachment->disk,
            'file_path' => $attachment->path,
            'original_filename' => $attachment->original_name,
            'mime_type' => $attachment->mime_type,
            'file_size_bytes' => $attachment->size,
            'document_date' => $data['document_date'] ?? null,
            'description' => $data['description'] ?? null,
            'is_public' => $data['is_public'] ?? false,
            'tags' => $data['tags'] ?? null,
            'uploaded_by' => $request->user()->id,
        ]);

        $attachment->delete(); // remove the file_attachments record; document has own storage

        return response()->json($document->load(['trial', 'uploader'])->append(['url', 'human_size']), 201);
    }

    public function show(ResearchDocument $document): JsonResponse
    {
        return response()->json($document->load(['trial', 'environment.location', 'season', 'uploader', 'versions'])
            ->append(['url', 'human_size']));
    }

    public function destroy(ResearchDocument $document): JsonResponse
    {
        $document->delete();
        return response()->json(null, 204);
    }

    public function categories(): JsonResponse
    {
        $categories = [
            ['code' => 'sop', 'label' => 'SOP & Protokol'],
            ['code' => 'rainfall_data', 'label' => 'Data Curah Hujan'],
            ['code' => 'soil_analysis', 'label' => 'Analisis Tanah'],
            ['code' => 'genotype_list', 'label' => 'Daftar Genotipe'],
            ['code' => 'field_documentation', 'label' => 'Dokumentasi Lapang'],
            ['code' => 'harvest_report', 'label' => 'Laporan Panen'],
            ['code' => 'statistical_output', 'label' => 'Output Statistik'],
            ['code' => 'variety_release', 'label' => 'Pelepasan Varietas'],
            ['code' => 'financial', 'label' => 'Keuangan'],
            ['code' => 'protocol', 'label' => 'Protokol Penelitian'],
            ['code' => 'other', 'label' => 'Lainnya'],
        ];

        return response()->json($categories);
    }
}
