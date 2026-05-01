"use client";

interface Props {
  value: string;
  onChange: (value: string) => void;
}

const LOCATIONS = ["New York", "San Jose", "Los Angeles", "Chicago", "Seattle", "London"];

export function LocationSelector({ value, onChange }: Props) {
  return (
    <label className="block">
      <span className="field-label">Location</span>
      <select className="input-control" value={value} onChange={(e) => onChange(e.target.value)}>
        {LOCATIONS.map((loc) => (
          <option key={loc} value={loc}>
            {loc}
          </option>
        ))}
      </select>
    </label>
  );
}
