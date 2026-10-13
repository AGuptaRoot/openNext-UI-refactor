import { crmApi } from '../services/api';
import type { AssignableUser } from '../types/leads';
import type { ProjectItem, ProjectMember } from '../types/projects';

export type ProjectAssigneeOption = {
  id: string;
  name: string;
  designation?: string;
  /** Display label: "Name — Designation" when designation exists */
  label: string;
};

function userIdOf(user: AssignableUser): string {
  return String(user.id || user._id || user.userId || '');
}

function displayNameOf(user?: AssignableUser | null, fallback = 'Team Member'): string {
  if (!user) return fallback;
  return (
    user.displayName ||
    user.name ||
    user.username ||
    (user.email ? user.email.split('@')[0] : '') ||
    fallback
  );
}

function formatAssigneeLabel(name: string, designation?: string): string {
  const cleanName = String(name || '').trim() || 'Team Member';
  const cleanDesignation = String(designation || '').trim();
  return cleanDesignation ? `${cleanName} — ${cleanDesignation}` : cleanName;
}

function memberDisplayName(member: ProjectMember, users: AssignableUser[]): string {
  const fromMember =
    member.displayName ||
    member.name ||
    member.userName ||
    member.username ||
    (member.email ? member.email.split('@')[0] : '');
  if (fromMember && !/^[0-9a-fA-F]{24}$/.test(fromMember)) return fromMember;
  const user = users.find((u) => userIdOf(u) === String(member.userId));
  return displayNameOf(user, fromMember || 'Team Member');
}

function memberDesignation(member: ProjectMember, users: AssignableUser[]): string | undefined {
  if (member.designation) return String(member.designation).trim() || undefined;
  const user = users.find((u) => userIdOf(u) === String(member.userId));
  return user?.designation ? String(user.designation).trim() || undefined : undefined;
}

/**
 * Build assignee options from project team only:
 * ProjectMember rows ∪ project.assignedTo ∪ project.createdBy.
 * Matches API assertValidTaskAssignee / legacy getMembersForProject.
 */
export function buildProjectAssigneeOptions(params: {
  members?: ProjectMember[] | null;
  project?: (Pick<ProjectItem, 'assignedTo'> & { createdBy?: string }) | null;
  users?: AssignableUser[] | null;
  ensureUserIds?: Array<string | undefined | null>;
}): ProjectAssigneeOption[] {
  const users = params.users || [];
  const map = new Map<string, ProjectAssigneeOption>();

  const addId = (rawId?: string | null, preferredName?: string, preferredDesignation?: string) => {
    const id = String(rawId || '').trim();
    if (!id || id === 'unassigned' || id === 'none' || id === 'null') return;
    if (map.has(id)) {
      const existing = map.get(id)!;
      if (!existing.designation && preferredDesignation) {
        map.set(id, {
          ...existing,
          designation: preferredDesignation,
          label: formatAssigneeLabel(existing.name, preferredDesignation),
        });
      }
      return;
    }
    const user = users.find((u) => userIdOf(u) === id);
    const name = preferredName || displayNameOf(user, id);
    const designation =
      preferredDesignation ||
      (user?.designation ? String(user.designation).trim() || undefined : undefined);
    map.set(id, {
      id,
      name,
      designation,
      label: formatAssigneeLabel(name, designation),
    });
  };

  for (const member of params.members || []) {
    if (!member?.userId) continue;
    addId(member.userId, memberDisplayName(member, users), memberDesignation(member, users));
  }

  const assigned = params.project?.assignedTo;
  if (Array.isArray(assigned)) {
    assigned.forEach((uid) => addId(uid));
  } else if (assigned) {
    addId(String(assigned));
  }

  if (params.project?.createdBy) {
    addId(params.project.createdBy);
  }

  for (const uid of params.ensureUserIds || []) {
    addId(uid);
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/** Keep only the current user in assignee options (crm-employee self-assign). */
export function filterAssigneeOptionsToSelf(
  options: ProjectAssigneeOption[],
  currentUserId?: string | null,
  fallbackUser?: AssignableUser | null
): ProjectAssigneeOption[] {
  const selfId = String(currentUserId || '').trim();
  if (!selfId) return [];
  const match = options.find((opt) => String(opt.id) === selfId);
  if (match) return [match];
  if (!fallbackUser) return [];
  const name = displayNameOf(fallbackUser, 'You');
  const designation = fallbackUser.designation
    ? String(fallbackUser.designation).trim() || undefined
    : undefined;
  return [
    {
      id: selfId,
      name,
      designation,
      label: formatAssigneeLabel(name, designation),
    },
  ];
}

/** Load project team assignee options for a project id. */
export async function loadProjectAssigneeOptions(
  projectId: string,
  users: AssignableUser[] = [],
  ensureUserIds: Array<string | undefined | null> = []
): Promise<ProjectAssigneeOption[]> {
  if (!projectId) return [];
  const [membersRes, projectRes] = await Promise.all([
    crmApi.getProjectMembers(projectId).catch(() => ({ data: [] as ProjectMember[] })),
    crmApi.getProject(projectId).catch(() => ({ data: null as ProjectItem | null })),
  ]);
  return buildProjectAssigneeOptions({
    members: membersRes.data || [],
    project: projectRes.data || null,
    users,
    ensureUserIds,
  });
}
