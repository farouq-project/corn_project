<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'expense_code', 'category_id', 'category_name_custom', 'budget_id', 'trial_id', 'season_id',
        'title', 'description', 'amount', 'payment_date',
        'vendor', 'vendor_contact', 'funding_source', 'payment_method',
        'reference_number', 'attachments', 'approval_status', 'approval_notes',
        'submitted_by', 'approved_by', 'approved_at',
    ];

    protected $casts = [
        'payment_date' => 'date',
        'approved_at' => 'datetime',
        'attachments' => 'array',
    ];

    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'category_id');
    }

    public function budget()
    {
        return $this->belongsTo(Budget::class);
    }

    public function trial()
    {
        return $this->belongsTo(Trial::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function submitter()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function fileAttachments()
    {
        return $this->morphMany(FileAttachment::class, 'attachable');
    }
}
