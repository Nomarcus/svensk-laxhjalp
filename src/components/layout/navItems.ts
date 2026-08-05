import { MessageSquare, Calendar, CheckSquare, Library, Info, type LucideIcon } from 'lucide-react';
import type { AppTab } from '../../types';

export interface NavItemConfig {
  id: Extract<AppTab, 'chat' | 'planner' | 'corrector' | 'library' | 'info'>;
  Icon: LucideIcon;
  labelKey: string;
  shortLabelKey: string;
  /** Whether this item also appears in the mobile bottom tab bar (the rest live behind "More"). */
  inBottomBar: boolean;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { id: 'chat', Icon: MessageSquare, labelKey: 'nav.aiAssistant', shortLabelKey: 'nav.aiHelp', inBottomBar: true },
  { id: 'planner', Icon: Calendar, labelKey: 'nav.planner', shortLabelKey: 'nav.plannerShort', inBottomBar: true },
  { id: 'corrector', Icon: CheckSquare, labelKey: 'nav.corrector', shortLabelKey: 'nav.correctorShort', inBottomBar: true },
  { id: 'library', Icon: Library, labelKey: 'nav.library', shortLabelKey: 'nav.libraryShort', inBottomBar: true },
  { id: 'info', Icon: Info, labelKey: 'nav.info', shortLabelKey: 'nav.info', inBottomBar: false },
];
