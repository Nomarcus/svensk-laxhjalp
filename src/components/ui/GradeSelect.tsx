import { useTranslation } from 'react-i18next';
import { cn } from '../../utils/cn';
import { GRADE_VALUES, gradeLabel, isKnownGrade } from '../../utils/grade';

interface GradeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  id?: string;
  disabled?: boolean;
}

/**
 * Val av årskurs i stället för fritext. Fritext gav värden som "4B" eller
 * "fyran" som servern inte kunde tolka, och då anpassades svaren inte efter
 * barnets ålder. En äldre fritext visas som eget alternativ tills den byts.
 */
export default function GradeSelect({ value, onChange, className, id, disabled }: GradeSelectProps) {
  const { t } = useTranslation();
  const legacy = value.trim() && !isKnownGrade(value) ? value.trim() : null;

  return (
    <select
      id={id}
      value={value.trim()}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      aria-label={t('grade.placeholder')}
      className={cn(
        'w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:ring-2 focus:ring-emerald-500/20 dark:border-white/10 dark:bg-slate-900 dark:text-stone-100',
        !value.trim() && 'text-stone-400 dark:text-stone-500',
        className,
      )}
    >
      <option value="" disabled>
        {t('grade.placeholder')}
      </option>
      {legacy && <option value={legacy}>{t('grade.legacy', { value: legacy })}</option>}
      {GRADE_VALUES.map((v) => (
        <option key={v} value={v}>
          {gradeLabel(v, t)}
        </option>
      ))}
    </select>
  );
}
