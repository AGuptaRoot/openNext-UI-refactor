/**
 * Hide MongoDB / entity document IDs from end-user UI labels.
 * People may be shown as name and/or userId/username — never as raw ObjectIds.
 */

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
/** Non-person entity mock / generated primary keys */
const ENTITY_MOCK_ID_RE =
  /^(client|lead|proj|project|task|inv|invoice|quo|quote|quotation|pay|payment|exp|expense|ticket|so|order|opp|opportunity|tl|log|sample|campaign|note|contact|addr|refund|alloc)_/i;

/** True for Mongo ObjectIds, UUIDs, and non-person document keys. */
export function isDocumentId(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return false;
  if (OBJECT_ID_RE.test(text)) return true;
  if (UUID_RE.test(text)) return true;
  if (ENTITY_MOCK_ID_RE.test(text)) return true;
  return false;
}

function pickReadable(...candidates: unknown[]): string {
  for (const candidate of candidates) {
    const text = String(candidate ?? '').trim();
    if (!text) continue;
    if (isDocumentId(text)) continue;
    return text;
  }
  return '';
}

/** First usable label for records/docs; skips empty values and document IDs. */
export function displayLabel(...candidates: unknown[]): string {
  return pickReadable(...candidates) || '—';
}

/** Same as displayLabel but returns empty string when nothing usable. */
export function displayLabelOrEmpty(...candidates: unknown[]): string {
  return pickReadable(...candidates);
}

type UserLike = {
  name?: string | null;
  displayName?: string | null;
  username?: string | null;
  userId?: string | null;
  email?: string | null;
};

/**
 * Show people as name and/or userId (username).
 * Examples: "Priya Sharma", "Priya Sharma (ppatel)", "ppatel"
 * Never shows MongoDB ObjectIds.
 */
export function displayUserLabel(
  nameOrUser?: unknown,
  userIdOrUsername?: unknown,
  fallback: string = '—'
): string {
  let name = '';
  let userId = '';

  if (nameOrUser && typeof nameOrUser === 'object') {
    const user = nameOrUser as UserLike;
    name = pickReadable(user.displayName, user.name);
    userId = pickReadable(user.username, user.userId, user.email);
  } else {
    name = pickReadable(nameOrUser);
  }

  const second = pickReadable(userIdOrUsername);
  if (second) {
    // If first slot was empty and second looks like a login id, treat as userId
    if (!name) {
      userId = userId || second;
    } else if (!userId && second !== name) {
      userId = second;
    } else if (!userId) {
      userId = second;
    }
  }

  // If "name" looks like a bare login id and we have no separate userId, keep it as userId-only
  if (name && !userId && /^[a-z0-9._@+-]+$/i.test(name) && !/\s/.test(name) && name.length <= 64) {
    // Still fine to show as the label (userid)
    return name;
  }

  if (name && userId && name !== userId) return `${name} (${userId})`;
  if (name) return name;
  if (userId) return userId;
  return fallback;
}
