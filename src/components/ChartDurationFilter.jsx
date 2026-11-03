import { CHART_DURATIONS } from '../utils/chartDuration';
import './ChartDurationFilter.css';

export default function ChartDurationFilter({ value, onChange, label = 'Chart duration' }) {
  return (
    <div className="chart-duration" role="group" aria-label={label}>
      {CHART_DURATIONS.map((option) => (
        <button key={option.value} type="button" aria-pressed={value === option.value} className={value === option.value ? 'active' : ''} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
