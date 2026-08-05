import { motion } from 'motion/react';
import { cn } from '../../utils/cn';

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  variant: 'sidebar' | 'bottom' | 'drawer';
  /** Scopes the shared active-indicator animation to one nav surface (sidebar vs. drawer) so it never animates across surfaces that render at the same time. */
  layoutId?: string;
  tone?: 'default' | 'admin';
  trailing?: React.ReactNode;
}

const FOCUS_RING = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 dark:focus-visible:ring-emerald-800';

export default function NavButton({ active, onClick, icon, label, variant, layoutId, tone = 'default', trailing }: NavButtonProps) {
  if (variant === 'bottom') {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-current={active ? 'page' : undefined}
        aria-label={label}
        className={cn(
          'flex-1 flex flex-col items-center gap-0.5 py-2 pt-3 rounded-xl transition-colors',
          FOCUS_RING,
          active ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400 dark:text-stone-500',
        )}
      >
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  }

  const isDrawer = variant === 'drawer';
  const activeTone =
    tone === 'admin'
      ? 'text-amber-900 dark:text-amber-200'
      : 'text-emerald-700 dark:text-emerald-400';
  const activePillTone =
    tone === 'admin'
      ? 'bg-amber-50 dark:bg-amber-950/40'
      : 'bg-emerald-50 dark:bg-emerald-900/30';

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'relative w-full flex items-center gap-3 rounded-xl transition-colors duration-150',
        isDrawer ? 'px-3 py-3 text-sm' : 'px-4 py-3',
        FOCUS_RING,
        active ? cn(activeTone, 'font-medium') : 'text-stone-600 dark:text-stone-400 hover:bg-stone-50 dark:hover:bg-slate-800',
        tone === 'admin' && 'border border-dashed border-stone-200 dark:border-stone-600',
      )}
    >
      {active && (
        <motion.span
          layoutId={layoutId}
          transition={{ type: 'spring', bounce: 0.15, duration: 0.35 }}
          className={cn('absolute inset-0 rounded-xl', activePillTone, !isDrawer && 'shadow-sm')}
        />
      )}
      <span className="relative shrink-0">{icon}</span>
      <span className="relative">{label}</span>
      {trailing && <span className="relative ml-auto">{trailing}</span>}
    </button>
  );
}
