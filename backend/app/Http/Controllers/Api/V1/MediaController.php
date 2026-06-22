<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * General-purpose file upload for receipts, activity photos, and other attachments.
 * Files are stored in the public disk under uploads/ and served via /storage/uploads/*.
 */
class MediaController extends Controller
{
    public function upload(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:jpg,jpeg,png,webp,pdf', 'max:10240'],
            'folder' => ['nullable', 'string', 'in:receipts,activity-photos,documents'],
        ]);

        $folder = 'uploads/' . ($request->folder ?? 'general');
        $file = $request->file('file');
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();

        $path = $file->storeAs($folder, $filename, 'public');

        return response()->json([
            'url' => Storage::disk('public')->url($path),
            'path' => $path,
            'filename' => $file->getClientOriginalName(),
            'size' => $file->getSize(),
            'mime' => $file->getMimeType(),
        ], 201);
    }
}
