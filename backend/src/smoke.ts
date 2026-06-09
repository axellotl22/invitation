/**
 * End-to-end smoke test against the in-process app.
 * Run with: npm test  (uses a throwaway SQLite db)
 */
process.env.DATABASE_URL = 'file:./smoke.db';
import { execSync } from 'node:child_process';
import { rmSync } from 'node:fs';

rmSync('./prisma/smoke.db', { force: true });
execSync('npx prisma migrate deploy', { stdio: 'inherit', env: process.env });

const { buildApp } = await import('./app.js');
const app = await buildApp();

let failures = 0;
function check(name: string, cond: boolean, extra?: unknown): void {
  if (cond) console.log(`  ok: ${name}`);
  else {
    failures++;
    console.error(`FAIL: ${name}`, extra ?? '');
  }
}

// --- register + login ---
const reg = await app.inject({
  method: 'POST',
  url: '/api/auth/register',
  payload: { email: 'host@example.com', password: 'supersecret', name: 'Host', locale: 'de' },
});
check('register', reg.statusCode === 200, reg.body);
const cookie = reg.cookies.find((c) => c.name === 'session');
check('session cookie set', !!cookie);
const auth = { cookie: `session=${cookie!.value}` };

// --- create invitation ---
const inv = await app.inject({
  method: 'POST',
  url: '/api/invitations',
  headers: auth,
  payload: { title: 'Hochzeit', description: 'Wir heiraten!', location: 'Berlin', startsAt: '2026-09-12T15:00:00Z' },
});
check('create invitation', inv.statusCode === 200, inv.body);
const invitation = inv.json();

// --- questions ---
const q1 = await app.inject({
  method: 'POST',
  url: `/api/invitations/${invitation.id}/questions`,
  headers: auth,
  payload: {
    type: 'SINGLE_CHOICE',
    scope: 'PER_MEMBER',
    required: true,
    labelEn: 'Meal choice',
    labelDe: 'Menüwahl',
    optionsEn: ['Meat', 'Veggie'],
    optionsDe: ['Fleisch', 'Vegetarisch'],
  },
});
check('create per-member question', q1.statusCode === 200, q1.body);
const q2 = await app.inject({
  method: 'POST',
  url: `/api/invitations/${invitation.id}/questions`,
  headers: auth,
  payload: { type: 'TEXT', scope: 'PER_HOUSEHOLD', labelEn: 'Song wish?', labelDe: 'Musikwunsch?' },
});
check('create per-household question', q2.statusCode === 200, q2.body);

// --- households ---
const hh = await app.inject({
  method: 'POST',
  url: `/api/invitations/${invitation.id}/households`,
  headers: auth,
  payload: { name: 'Familie Müller', email: 'mueller@example.com', members: ['Anna', 'Tom'] },
});
check('create household', hh.statusCode === 200, hh.body);
const household = hh.json();
const dup = await app.inject({
  method: 'POST',
  url: `/api/invitations/${invitation.id}/households`,
  headers: auth,
  payload: { name: 'Familie Mueller', email: 'mueller@example.com', members: ['Anna', 'Tom'] },
});
check('create duplicate household', dup.statusCode === 200);

// --- public flow ---
const pub = await app.inject({ method: 'GET', url: `/api/i/${invitation.slug}` });
check('public invitation', pub.statusCode === 200 && pub.json().title === 'Hochzeit');

const badPin = await app.inject({
  method: 'POST',
  url: `/api/i/${invitation.slug}/pin`,
  payload: { pin: household.pin === '000000' ? '000001' : '000000' },
});
check('wrong pin rejected', badPin.statusCode === 401, badPin.body);

const pinOk = await app.inject({
  method: 'POST',
  url: `/api/i/${invitation.slug}/pin`,
  payload: { pin: household.pin },
});
check('pin accepted', pinOk.statusCode === 200, pinOk.body);
const token = pinOk.json().token as string;
const tokenHeader = { 'x-household-token': token };

const hhGet = await app.inject({ method: 'GET', url: `/api/i/${invitation.slug}/household`, headers: tokenHeader });
check('household fetch', hhGet.statusCode === 200, hhGet.body);
const hhData = hhGet.json();
check('two members', hhData.household.members.length === 2);
check('two questions', hhData.questions.length === 2);

const mealQ = hhData.questions.find((q: { type: string }) => q.type === 'SINGLE_CHOICE');
const textQ = hhData.questions.find((q: { type: string }) => q.type === 'TEXT');
const [anna, tom] = hhData.household.members;

const missingRequired = await app.inject({
  method: 'PUT',
  url: `/api/i/${invitation.slug}/rsvp`,
  headers: tokenHeader,
  payload: {
    members: [
      { id: anna.id, attending: true },
      { id: tom.id, attending: false },
    ],
    answers: [],
  },
});
check('missing required rejected', missingRequired.statusCode === 400, missingRequired.body);

const rsvp = await app.inject({
  method: 'PUT',
  url: `/api/i/${invitation.slug}/rsvp`,
  headers: tokenHeader,
  payload: {
    members: [
      { id: anna.id, attending: true },
      { id: tom.id, attending: false },
    ],
    message: 'Wir freuen uns!',
    answers: [
      { questionId: mealQ.id, memberId: anna.id, value: 1 },
      { questionId: textQ.id, value: 'Atemlos' },
    ],
  },
});
check('rsvp accepted', rsvp.statusCode === 200, rsvp.body);

// --- duplicates ---
const dups = await app.inject({
  method: 'GET',
  url: `/api/invitations/${invitation.id}/duplicates`,
  headers: auth,
});
check('duplicate detected', dups.statusCode === 200 && dups.json().length === 1, dups.body);
const pair = dups.json()[0];
const merge = await app.inject({
  method: 'POST',
  url: `/api/invitations/${invitation.id}/duplicates/resolve`,
  headers: auth,
  payload: { action: 'merge', winnerId: household.id, loserId: pair.a.id === household.id ? pair.b.id : pair.a.id },
});
check('merge duplicates', merge.statusCode === 200, merge.body);

// merged-away PIN should resolve to the winner household
const dupPin = dup.json().pin as string;
const pinRedirect = await app.inject({
  method: 'POST',
  url: `/api/i/${invitation.slug}/pin`,
  payload: { pin: dupPin },
});
check('merged pin redirects', pinRedirect.statusCode === 200, pinRedirect.body);

// --- stats + csv ---
const detail = await app.inject({ method: 'GET', url: `/api/invitations/${invitation.id}`, headers: auth });
const stats = detail.json().stats;
check('stats: 1 household after merge', stats.households === 1, JSON.stringify(stats));
check('stats: 1 attending, 1 declined', stats.attending === 1 && stats.declined === 1, JSON.stringify(stats));

const csv = await app.inject({ method: 'GET', url: `/api/invitations/${invitation.id}/rsvps.csv?lang=de`, headers: auth });
check('csv export', csv.statusCode === 200 && csv.body.includes('Vegetarisch'), csv.body);

// --- ownership: another user must not see the invitation ---
const reg2 = await app.inject({
  method: 'POST',
  url: '/api/auth/register',
  payload: { email: 'other@example.com', password: 'supersecret' },
});
const cookie2 = reg2.cookies.find((c) => c.name === 'session');
const stolen = await app.inject({
  method: 'GET',
  url: `/api/invitations/${invitation.id}`,
  headers: { cookie: `session=${cookie2!.value}` },
});
check('ownership enforced', stolen.statusCode === 404, stolen.body);

await app.close();
rmSync('./prisma/smoke.db', { force: true });

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');
