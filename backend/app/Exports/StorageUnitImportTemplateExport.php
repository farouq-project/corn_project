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

class StorageUnitImportTemplateExport implements
    FromArray,
    WithHeadings,
    WithStyles,
    WithColumnWidths,
    WithTitle
{
    public function title(): string
    {
        return 'Storage Units Import';
    }

    public function headings(): array
    {
        return [
            'unit_code *',
            'unit_name *',
            'unit_type *',
            'room_name',
            'building',
            'temperature_min (°C)',
            'temperature_max (°C)',
            'humidity_min (%)',
            'humidity_max (%)',
            'capacity_racks',
            'capacity_boxes_per_rack',
            'is_active',
            'description',
        ];
    }

    public function array(): array
    {
        return [
            ['RF001', 'Kulkas Utama Lab Benih', 'refrigerator', 'Lab Benih', 'Gedung Pemuliaan', 2, 8, 30, 50, 6, 20, 'Ya', 'Kulkas utama untuk penyimpanan benih jangka menengah'],
            ['FZ001', 'Freezer Penyimpanan Jangka Panjang', 'freezer', 'Lab Benih', 'Gedung Pemuliaan', -20, -18, 20, 40, 4, 15, 'Ya', 'Freezer untuk konservasi jangka panjang'],
            ['CB001', 'Kabinet Kering', 'cabinet', 'Lab Benih', 'Gedung Pemuliaan', '', '', 40, 60, 3, 30, 'Ya', 'Penyimpanan benih dengan kelembaban terkontrol'],
            array_fill(0, 13, ''),
        ];
    }

    public function styles(Worksheet $sheet): array
    {
        $validTypes = "refrigerator, freezer, cold_room, dry_room, cabinet, shelf";
        $sheet->getComment('C1')->getText()->createTextRun("Tipe yang valid:\n{$validTypes}");

        return [
            1 => [
                'font' => ['bold' => true, 'color' => ['argb' => 'FFFFFFFF'], 'size' => 10],
                'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FF1565C0']],
                'alignment' => ['horizontal' => Alignment::HORIZONTAL_CENTER, 'wrapText' => true],
                'borders' => ['allBorders' => ['borderStyle' => Border::BORDER_THIN]],
            ],
            2 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD1ECF1']]],
            3 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD1ECF1']]],
            4 => ['fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['argb' => 'FFD1ECF1']]],
        ];
    }

    public function columnWidths(): array
    {
        return [
            'A' => 16, 'B' => 40, 'C' => 16, 'D' => 20, 'E' => 20,
            'F' => 20, 'G' => 20, 'H' => 16, 'I' => 16, 'J' => 16,
            'K' => 22, 'L' => 12, 'M' => 40,
        ];
    }
}
