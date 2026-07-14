'use client';

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterDef {
  key:      string;
  label:    string;
  options:  FilterOption[];
  value:    string;
  onChange: (val: string) => void;
}

interface Props {
  filters:   FilterDef[];
  onClear:   () => void;
  hasActive: boolean;
}

export default function FilterBar({ filters, onClear, hasActive }: Props) {
  return (
    <div className="filter-bar">
      {filters.map(f => (
        <div key={f.key} className="filter-group">
          <span className="filter-group-label">{f.label}</span>
          <div className="filter-chips" role="group" aria-label={f.label}>
            {f.options.map(opt => (
              <button
                key={opt.value}
                type="button"
                className={`filter-chip${f.value === opt.value ? ' active' : ''}`}
                onClick={() => f.onChange(opt.value)}
                aria-pressed={f.value === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      ))}
      {hasActive && (
        <button type="button" className="filter-clear" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  );
}
