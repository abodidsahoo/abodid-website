import type { ReactNode } from "react";

interface RangeControlProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  onChange: (value: number) => void;
  suffix?: string;
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step,
  defaultValue,
  onChange,
  suffix = "",
}: RangeControlProps) {
  return (
    <label className="loom-control loom-control--range">
      <span className="loom-control__heading" onDoubleClick={() => onChange(defaultValue)}>
        <span>{label}</span>
        <output>{Number.isInteger(step) ? value : value.toFixed(step < 0.01 ? 3 : 2)}{suffix}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        aria-label={label}
      />
    </label>
  );
}

interface SelectControlProps<T extends string> {
  label: string;
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (value: T) => void;
}

export function SelectControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SelectControlProps<T>) {
  return (
    <label className="loom-control">
      <span className="loom-control__label">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as T)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

export function ToggleControl({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="loom-control loom-control--toggle">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="loom-switch" aria-hidden="true" />
    </label>
  );
}

export function ColorControl({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="loom-control loom-control--color">
      <span>{label}</span>
      <span className="loom-color-field">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-label={label}
        />
        <span>{value.toUpperCase()}</span>
      </span>
    </label>
  );
}

export function ControlSection({
  title,
  badge,
  open = false,
  children,
}: {
  title: string;
  badge?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className="loom-section" open={open}>
      <summary>
        <span>{title}</span>
        {badge && <span className="loom-section__badge">{badge}</span>}
      </summary>
      <div className="loom-section__content">{children}</div>
    </details>
  );
}

