<?php

namespace App\Exports;

use App\Models\Characteristic;
use Maatwebsite\Excel\Concerns\FromArray;
use Maatwebsite\Excel\Concerns\WithColumnWidths;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithStyles;
use Maatwebsite\Excel\Concerns\WithTitle;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Border;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * "Data Pengamatan" import template: static columns
 * (No Plot, Kode Gen, Gen, Environment, R) followed by one column
 * per active characteristic (ordered by display_order), matching
 * the researcher spreadsheet layout.
 */
class PhenotypingObservationTemplateExport implements
    FromArray,
    WithHeadings,
    WithStyles,
    WithColumnWidths,
    WithTitle
{
    private array $characteristics;

    public function __construct()
    {
        $this->characteristics = Characteristic::active()->ordered()->get(['code', 'unit'])->all();
    }

    public function title(): string
    {
        return 'Data Pengamatan';
    }

    public function headings(): array
    {
        $headings = ['No Plot *', 'Kode Gen *', 'Gen', 'Environment *', 'R *'];

        foreach ($this->characteristics as $characteristic) {
            $headings[] = $characteristic->unit
                ? "{$characteristic->code} ({$characteristic->unit})"
                : $characteristic->code;
        }

        return $headings;
    }

    public function array(): array
    {
        $exampleTail = array_fill(0, count($this->characteristics), '');

        return [
            array_merge(['1', 'HJ-UNPAD-01', 'Hibrida Jagung UNPAD 01', 'JTIC-MH2025', '1'], $exampleTail),
            array_merge(['1', 'HJ-UNPAD-01', 'Hibrida Jagung UNPAD 01', 'JTIC-MH2025', '2'], $exampleTail),
            array_merge(['', '', '', '', ''], $exampleTail),
        ];
    }

    public function styles(Worksheet $sheet): array
    {
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

        $exampleStyle = [
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['argb' => 'FFD4EDDA'],
            ],
            'font' => ['color' => ['argb' => 'FF155724'], 'size' => 9],
        ];

        return [
            1 => $headerStyle,
            2 => $exampleStyle,
            3 => $exampleStyle,
        ];
    }

    public function columnWidths(): array
    {
        $widths = ['A' => 12, 'B' => 16, 'C' => 26, 'D' => 18, 'E' => 6];

        $col = 'F';
        foreach ($this->characteristics as $_) {
            $widths[$col] = 12;
            $col++;
        }

        return $widths;
    }
}
