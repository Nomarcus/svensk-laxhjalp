import type { TFunction } from 'i18next';
import { WORKSPACE_GENERAL_ID, WORKSPACE_TEACHER_ID } from '../constants/workspaces';
import type { Child } from '../types';

export function childDisplayName(child: Pick<Child, 'id' | 'name'>, t: TFunction): string {
  if (child.id === WORKSPACE_GENERAL_ID) return t('workspace.generalLabel');
  if (child.id === WORKSPACE_TEACHER_ID) return t('workspace.teacherLabel');
  return child.name;
}
