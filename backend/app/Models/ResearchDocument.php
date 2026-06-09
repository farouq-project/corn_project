<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class ResearchDocument extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'document_code', 'title', 'category',
        'trial_id', 'environment_id', 'season_id',
        'disk', 'file_path', 'original_filename', 'mime_type', 'file_size_bytes',
        'version', 'parent_document_id', 'is_latest_version',
        'description', 'document_date', 'is_public', 'tags', 'uploaded_by',
    ];

    protected $casts = [
        'document_date' => 'date',
        'is_public' => 'boolean',
        'is_latest_version' => 'boolean',
        'tags' => 'array',
    ];

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function environment()
    {
        return $this->belongsTo(Environment::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function parentDocument()
    {
        return $this->belongsTo(ResearchDocument::class, 'parent_document_id');
    }

    public function versions()
    {
        return $this->hasMany(ResearchDocument::class, 'parent_document_id');
    }

    public function getUrlAttribute(): string
    {
        return Storage::disk($this->disk)->url($this->file_path);
    }

    public function getHumanSizeAttribute(): string
    {
        $bytes = $this->file_size_bytes ?? 0;
        foreach (['B', 'KB', 'MB', 'GB'] as $unit) {
            if ($bytes < 1024) return round($bytes, 1) . ' ' . $unit;
            $bytes /= 1024;
        }
        return round($bytes, 1) . ' TB';
    }
}
