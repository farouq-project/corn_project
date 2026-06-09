<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class GenotypeImportTemplateExport implements
    FromArray,
    WithHeadings,
    WithStyles,
    WithColumnWidths,
    WithTitle
{
    public function title(): string
    {
        return 'Genotype Import';
    }

    public function headings(): array
    {
        return [
            'genotype_code *',
            'genotype_name',
            'old_code',
            'category',
            'trial_type',
            'origin',
            'breeder',
            'release_year',
            'pedigree',
            'notes',
        ];
    }

    public function array(): array
    {
        return [
            // Example rows
            ['20001', 'Galur Harapan 1', '', 'inbred_line', 'normal', 'UNPAD', 'Dr. Ahmad', '', '', ''],
            ['20002', 'Hibrida Unpad 2', '9901', 'hybrid', 'drought', 'UNPAD', '', '', 'A × B', ''],
            ['20003', '', '', 'inbred_line', 'normal', '', '', '', '', ''],
            // blank rows for user to fill in
            array_fill(0, 10, ''),
            array_fill(0, 10, ''),
            array_fill(0, 10, ''),
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        // Add dropdown validation note as comment on category cell
        $categoryNote = "Nilai yang diterima:\ninbred_line\nhybrid\nvariety\npopulation\ngermplasm";
        $trialNote    = "Nilai yang diterima:\nnormal\ndrought\nshade\nfeed\nsweet_corn\nmulti";

        $sheet->getComment('D1')->getText()->createTextRun($categoryNote);
        $sheet->getComment('E1')->getText()->createTextRun($trialNote);

        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1E7E34']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN, 'color' => ['argb' => 'FF999999']]],
            ],
            2 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD4EDDA']]],
            3 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD4EDDA']]],
            4 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD4EDDA']]],
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 20, 'B' => 30, 'C' => 16,
            'D' => 16, 'E' => 16, 'F' => 20,
            'G' => 20, 'H' => 14, 'I' => 25, 'J' => 30,
        ];
    }
}
