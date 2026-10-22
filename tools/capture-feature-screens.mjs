#!/usr/bin/env node
// Real Kairo screens for the feature reels (booked while you slept, the
// waitlist filling a cancellation, the no-show rules), captured from Kairo
// itself on sample data at iPhone size (390x844 @3x). Nothing here is mocked:
// the settings are set through the API, the no-shows and the waitlist are real
// rows, and the cancellation really runs the waitlist offer.
//   KAIRO_REPO=/path/to/Appointment-software- node tools/capture-feature-screens.mjs
// Writes public/screenshots/feature/*.png and feature.json (what each shows).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const R = process.env.KAIRO_REPO || path.resolve(ROOT, '..', 'Appointment-software-');
const OUT = path.join(ROOT, 'public', 'screenshots', 'feature');
fs.mkdirSync(OUT, { recursive: true });
const { startKairo } = await import(`${R}/test/helpers/kairo.js`);

const k = await startKairo({ env: { KAIRO_RATELIMIT: 'off', KAIRO_APP_STORE_LOOKUP: 'off', KAIRO_PUBLIC_URL: 'https://luxehair.kairobookings.com' } });
let { cookie } = await k.login();
await k.api('PUT', '/api/auth/password', { cookie, body: { current: 'admin123', next: 'a-long-sample-passphrase-2026' } });
({ cookie } = await k.login('admin@kairo.local', 'a-long-sample-passphrase-2026'));
const api = async (m, p, body) => {
  const r = await k.api(m, p, { cookie, body });
  if (r.status >= 300) throw new Error(`${m} ${p} ${r.status} ${r.text}`);
  return r.json;
};

await api('POST', '/api/setup/skip', { keep_samples: true });
await api('PUT', '/api/settings', {
  business_name: 'Luxe Hair', currency_code: 'aud', business_tz: 'Australia/Melbourne',
  sms_notifications_enabled: '1', chan_confirmation: 'sms',
  noshow_deposit_after: '2', noshow_block_after: '3', confirm_requests_enabled: '1',
  waitlist_enabled: '1', waitlist_autofill: '1', waitlist_channel: 'sms', waitlist_max_offers: '5',
});
// The sample stylist "Sha" would read as a real salon's owner; rename her.
const staff = await api('GET', '/api/staff');
const sha = staff.find((x) => /^sha\b/i.test(x.name));
if (sha) await api('PUT', `/api/staff/${sha.id}`, { name: 'Jess' });
const services = await api('GET', '/api/services');
const svc = (re) => services.find((s) => re.test(s.name)) || services[0];
const cut = svc(/cut/i), colour = svc(/balayage|colour/i);

// Dates around today in Melbourne.
const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'Australia/Melbourne' }));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const plus = (n) => { const d = new Date(today); d.setDate(d.getDate() + n); return iso(d); };
const nextSat = (() => { const d = new Date(today); d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7 || 7)); return iso(d); })();

const book = (client, service, date, start, extra = {}) => api('POST', '/api/appointments', {
  ...(typeof client === 'number' ? { client_id: client } : { new_client: client }),
  staff_id: 1, service_id: service.id, date, start_min: start, notify_client: false, force: true, ...extra,
});
const idOf = (a) => a.id || a.appointment?.id;
const clientOf = async (a) => a.client_id;

// 1. A client who has missed twice in the last 90 days.
const m1 = await book({ first_name: 'Mia', last_name: 'Thompson', email: 'mia.t@example.com', phone: '0412 555 019' }, cut, plus(-40), 600);
const miaId = await clientOf(m1);
await api('PATCH', `/api/appointments/${idOf(m1)}/status`, { status: 'no_show' });
const m2 = await book(miaId, cut, plus(-12), 660);
await api('PATCH', `/api/appointments/${idOf(m2)}/status`, { status: 'no_show' });

// 2. Three people on the waitlist for Saturday, and Zoe booked at 10.
const waiting = [];
for (const [first, last, phone] of [['Chloe', 'Nguyen', '0413 222 801'], ['Priya', 'Sharma', '0414 330 512'], ['Ava', 'Rossi', '0415 448 277']]) {
  const c = await api('POST', '/api/clients', { first_name: first, last_name: last, phone, email: `${first.toLowerCase()}@example.com`});
  const id = c.id || c.client?.id;
  await api('POST', '/api/waitlist', { client_id: id, weekdays: '6', note: 'Any Saturday morning' });
  waiting.push(id);
}
const zoe = await book({ first_name: 'Zoe', last_name: 'Bennett', email: 'zoe.b@example.com', phone: '0416 771 203' }, colour, nextSat, 600);
// Plus a full-looking day around it.
await book({ first_name: 'Grace', last_name: 'Owusu', email: 'grace@example.com', phone: '0417 100 200' }, cut, nextSat, 540);
await book({ first_name: 'Naomi', last_name: 'Reid', email: 'naomi@example.com', phone: '0418 300 400' }, cut, nextSat, 780);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, timezoneId: 'Australia/Melbourne', locale: 'en-AU' });
const [cn, cv] = cookie.split(';')[0].split('=');
await ctx.addCookies([{ name: cn, value: cv, url: k.base }]);
await ctx.addInitScript(() => {
  try { localStorage.setItem('kairo_tour_done', '1'); } catch {}
  // The "finish setting up" card lists what this sample install hasn't done
  // (email, texts, payments); a salon that has set up never sees it.
  document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style'); st.textContent = '#setup-checklist{display:none!important}';
    document.head.appendChild(st);
  });
});
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const shots = {};
const rects = {};
// Where something is on the screen, in screenshot pixels (x3), found by its text.
const rectOf = (page, text, closest = '*') => page.evaluate(([t, c]) => {
  const all = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.textContent.trim().startsWith(t));
  const el = all.find((e) => e.getBoundingClientRect().width > 0);
  if (!el) return null;
  const box = (c === '*' ? el : el.closest(c)) || el;
  const r = box.getBoundingClientRect();
  return { x: Math.round(r.x * 3), y: Math.round(r.y * 3), w: Math.round(r.width * 3), h: Math.round(r.height * 3) };
}, [text, closest]);
const shot = async (name, note) => { await p.waitForTimeout(500); await p.screenshot({ path: `${OUT}/${name}.png` }); shots[name] = note; console.log('shot', name); };
const scrollTo = (sel) => p.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'start' }), sel);
// Settings cards live in tabbed groups: open the card's group, then scroll to it.
const openCard = async (sec) => {
  const group = await p.getAttribute(`[data-sec="${sec}"]`, 'data-group');
  await p.click(`.set-tab[data-group="${group}"]`); await p.waitForTimeout(700);
  await scrollTo(`[data-sec="${sec}"]`); await p.waitForTimeout(900);
};

// Settings: the no-show rules and the waitlist, switched on.
await p.goto(`${k.base}/#/settings`); await p.waitForSelector('[data-sec="noshow"]', { state: 'attached', timeout: 20000 });
await openCard('noshow');
await shot('settings-noshow', 'Settings → No-shows: deposit after 2, phone-only after 3');
await openCard('waitlist');
await shot('settings-waitlist', 'Settings → Waitlist & automatic filling, both switches on');

// Mia's record: flagged, with the owner's override.
await p.goto(`${k.base}/#/clients`); await p.waitForTimeout(1500);
await p.locator('text=Mia Thompson').first().click(); await p.waitForTimeout(1500);
await shot('client-mia', "Mia's record: 2 no-shows, deposit required, and Your rules / Always trusted / Phone only");
rects['client-mia'] = {
  history: await rectOf(p, 'History', '*'),
  badges: await p.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => /^\s*No-show\s*$/.test(e.textContent) && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().width < 200)
    .slice(-2).map((e) => { const r = e.getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; })),
  deposit: await rectOf(p, 'Asked for a deposit', 'div'),
  rules: await rectOf(p, 'Your rules', 'div'),
  trusted: await rectOf(p, 'Always trusted', '*'),
  phoneOnly: await rectOf(p, 'Phone only', '*'),
};

// Hash navigation keeps a client drawer open; a reload starts each screen clean.
const go = async (hash) => { await p.goto(`${k.base}/${hash}`); await p.reload(); await p.waitForTimeout(2200); };
// Saturday before the cancellation.
await go(`#/calendar?date=${nextSat}`);
await shot('calendar-sat-before', `Saturday ${nextSat} with Zoe at 10:00`);
rects['calendar-sat-before'] = { zoe: await rectOf(p, 'Zoe', '[data-appt]') };

// Zoe cancels (as the client would): the waitlist offer runs.
await api('POST', `/api/appointments/${idOf(zoe)}/cancel`, { reason: 'Something came up', notify_client: false });
await go(`#/calendar?date=${nextSat}`);
await shot('calendar-sat-empty', 'Saturday the moment Zoe cancelled: 10:00 is free');
await go('#/messages');
await shot('messages-offers', 'Messages: the waitlist offers that went out the moment Zoe cancelled');
rects['messages-offers'] = { first: await rectOf(p, 'Ava Rossi', 'div'), list: await rectOf(p, 'All', '*') };

// Chloe takes it (booked straight into the freed slot).
const chloe = await book(waiting[0], colour, nextSat, 600);
await go(`#/calendar?date=${nextSat}`);
await shot('calendar-sat-after', 'Saturday again: Chloe in the 10:00 Zoe gave up');
rects['calendar-sat-after'] = { chloe: await rectOf(p, 'Chloe', '[data-appt]') };

// The public booking page, a client's whole path.
const bp = await ctx.newPage();
bp.on('pageerror', (e) => errs.push('book: ' + e.message));
await bp.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await bp.goto(`${k.base}/book`); await bp.waitForTimeout(2500);
const bshot = async (name, note) => { await bp.waitForTimeout(700); await bp.screenshot({ path: `${OUT}/${name}.png` }); shots[name] = note; console.log('shot', name); };
await bshot('book-1-services', 'Booking page: the services');
await bp.locator('.svc-pick', { hasText: 'Balayage' }).first().click(); await bp.waitForTimeout(600);
await bshot('book-2-picked', 'Booking page: Balayage picked, Continue bar');
rects['book-1-services'] = { balayage: await rectOf(bp, 'Balayage', 'button') };
await bp.click('#cart-continue'); await bp.waitForTimeout(1500);
// A staff or location choice may come first; take the first option until the times show.
for (let i = 0; i < 3 && !(await bp.$('#slots')); i++) {
  const opt = await bp.$('.bk-option:not(.svc-pick)'); if (!opt) break; await opt.click(); await bp.waitForTimeout(1500);
}
// Today may be nearly over; take a day next week, as a client planning ahead would.
await bp.locator('.date-chip').nth(4).click();
await bp.waitForSelector('#slots .slot', { timeout: 15000 });
await bshot('book-3-times', 'Booking page: the times, with the waitlist line under them');
await bp.locator('#slots .slot').nth(2).click(); await bp.waitForTimeout(400);
await bshot('book-3b-time-picked', 'Booking page: a time picked');
rects['book-3b-time-picked'] = { slot: await bp.evaluate(() => { const r = document.querySelectorAll('#slots .slot')[2].getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }) };
await bp.click('#next'); await bp.waitForSelector('#bk-form', { timeout: 15000 });
await bp.fill('#bk-form [name=first_name]', 'Amara'); await bp.fill('#bk-form [name=last_name]', 'Okafor');
await bp.fill('#bk-form [name=phone]', '0412 345 678'); await bp.fill('#bk-form [name=email]', 'amara.okafor@example.com');
await bshot('book-4-details', 'Booking page: details');
rects['book-4-details'] = { confirm: await bp.evaluate(() => { const r = document.querySelector('#bk-form button[type=submit]').getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }) };
await bp.click('#bk-form button[type=submit]'); await bp.waitForTimeout(2500);
await bshot('book-5-done', 'Booking page: booked');
// The waitlist form, as a client sees it.
const wp = await ctx.newPage();
await wp.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await wp.goto(`${k.base}/book`); await wp.waitForTimeout(2000);
await wp.locator('.svc-pick', { hasText: 'Balayage' }).first().click(); await wp.click('#cart-continue'); await wp.waitForTimeout(1500);
for (let i = 0; i < 3 && !(await wp.$('#slots')); i++) {
  const opt = await wp.$('.bk-option:not(.svc-pick)'); if (!opt) break; await opt.click(); await wp.waitForTimeout(1500);
}
await wp.locator('.date-chip').nth(4).click();
await wp.waitForSelector('#join-wl-foot', { timeout: 15000 }); await wp.click('#join-wl-foot'); await wp.waitForTimeout(1200);
await wp.screenshot({ path: `${OUT}/book-waitlist.png` }); shots['book-waitlist'] = 'Booking page: put me on the waitlist';
console.log('shot book-waitlist');

// The dashboard, for "good morning".
await go('#/dashboard');
await shot('dashboard', 'Dashboard');

fs.writeFileSync(`${OUT}/feature.json`, JSON.stringify({ captured: new Date().toISOString(), size: [1170, 2532], nextSat, shots, rects }, null, 1));
console.log('errors:', errs.length ? errs : 'none');
await b.close(); await k.stop();
