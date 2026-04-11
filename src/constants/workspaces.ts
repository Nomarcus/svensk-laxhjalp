export const WORKSPACE_GENERAL_ID = 'workspace_general';
export const WORKSPACE_TEACHER_ID = 'workspace_teacher';

export function isWorkspaceChildId(id: string): boolean {
  return id === WORKSPACE_GENERAL_ID || id === WORKSPACE_TEACHER_ID;
}

export function isGeneralWorkspaceId(id: string): boolean {
  return id === WORKSPACE_GENERAL_ID;
}

export function isTeacherWorkspaceId(id: string): boolean {
  return id === WORKSPACE_TEACHER_ID;
}
