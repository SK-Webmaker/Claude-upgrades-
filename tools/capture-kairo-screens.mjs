// The real Kairo screens the reels use, captured from Kairo itself running on
// sample data (an Australian client, a Melbourne mobile), at iPhone size: 390x844 @3x.
//   KAIRO_REPO=/path/to/Appointment-software- node tools/capture-kairo-screens.mjs
// Writes public/screenshots/*.png and the measured rectangles beside them.
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
import { chromium } from 'playwright-core';
// A checkout of SK-Webmaker/Appointment-software- (Kairo itself): KAIRO_REPO=/path/to/it
const R = process.env.KAIRO_REPO || path.resolve(ROOT, '..', 'Appointment-software-');
const OUT = path.join(ROOT, 'public', 'screenshots');
const { startKairo } = await import(`${R}/test/helpers/kairo.js`);
const k = await startKairo({ env: { KAIRO_RATELIMIT: 'off', KAIRO_APP_STORE_LOOKUP: 'off' } });
let { cookie } = await k.login();
// An owner who has set their own password: no default-password banner.
await k.api('PUT', '/api/auth/password', { cookie, body: { current: 'admin123', next: 'a-long-sample-passphrase-2026' } });
({ cookie } = await k.login('admin@kairo.local', 'a-long-sample-passphrase-2026'));
const api = async (m, p, body) => { const r = await k.api(m, p, { cookie, body }); if (r.status >= 300) throw new Error(`${m} ${p} ${r.status} ${r.text}`); return r.json; };
await api('POST', '/api/setup/skip', { keep_samples: true });
await api('PUT', '/api/settings', { business_name: 'Luxe Hair', currency_code: 'aud', business_tz: 'Australia/Melbourne', sms_notifications_enabled: '1', chan_confirmation: 'sms' });
// The sample stylist "Sha" would read as a real salon's owner; rename her.
const staff = await api('GET', '/api/staff');
const sha = staff.find((x) => /^sha\b/i.test(x.name));
if (sha) await api('PUT', `/api/staff/${sha.id}`, { name: 'Jess' });
const svc = (await api('GET', '/api/services')).find((s) => /full colour/i.test(s.name)) || (await api('GET', '/api/services'))[0];
const DATE = '2026-10-14'; // a Wednesday, Melbourne spring
const ap = await api('POST', '/api/appointments', { new_client: { first_name: 'Amara', last_name: 'Okafor', email: 'amara.okafor@example.com', phone: '0412 345 678' }, staff_id: 1, service_id: svc.id, date: DATE, start_min: 600, notify_client: false, force: true });
const apptId = ap.id || ap.appointment?.id;
console.log('service', svc.name, 'appt', apptId);

const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
const [cn, cv] = cookie.split(';')[0].split('=');
await ctx.addCookies([{ name: cn, value: cv, url: k.base }]);
await ctx.addInitScript(() => { try { localStorage.setItem('kairo_tour_done', '1'); } catch {} });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message));
await p.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await p.goto(`${k.base}/#/calendar?date=${DATE}`); await p.waitForSelector(`[data-appt="${apptId}"]`, { timeout: 20000 }); await p.waitForTimeout(900);
// The day grid, scrolled the way a thumb would, so Amara's 10:00 sits in view.
await p.evaluate((id) => document.querySelector(`[data-appt="${id}"]`).scrollIntoView({ block: 'center' }), apptId); await p.waitForTimeout(600);
await p.screenshot({ path: `${OUT}/kairo-calendar-phone.png` });
const rect = (sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }, sel);
const meta = { scale: 3, viewport: [1170, 2532], calendar: { appt: await rect(`[data-appt="${apptId}"]`) } };
await p.click(`[data-appt="${apptId}"]`); await p.waitForSelector('#appt-save'); await p.waitForTimeout(500);
await p.selectOption('#appt-form select[name="start_min"]', '840');
await p.click('#appt-save'); await p.waitForSelector('.confirm-choices', { timeout: 10000 }); await p.waitForTimeout(700);
await p.screenshot({ path: `${OUT}/kairo-notify-prompt.png` });
const opts = await p.evaluate(() => [...document.querySelectorAll('.confirm-choices .confirm-opt')].map((l) => { const r = l.getBoundingClientRect(); return { text: l.innerText.replace(/\s+/g, ' ').trim(), checked: l.querySelector('input').checked, x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }));
const dialog = await p.evaluate(() => { const m = document.querySelector('.confirm-choices').closest('.modal, [role="dialog"], .modal-box, .sheet') || document.querySelector('.confirm-choices').parentElement; const r = m.getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3, text: m.innerText.replace(/\s+/g, ' ').trim().slice(0, 300) }; });
const r3 = (sel) => p.evaluate((s) => { const e = [...document.querySelectorAll(s)].pop(); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }, sel);
meta.prompt = { dialog, options: opts, save: await r3('[data-ok]'), back: await r3('[data-cancel]'), title: await p.evaluate(() => { const h = [...document.querySelectorAll('h2, h3, .modal-title, .mh-title')].find((e) => /Moving this appointment/.test(e.textContent)); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.x * 3, y: r.y * 3, w: r.width * 3, h: r.height * 3 }; }) };
await p.locator('.confirm-choices .confirm-opt', { hasText: "Don't send anything" }).click(); await p.waitForTimeout(400);
await p.screenshot({ path: `${OUT}/kairo-notify-prompt-none.png` });
meta.promptNone = { options: await p.evaluate(() => [...document.querySelectorAll('.confirm-choices .confirm-opt')].map((l) => ({ text: l.innerText.replace(/\s+/g, ' ').trim(), checked: l.querySelector('input').checked }))) };
fs.writeFileSync(`${OUT}/kairo-notify-prompt.json`, JSON.stringify(meta, null, 2));
console.log(JSON.stringify(meta, null, 1).slice(0, 1800));
console.log('errors:', errs.length ? errs : 'none');
await b.close(); await k.stop();
