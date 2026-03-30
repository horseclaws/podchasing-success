'use client';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const YEARS = [2022, 2023, 2024, 2025, 2026];

interface Props {
  label: string;
  year: number;
  month: number; // 1-12
  onChange: (year: number, month: number) => void;
}

export default function MonthYearPicker({ label, year, month, onChange }: Props) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">{label}</span>
      <select
        value={month}
        onChange={(e) => onChange(year, Number(e.target.value))}
        className="text-sm border border-gray-300 rounded px-2 py-1"
      >
        {MONTHS.map((m, i) => (
          <option key={m} value={i + 1}>{m}</option>
        ))}
      </select>
      <select
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        className="text-sm border border-gray-300 rounded px-2 py-1"
      >
        {YEARS.map((y) => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  );
}
