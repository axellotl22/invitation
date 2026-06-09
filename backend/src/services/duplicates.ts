import { prisma } from '../lib/prisma.js';

export interface DuplicateCandidate {
  a: HouseholdSummary;
  b: HouseholdSummary;
  reasons: string[]; // i18n keys, e.g. duplicates.reason.similarName
}

export interface HouseholdSummary {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: string;
  respondedAt: Date | null;
  members: { id: string; name: string; attending: boolean | null }[];
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function similarity(a: string, b: string): number {
  const max = Math.max(a.length, b.length);
  if (max === 0) return 1;
  return 1 - levenshtein(a, b) / max;
}

function memberNameSet(members: { name: string }[]): string[] {
  return members.map((m) => normalize(m.name)).filter(Boolean).sort();
}

function sameMemberSet(a: string[], b: string[]): boolean {
  if (a.length === 0 || a.length !== b.length) return false;
  return a.every((v, i) => v === b[i]);
}

/** Find candidate duplicate household pairs for an invitation. */
export async function findDuplicates(invitationId: string): Promise<DuplicateCandidate[]> {
  const [households, dismissed] = await Promise.all([
    prisma.household.findMany({
      where: { invitationId, duplicateOfId: null },
      include: { members: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.dismissedPair.findMany({ where: { invitationId } }),
  ]);

  const dismissedKeys = new Set(dismissed.flatMap((d) => [`${d.aId}:${d.bId}`, `${d.bId}:${d.aId}`]));
  const candidates: DuplicateCandidate[] = [];

  for (let i = 0; i < households.length; i++) {
    for (let j = i + 1; j < households.length; j++) {
      const a = households[i];
      const b = households[j];
      if (dismissedKeys.has(`${a.id}:${b.id}`)) continue;

      const reasons: string[] = [];
      if (similarity(normalize(a.name), normalize(b.name)) >= 0.8) {
        reasons.push('duplicates.reason.similarName');
      }
      if (a.email && b.email && a.email.toLowerCase() === b.email.toLowerCase()) {
        reasons.push('duplicates.reason.sameEmail');
      }
      if (sameMemberSet(memberNameSet(a.members), memberNameSet(b.members))) {
        reasons.push('duplicates.reason.sameMembers');
      }
      if (reasons.length > 0) {
        candidates.push({ a: toSummary(a), b: toSummary(b), reasons });
      }
    }
  }
  return candidates;
}

function toSummary(h: {
  id: string;
  name: string;
  email: string | null;
  rsvpStatus: string;
  respondedAt: Date | null;
  members: { id: string; name: string; attending: boolean | null }[];
}): HouseholdSummary {
  return {
    id: h.id,
    name: h.name,
    email: h.email,
    rsvpStatus: h.rsvpStatus,
    respondedAt: h.respondedAt,
    members: h.members.map((m) => ({ id: m.id, name: m.name, attending: m.attending })),
  };
}
