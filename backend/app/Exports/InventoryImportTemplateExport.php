<?php

namespace App\Exports;

use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Color;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

class InventoryImportTemplateExport implements
    FromArray,
    WithHeadings,
    WithStyles,
    WithColumnWidths,
    WithTitle
{
    public function title(): string
    {
        return 'Seed Inventory Import';
    }

    public function headings(): array
    {
        return [
            'package_code *',
            'genotype_code *',
            'storage_unit_code *',
            'rack_label',
            'box_number',
            'row_position',
            'column_position',
            'season_code',
            'source_trial_code',
            'harvest_date',
            'storage_date *',
            'expiry_date',
            'initial_weight_g *',
            'remaining_weight_g',
            'moisture_content (%)',
            'germination_percentage (%)',
            'germination_test_date',
            'vigor_index',
            'seed_count',
            'storage_status',
            'notes',
        ];
    }

    public function array(): array
    {
        // Example rows showing accepted formats
        return [
            [
                'PKG-001', 'HJ-UNPAD-01', 'RF001', 'A1', 'B-03', '1', '2',
                'MH2025', 'T-MH2026-001', '15/04/2026', '01/05/2026', '01/05/2028',
                '500', '500', '12.5', '95', '01/05/2026', '85', '250', 'good', 'Contoh baris 1'
            ],
            [
                'PKG-002', 'HJ-UNPAD-02', 'RF001', 'A1', 'B-04', '', '',
                'MH2025', '', '20/04/2026', '05/05/2026', '',
                '300', '300', '13.0', '90', '', '', '', 'warning', ''
            ],
            // Leave empty rows as examples
            array_fill(0, 21, ''),
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        // Header row styling
        $headerStyle = [
            'font' => [
                'bold' => true,
                'color' => ['argb' => 'FFFFFFFF'],
                'size' => 10,
            ],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FF1E7E34'],
            ],
            'alignment' => [
                'horizontal' => Alignment::HORIZONTAL_CENTER,
                'vertical' => Alignment::VERTICAL_CENTER,
                'wrapText' => true,
            ],
            'borders' => [
                'allBorders' => [
                    'borderStyle' => Border::BORDER_THIN,
                    'color' => ['argb' => 'FF999999'],
                ],
            ],
        ];

        // Example row styling (light green)
        $exampleStyle = [
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FFD4EDDA'],
            ],
            'font' => ['color' => ['argb' => 'FF155724'], 'size' => 9],
        ];

        // Required column highlight (yellow)
        $requiredCols = ['A', 'B', 'C', 'K', 'M'];
        foreach ($requiredCols as $col) {
            $sheet->getStyle("{$col}1")->getFont()->getColor()->setARGB('FFFFFC00');
        }

        return [
            1 => $headerStyle,
            2 => $exampleStyle,
            3 => $exampleStyle,
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 18, 'B' => 20, 'C' => 20, 'D' => 14, 'E' => 14,
            'F' => 14, 'G' => 14, 'H' => 16, 'I' => 20, 'J' => 16,
            'K' => 16, 'L' => 16, 'M' => 18, 'N' => 18, 'O' => 18,
            'P' => 22, 'Q' => 20, 'R' => 14, 'S' => 14, 'T' => 16, 'U' => 30,
        ];
    }
}
