<?php

namespace App\Services;

use App\Models\FileAttachment;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class FileUploadService
{
    private string $disk;

    public function __construct()
    {
        $this->disk = config('filesystems.default', 'local');
    }

    public function upload(
        UploadedFile $file,
        string $folder,
        ?object $attachable = null,
        string $category = 'general'
    ): FileAttachment {
        $filename = Str::uuid() . '.' . $file->getClientOriginalExtension();
        $path = $file->storeAs($folder, $filename, $this->disk);

        return FileAttachment::create([
            'disk' => $this->disk,
            'path' => $path,
            'filename' => $filename,
            'original_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType(),
            'size' => $file->getSize(),
            'attachable_type' => $attachable ? get_class($attachable) : null,
            'attachable_id' => $attachable?->getKey(),
            'category' => $category,
            'uploaded_by' => Auth::id(),
        ]);
    }

    public function uploadMultiple(array $files, string $folder, ?object $attachable = null, string $category = 'general'): array
    {
        return array_map(
            fn(UploadedFile $file) => $this->upload($file, $folder, $attachable, $category),
            $files
        );
    }

    public function delete(FileAttachment $attachment): bool
    {
        Storage::disk($attachment->disk)->delete($attachment->path);
        return $attachment->delete();
    }

    public function getUrl(FileAttachment $attachment): string
    {
        return Storage::disk($attachment->disk)->url($attachment->path);
    }
}
