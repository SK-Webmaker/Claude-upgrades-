#!/usr/bin/env node
/**
 * Week 9 reels — "Race week", on the week-8 frame-by-frame engine.
 *
 *   node scripts/make-week9-reels.mjs            # render both reels to MP4
 *   node scripts/make-week9-reels.mjs a          # just reel A
 *   node scripts/make-week9-reels.mjs --preview  # one still per scene
 *
 *   Reel A — "Race-day hair, the countdown". Caulfield Cup is Saturday 17
 *            October. Wednesday colour, Friday K18, Saturday 9am blow wave,
 *            with a racetrack progress rail and a jockey-silk marker running
 *            along it. It sells the weekend — the days that need filling.
 *   Reel B — "Myth or fact?". A five-round game show with stamps, the most
 *            named format in salon content guides this year. Entertaining is
 *            the brief; every round is true, and the score is a comment
 *            prompt.
 *
 * Drawn hair only (lib/hair-art.mjs). Prices via svc(). Hours are Kairo's:
 * Sat 9–5, Sun 11–4. No audio — she adds a track in the app.
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';
import { HAIR, strands, swatchFan, drop, glints } from './lib/hair-art.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const PHOTOS = join(ROOT, 'content', 'photos');
const OUT = join(ROOT, 'content', 'reels');
const FPS = 30;
const TD = 0.32; // transition length

const args = process.argv.slice(2);
const PREVIEW = args.includes('--preview');
const ONLY = args.find((a) => /^[ab]$/.test(a));

const INK = '#12100E', CREAM = '#F6F1E9', GOLD = '#C08B3E', FIG = '#2F4032', CLAY = '#C9A88B', HOT = '#A4532F';
const FONTS = readFileSync(join(ROOT, 'assets', 'fonts', 'brand-fonts.css'), 'utf8');
const BRAND = JSON.parse(readFileSync(join(ROOT, 'config', 'brand.json'), 'utf8'));
const REVIEWS = JSON.parse(readFileSync(join(ROOT, 'content', 'reviews.json'), 'utf8'));

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const chromiumPath = () =>
  [process.env.CHROMIUM_PATH, '/opt/pw-browsers/chromium'].find((p) => p && existsSync(p)) || undefined;

/** Every price on screen comes from brand.json; an unknown name throws. */
function svc(name) {
  const s = BRAND.positioning.services.find((x) => x.name === name);
  if (!s) throw new Error(`service not in brand.json: ${name}`);
  return s;
}
const price = (s) => (s.from ? `from $${s.price}` : `$${s.price}`);

/** Reviews are quoted verbatim from content/reviews.json, never retyped. */
function review(author) {
  const r = REVIEWS.reviews.find((x) => x.author === author);
  if (!r) throw new Error(`review not on file: ${author}`);
  return r;
}

/** Split a line into word spans so each can land on its own beat.
 *  [[phrase]] becomes one highlighted unit with a gold bar that sweeps in. */
function W(text) {
  return text
    .split(/(\[\[.*?\]\])/)
    .filter(Boolean)
    .map((p) =>
      p.startsWith('[[')
        ? `<span class="w mk"><i class="mkbg"></i><b>${esc(p.slice(2, -2))}</b></span>`
        : p.trim().split(/\s+/).filter(Boolean).map((w) => `<span class="w">${esc(w)}</span>`).join(' '),
    )
    .join(' ');
}

const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='320'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4'/%3E%3C/filter%3E%3Crect width='320' height='320' filter='url(%23n)' opacity='0.6'/%3E%3C/svg%3E\")";

/* ------------------------------------------------------------------ shared */
const CSS = `${FONTS}
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;overflow:hidden;background:${INK}}
  body{font-family:'Inter',sans-serif;-webkit-font-smoothing:antialiased;color:${CREAM}}
  .scene{position:absolute;inset:0;overflow:hidden;visibility:hidden;will-change:transform}
  .cam{position:absolute;inset:0}
  .ph{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
  .fr{font-family:'Fraunces',serif;font-weight:400;font-variation-settings:'opsz' 144;letter-spacing:-.035em;line-height:.92}
  .num{font-family:'Inter',sans-serif;font-weight:800;letter-spacing:-.055em;font-variant-numeric:tabular-nums;line-height:.86}
  .lbl{font-size:26px;letter-spacing:.3em;text-transform:uppercase;font-weight:800}
  .w{display:inline-block;opacity:0;will-change:transform}
  .mk{position:relative;isolation:isolate}
  .mkbg{position:absolute;left:-10px;right:-10px;top:14%;bottom:2%;background:${GOLD};transform-origin:left center;transform:scaleX(0);z-index:-1}
  .mk b{font-weight:inherit;position:relative}
  .scrimB{position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,16,14,.55) 0%,rgba(18,16,14,.05) 22%,rgba(18,16,14,.10) 40%,rgba(18,16,14,.86) 70%,rgba(18,16,14,.97) 100%)}
  .tint{position:absolute;inset:0;background:rgba(47,64,50,.18);mix-blend-mode:multiply}
  .safe{position:absolute;left:66px;right:190px}
  #grain{position:absolute;inset:-40px;background-image:${GRAIN};opacity:.14;mix-blend-mode:overlay;pointer-events:none;z-index:900}
  #vig{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 45%,rgba(0,0,0,0) 55%,rgba(0,0,0,.42) 100%);pointer-events:none;z-index:899}
  #flash{position:absolute;inset:0;background:${CREAM};opacity:0;pointer-events:none;z-index:950}
  .disc{position:absolute;border-radius:50%}
  .rays{position:absolute;border-radius:50%;background:repeating-conic-gradient(from 0deg,var(--c) 0deg 4deg,transparent 4deg 9deg)}
  .pill{display:inline-flex;align-items:center;gap:18px;border-radius:999px;font-weight:800;letter-spacing:.02em}
  .ticker{position:absolute;left:0;right:0;height:92px;overflow:hidden;display:flex;align-items:center}
  .ticker .tk{white-space:nowrap;font-size:34px;font-weight:800;letter-spacing:.16em;will-change:transform}
  .hair{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:50% 30%;will-change:transform,clip-path}
  .hair svg{position:absolute;left:0;top:0;overflow:visible}
  .chip{display:inline-block;padding:14px 26px;border-radius:999px;font-weight:800;font-size:30px;letter-spacing:.01em;opacity:0}
`;

/* The page-side animation kit. render(t) is the only entry point. */
const KIT = `
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const seg=(t,a,d)=>clamp((t-a)/d);
const lerp=(a,b,p)=>a+(b-a)*p;
const E={
  outExpo:p=>p>=1?1:1-Math.pow(2,-10*p),
  outCubic:p=>1-Math.pow(1-p,3),
  inOutCubic:p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2,
  outBack:p=>{const c1=1.9,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2);},
  inCubic:p=>p*p*p,
};
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
function words(root,lt,start,stag=.065,dur=.34,lift=52){
  $$('.w',root).forEach((w,i)=>{
    const p=seg(lt,start+i*stag,dur), e=E.outBack(p);
    w.style.opacity=clamp(p*2.2);
    w.style.transform='translateY('+((1-e)*lift)+'px) scale('+lerp(.82,1,e)+')';
    const bg=w.querySelector('.mkbg');
    if(bg) bg.style.transform='scaleX('+E.outExpo(seg(lt,start+i*stag+.22,.4))+')';
  });
}
function kb(img,lt,dur,from=1.16,to=1.03,dx=0,dy=0){
  const p=E.inOutCubic(clamp(lt/dur)), z=+(img.dataset.z||1);
  img.style.transform='translate('+(dx*p)+'px,'+(dy*p)+'px) scale('+(lerp(from,to,p)*z)+')';
}
function pop(el,lt,start,dur=.38,from=.6){
  const p=seg(lt,start,dur), e=E.outBack(p);
  el.style.opacity=clamp(p*2.4);
  el.style.transform='scale('+lerp(from,1,e)+')';
}
function rise(el,lt,start,dur=.4,dy=40){
  const p=seg(lt,start,dur), e=E.outCubic(p);
  el.style.opacity=p; el.style.transform='translateY('+((1-e)*dy)+'px)';
}
function slam(el,lt,start,dur=.42,from=2.4){
  const p=seg(lt,start,dur), e=E.outExpo(p);
  el.style.opacity=clamp(p*3);
  el.style.transform='scale('+lerp(from,1,e)+')';
  el.style.filter='blur('+((1-p)*22)+'px)';
}
function shake(cam,lt,at,dur=.22,amp=16){
  const p=seg(lt,at,dur);
  if(p<=0||p>=1){cam.style.transform='';return;}
  const a=amp*(1-p);
  cam.style.transform='translate('+(Math.sin(lt*120)*a)+'px,'+(Math.cos(lt*97)*a)+'px)';
}
function count(el,lt,start,dur,from,to,fmt=(n)=>n){
  const p=E.outExpo(seg(lt,start,dur));
  el.textContent=fmt(Math.round(lerp(from,to,p)));
}
function typer(el,lt,start,dur){
  const full=el.dataset.full, n=Math.floor(full.length*clamp(seg(lt,start,dur)));
  const caret=(n<full.length||Math.floor(lt*2.4)%2===0)?'<i class="caret"></i>':'';
  el.innerHTML=full.slice(0,n).replace(/&/g,'&amp;').replace(/</g,'&lt;')+caret;
}
function draw(el,lt,start,dur){ el.style.transform='scaleX('+E.inOutCubic(seg(lt,start,dur))+')'; }
/* Drawn hair: falls in from the top, then keeps moving — a slow sway and a
   breath of scale, so a still illustration never sits dead on screen. */
function fall(el,lt,start,dur){ const p=E.outCubic(seg(lt,start,dur)); el.style.clipPath='inset(0 0 '+((1-p)*100)+'% 0)'; }
function sway(el,lt,amp=14,deg=1.6,sp=1.1,z0=1.04,z1=1.12,dur=3){
  const k=E.inOutCubic(clamp(lt/dur));
  el.style.transform='translateX('+(Math.sin(lt*sp)*amp)+'px) skewX('+(Math.sin(lt*sp*.8+.6)*deg)+'deg) scale('+lerp(z0,z1,k)+')';
}
function twinkle(root,lt){ $$('.twk',root).forEach((g,i)=>{ const v=.5+.5*Math.sin(lt*4+i*1.7); g.style.opacity=(.2+.8*v).toFixed(2); g.style.transformBox='fill-box'; g.style.transformOrigin='center'; g.style.transform='scale('+(.6+.5*v)+') rotate('+(lt*40+i*20)+'deg)'; }); }

function transIn(sc,type,p){
  const s=sc.style;
  if(p>=1||!type){s.transform='';s.clipPath='';s.filter='';s.opacity='';return;}
  if(type==='whip'){const e=E.outExpo(p);s.transform='translateX('+((1-e)*100)+'%)';s.filter='blur('+((1-p)*26)+'px)';}
  if(type==='iris'){s.clipPath='circle('+(E.inOutCubic(p)*125)+'% at 50% 52%)';}
  if(type==='slice'){const a=lerp(135,0,E.inOutCubic(p));s.clipPath='polygon('+a+'% 0,100% 0,100% 100%,'+(a-35)+'% 100%)';}
  if(type==='punch'){const e=E.outExpo(p);s.transform='scale('+lerp(1.4,1,e)+')';s.opacity=clamp(p*2);s.filter='blur('+((1-p)*18)+'px)';}
  if(type==='drop'){const e=E.outExpo(p);s.transform='translateY('+((e-1)*100)+'%)';s.filter='blur('+((1-p)*20)+'px)';}
}
function transOut(sc,type,p){
  const s=sc.style;
  if(type==='whip'){s.transform='translateX('+(-38*E.inCubic(p))+'%)';s.filter='blur('+(p*22)+'px)';}
  else if(type==='drop'){s.transform='translateY('+(30*E.inCubic(p))+'%)';s.filter='brightness('+(1-.4*p)+')';}
  else {s.transform='scale('+(1+.07*p)+')';s.filter='brightness('+(1-.45*p)+')';}
}
window.render=function(t,frame){
  SCENES.forEach((sc,i)=>{
    const el=document.getElementById(sc.id), next=SCENES[i+1];
    const end=next?next.start+TD:sc.start+sc.dur;
    const on=t>=sc.start&&t<end;
    el.style.visibility=on?'visible':'hidden';
    if(!on) return;
    el.style.zIndex=10+i;
    const lt=t-sc.start;
    transIn(el,sc.in,sc.in?seg(lt,0,TD):1);
    if(next&&t>=next.start) transOut(el,next.in,seg(t-next.start,0,TD));
    UPD[sc.id](lt,el,sc.dur,t);
  });
  if(typeof OVERLAY==='function') OVERLAY(t);
  const g=document.getElementById('grain');
  g.style.transform='translate('+((frame*37)%40-20)+'px,'+((frame*53)%40-20)+'px)';
};
window.ready=Promise.all([...document.images].map(i=>i.decode().catch(()=>{}))).then(()=>document.fonts.ready);
`;

function page(scenesHtml, scenes, updJs, extraCss = '', overlayHtml = '', overlayJs = '') {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}${extraCss}</style></head><body>
    ${scenesHtml}
    ${overlayHtml}
    <div id="vig"></div><div id="grain"></div><div id="flash"></div>
    <script>
      const TD=${TD};
      const SCENES=${JSON.stringify(scenes)};
      ${KIT}
      const UPD={${updJs}};
      ${overlayJs}
    </script>
  </body></html>`;
}

/** A full-bleed fall of drawn hair for a 1080×1920 scene. */
function hairBg({ ramp, seed, n = 330, sway = 0.09, waves = 1.2, sheen = 0.6, glint = 7, cls = '', style = '' }) {
  return `<div class="hair ${cls}" style="${style}"><svg width="1080" height="1920" viewBox="0 0 1080 1920">
    <g transform="translate(-110 -60)">${strands({ w: 1300, h: 2080, seed, n, ramp, sway, waves, taper: 0.06, width: [1.6, 4.4], sheen })}</g>
    ${glint ? glints({ w: 1000, h: 1300, seed: seed + 1, n: glint, size: [12, 36] }) : ''}</svg></div>`;
}

function timeline(list) {
  let t = 0;
  return list.map((s) => {
    const o = { ...s, start: +t.toFixed(3) };
    t += s.dur;
    return o;
  });
}

const VIOLET = '#6A5B8C';

/* ================================================================ REEL A
   "Race-day hair, the countdown" — sells the weekend before Caulfield Cup. */
function reelA() {
  const gloss = svc('Toner & Gloss'), bal = svc('Balayage / Lived-in Blonde'), k18 = svc('K18 Treatment'), wave = svc('Blow Wave');
  const S = timeline([
    { id: 'r0', dur: 2.7, in: null },
    { id: 'r1', dur: 3.3, in: 'whip' },
    { id: 'r2', dur: 3.3, in: 'slice' },
    { id: 'r3', dur: 3.5, in: 'iris' },
    { id: 'r4', dur: 3.1, in: 'whip' },
    { id: 'r5', dur: 3.7, in: 'punch' },
  ]);
  const turf = `repeating-linear-gradient(115deg,#2F4032 0 120px,#35493A 120px 240px)`;
  const silkCss = `background:repeating-linear-gradient(90deg,${GOLD} 0 9px,${INK} 9px 18px);border:4px solid ${CREAM}`;

  const css = `
    .day{font-size:30px;letter-spacing:.34em;font-weight:800;text-transform:uppercase;color:${GOLD};opacity:0}
    .h2{font-size:118px;color:${CREAM};text-shadow:0 4px 50px rgba(0,0,0,.45)}
    .sub{font-size:42px;line-height:1.34;font-weight:600;color:rgba(246,241,233,.92);opacity:0;margin-top:28px;max-width:20ch}
    .chips{margin-top:34px;display:flex;flex-wrap:wrap;gap:14px}
    #track{position:absolute;left:86px;right:86px;top:118px;height:90px;z-index:800}
    #track .rail{position:absolute;left:0;right:0;top:20px;height:6px;border-radius:6px;background:rgba(246,241,233,.35)}
    #track .done{position:absolute;left:0;top:20px;height:6px;border-radius:6px;background:${GOLD};transform-origin:left}
    #track .stop{position:absolute;top:10px;width:26px;height:26px;margin-left:-13px;border-radius:50%;background:${INK};border:4px solid rgba(246,241,233,.6)}
    #track .stop span{position:absolute;top:36px;left:50%;transform:translateX(-50%);font-size:20px;font-weight:800;letter-spacing:.2em;color:rgba(246,241,233,.85)}
    #silk{position:absolute;top:-2px;width:50px;height:50px;margin-left:-25px;border-radius:50%;${silkCss};box-shadow:0 6px 18px rgba(0,0,0,.45)}
    #brandA{position:absolute;left:66px;top:62px;z-index:800;font-size:21px;letter-spacing:.3em;font-weight:800;color:rgba(246,241,233,.78)}
  `;

  // The fascinator: feather plumes are drawn with the same strand engine as
  // the hair, tapered to a point, fanning up from a gold disc.
  const plume = (ang, ramp, seed, h = 470) =>
    `<g transform="translate(300 330) rotate(${ang}) translate(-48 0)">${strands({ w: 96, h, seed, n: 80, ramp, sway: 0.1, waves: 0.55, taper: 0.94, width: [1, 2.6], sheen: 0.6, body: 0.2 })}</g>`;
  const fasc = `<svg class="fasc" width="600" height="620" viewBox="0 0 600 620" style="position:absolute;left:420px;top:450px;overflow:visible;opacity:0">
      <defs><radialGradient id="fg" cx=".4" cy=".35" r=".7"><stop offset="0" stop-color="#F3D9A0"/><stop offset=".6" stop-color="${GOLD}"/><stop offset="1" stop-color="#7A5320"/></radialGradient></defs>
      <g class="plumes">
        ${plume(152, [[0, '#B79A6A'], [1, '#FFF8EA']], 1)}
        ${plume(172, [[0, '#7E6DA8'], [1, '#EEE6F6']], 2, 520)}
        ${plume(196, [[0, '#A77B36'], [1, '#FBE7B8']], 3, 500)}
        ${plume(218, [[0, '#B79A6A'], [1, '#FFF8EA']], 4, 420)}
      </g>
      <ellipse cx="300" cy="352" rx="150" ry="120" fill="#000" opacity=".25"/>
      <circle cx="300" cy="340" r="132" fill="url(#fg)"/>
      <circle cx="300" cy="340" r="100" fill="none" stroke="#FBE7B8" stroke-opacity=".55" stroke-width="3"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => `<circle cx="${236 + i * 26}" cy="${398 + Math.sin(i * 0.9) * 8}" r="10" fill="#FFFFFF" opacity=".92"/>`).join('')}
    </svg>`;

  const clock = `<svg width="420" height="420" viewBox="0 0 420 420" style="position:absolute;left:560px;top:300px;overflow:visible">
      <circle cx="210" cy="210" r="196" fill="${CREAM}"/><circle cx="210" cy="210" r="196" fill="none" stroke="${GOLD}" stroke-width="12"/>
      ${Array.from({ length: 12 }, (_, i) => `<rect x="204" y="${i % 3 ? 30 : 24}" width="12" height="${i % 3 ? 22 : 34}" rx="4" fill="${INK}" transform="rotate(${i * 30} 210 210)"/>`).join('')}
      <rect class="hh" x="202" y="96" width="16" height="122" rx="8" fill="${INK}" style="transform-origin:210px 210px"/>
      <rect class="mh" x="205" y="52" width="10" height="166" rx="5" fill="${HOT}" style="transform-origin:210px 210px"/>
      <circle cx="210" cy="210" r="16" fill="${GOLD}"/>
    </svg>`;

  const html = `
  <section class="scene" id="r0" style="background:${turf}"><div class="cam">
    <div style="position:absolute;left:-100px;right:-100px;top:1640px;height:18px;background:${CREAM};opacity:.85"></div>
    <div style="position:absolute;left:-100px;right:-100px;top:1710px;height:18px;background:${CREAM};opacity:.6"></div>
    ${Array.from({ length: 9 }, (_, i) => `<i style="position:absolute;left:${i * 140 - 20}px;top:1640px;width:16px;height:120px;background:${CREAM};opacity:.7"></i>`).join('')}
    <div class="tix pill" style="position:absolute;left:66px;top:300px;padding:20px 34px;background:${CREAM};color:${INK};font-size:30px;opacity:0;transform-origin:left center">Caulfield Cup · Sat 17 Oct</div>
    <div class="safe" style="top:420px">
      <div style="display:flex;align-items:flex-end;gap:30px">
        <div class="num cd" style="font-size:520px;color:${GOLD};opacity:0;text-shadow:0 10px 80px rgba(0,0,0,.4);transform-origin:20% 70%">9</div>
        <div class="lbl dl" style="font-size:40px;color:${CREAM};margin-bottom:90px;opacity:0;line-height:1.3">days<br>to go</div>
      </div>
    </div>
    <div class="safe" style="bottom:470px">
      <h1 class="fr hook" style="font-size:124px;line-height:.95">${W('Race-day hair: [[the countdown]]')}</h1>
    </div>
  </div></section>

  <section class="scene" id="r1"><div class="cam">
    ${hairBg({ ramp: HAIR.balayage, seed: 901, sheen: 0.8 })}
    <div class="scrimB"></div>
    <div class="safe" style="bottom:420px">
      <div class="day">Wednesday</div>
      <h2 class="fr h2" style="margin-top:20px">${W('Colour or [[gloss]]')}</h2>
      <p class="sub">It needs a few days to settle before the photos.</p>
      <div class="chips"><span class="chip pc" style="background:${CREAM};color:${INK}">Gloss ${price(gloss)}</span><span class="chip pc" style="background:${GOLD};color:${INK}">Balayage ${price(bal)}</span></div>
    </div>
  </div></section>

  <section class="scene" id="r2" style="background:${CLAY}"><div class="cam">
    <div class="up">${hairBg({ ramp: HAIR.blonde, seed: 921, n: 230, sheen: 0.7, glint: 0, style: 'clip-path:inset(0 0 640px 0)' })}</div>
    <div class="dn">${hairBg({ ramp: HAIR.blonde, seed: 921, n: 230, sheen: 0.7, glint: 0, style: 'clip-path:inset(1280px 0 0 0)' })}</div>
    <i class="cut" style="position:absolute;left:0;right:0;top:1272px;height:10px;background:repeating-linear-gradient(90deg,${GOLD} 0 40px,transparent 40px 62px);transform-origin:left;transform:scaleX(0)"></i>
    <div class="kept" style="position:absolute;left:66px;right:190px;top:1340px;opacity:0">
      <div class="fr" style="font-size:120px;color:${INK}">Snip.</div>
      <div style="font-size:42px;font-weight:700;color:rgba(18,16,14,.8);margin-top:14px;line-height:1.3">The split ends go. The length stays.</div>
    </div>
    <div class="snip pill" style="position:absolute;left:0;top:1228px;padding:14px 22px;background:${GOLD};color:${INK};font-size:40px;opacity:0">✂</div>
    <div style="position:absolute;left:0;right:0;top:0;height:1000px;background:linear-gradient(180deg,rgba(18,16,14,.75),rgba(18,16,14,.55) 60%,rgba(18,16,14,0))"></div>
    <div class="safe" style="top:300px">
      <div class="day">Friday</div>
      <h2 class="fr h2" style="margin-top:20px">${W('K18, and [[tidy ends]]')}</h2>
      <p class="sub">Smooth ends hold a style. Split ends drop it by lunch.</p>
      <div class="chips"><span class="chip pc" style="background:${INK};color:${CREAM}">K18 ${price(k18)} · ${k18.minutes} min</span></div>
    </div>
  </div></section>

  <section class="scene" id="r3"><div class="cam">
    ${hairBg({ ramp: HAIR.honey, seed: 931, waves: 1.7, sway: 0.11, sheen: 0.95, glint: 9 })}
    <div class="scrimB"></div>
    ${clock}
    <div class="safe" style="bottom:420px">
      <div class="day">Saturday · 9am</div>
      <h2 class="fr h2" style="margin-top:20px">${W('The [[blow wave]]')}</h2>
      <p class="sub">Lasts three to five days. Still there on Sunday.</p>
      <div class="chips"><span class="chip pc" style="background:${CREAM};color:${INK}">Blow wave ${price(wave)} · ${wave.minutes} min</span></div>
    </div>
  </div></section>

  <section class="scene" id="r4" style="background:radial-gradient(ellipse at 60% 35%,#4E4170,#2A2340 70%)"><div class="cam">
    ${fasc}
    <div class="safe" style="top:330px;right:560px">
      <div class="day">At the track</div>
      <h2 class="fr h2" style="margin-top:20px;font-size:108px">${W('Bring the [[fascinator]]')}</h2>
    </div>
    <div class="safe" style="top:1060px;right:120px;display:flex;flex-direction:column;gap:22px">
      <div class="tip pill" style="padding:26px 34px;background:${CREAM};color:${INK};font-size:36px;opacity:0;align-self:flex-start">Tell me when you book. I’ll set the part around it.</div>
      <div class="tip pill" style="padding:26px 34px;background:${GOLD};color:${INK};font-size:36px;opacity:0;align-self:flex-start">Sun fades colour. Hat on in the mounting yard.</div>
    </div>
  </div></section>

  <section class="scene" id="r5" style="background:${turf}"><div class="cam">
    <div class="rays" style="--c:${GOLD};width:2800px;height:2800px;left:-860px;top:-500px;opacity:.12"></div>
    <div class="safe" style="top:360px;right:100px">
      <h1 class="fr off" style="font-size:176px;color:${CREAM};opacity:0;transform-origin:0 70%">And they’re <span style="color:${GOLD}">off.</span></h1>
      <div style="margin-top:60px;display:flex;flex-direction:column;gap:18px">
        <div class="slot pill" style="padding:24px 36px;background:${CREAM};color:${INK};font-size:44px;opacity:0;align-self:flex-start">Saturday · from 9am</div>
        <div class="slot pill" style="padding:24px 36px;background:${INK};color:${CREAM};font-size:44px;opacity:0;align-self:flex-start">Sunday · 11 to 4</div>
      </div>
      <div class="cta pill" style="margin-top:56px;padding:28px 48px;background:${GOLD};color:${INK};font-size:48px;opacity:0">DM me to book <span style="font-size:52px">→</span></div>
    </div>
    <div class="ticker" style="top:1500px;background:${INK}"><div class="tk" style="color:${GOLD}">${'CAULFIELD CUP ✦ SAT 17 OCT ✦ HAIR BY SHA ✦ CAMBERWELL ✦ '.repeat(5)}</div></div>
  </div></section>`;

  const upd = `
  r0(lt,el,dur){
    pop($('.tix',el),lt,.05,.35,.6);
    const c=$('.cd',el); slam(c,lt,.15,.4,2.2); count(c,lt,.15,1.3,9,5); shake($('.cam',el),lt,1.45,.24,18);
    rise($('.dl',el),lt,.6,.35,20);
    words($('.hook',el),lt,.9,.08);
  },
  r1(lt,el,dur){
    const h=$('.hair',el); fall(h,lt,0,.5); sway(h,lt,16,1.8,1.3,1.12,1.03,dur); twinkle(el,lt);
    rise($('.day',el),lt,.15,.3,20); words($('.h2',el),lt,.3); rise($('.sub',el),lt,1.2);
    $$('.pc',el).forEach((c,i)=>pop(c,lt,1.7+i*.14,.35,.7));
  },
  r2(lt,el,dur){
    $$('.hair',el).forEach(h=>sway(h,lt,10,1.2,1.1,1.02,1.06,dur));
    rise($('.day',el),lt,.1,.3,20); words($('.h2',el),lt,.25); rise($('.sub',el),lt,1.1);
    draw($('.cut',el),lt,1.2,.5);
    const sn=$('.snip',el), sp=E.inOutCubic(seg(lt,1.2,.5)); sn.style.opacity=lt>1.2&&lt<1.85?1:0; sn.style.left=(sp*1000)+'px';
    const dp=E.inCubic(seg(lt,1.75,.9)), dn=$('.dn',el); dn.style.transform='translateY('+(dp*260)+'px) rotate('+(dp*2)+'deg)'; dn.style.opacity=1-dp;
    pop($('.pc',el),lt,1.9,.35,.7);
    rise($('.kept',el),lt,2.15,.4,40);
  },
  r3(lt,el,dur){
    sway($('.hair',el),lt,18,2.2,1.6,1.02,1.12,dur); twinkle(el,lt);
    const p=E.inOutCubic(seg(lt,.1,1.2));
    $('.hh',el).style.transform='rotate('+(180+90*p)+'deg)'; $('.mh',el).style.transform='rotate('+(1080*p)+'deg)';
    rise($('.day',el),lt,.15,.3,20); words($('.h2',el),lt,.4); rise($('.sub',el),lt,1.3);
    pop($('.pc',el),lt,1.8,.35,.7);
  },
  r4(lt,el,dur){
    const f=$('.fasc',el); pop(f,lt,.1,.5,.4); if(lt>.1) f.style.transform+=' rotate('+(Math.sin(lt*2)*4)+'deg)';
    $('.plumes',el).style.transform='rotate('+(Math.sin(lt*2.4)*2)+'deg)'; $('.plumes',el).style.transformOrigin='300px 330px';
    rise($('.day',el),lt,.1,.3,20); words($('.h2',el),lt,.3);
    $$('.tip',el).forEach((t,i)=>pop(t,lt,1.0+i*.55,.4,.7));
  },
  r5(lt,el,dur){
    $('.rays',el).style.transform='rotate('+(lt*10)+'deg)';
    slam($('.off',el),lt,.1,.45,2.2); shake($('.cam',el),lt,.42,.24,20);
    $$('.slot',el).forEach((s,i)=>pop(s,lt,.75+i*.18,.35,.7));
    const cta=$('.cta',el); rise(cta,lt,1.4,.35,30);
    if(lt>1.8) cta.style.transform='scale('+(1+.05*Math.sin((lt-1.8)*Math.PI*2*1.4))+')';
    $('.tk',el).style.transform='translateX('+(-(lt*260)%1500)+'px)';
  },`;

  const stops = ['Wed', 'Fri', 'Sat', 'Go'];
  const overlayHtml = `
    <div id="brandA">HAIR BY SHA · RACE WEEK</div>
    <div id="track"><i class="rail"></i><i class="done"></i>
      ${stops.map((s, i) => `<i class="stop" style="left:${(i / 3) * 100}%"><span>${s}</span></i>`).join('')}
      <i id="silk"></i></div>`;
  const marks = [S[1].start, S[2].start, S[3].start, S[5].start];
  const overlayJs = `
    const MK=${JSON.stringify(marks)};
    function OVERLAY(t){
      let p=0;
      for(let i=0;i<MK.length-1;i++){ if(t>=MK[i]) p=(i+E.inOutCubic(seg(t,MK[i],.9)))/3; }
      if(t>=MK[3]) p=1;
      $('#silk').style.left=(p*100)+'%'; $('#track .done').style.width=(p*100)+'%';
      $$('#track .stop').forEach((s,i)=>{ s.style.borderColor = p>=i/3-.001 ? '${GOLD}' : 'rgba(246,241,233,.6)'; s.style.background = p>=i/3-.001 ? '${GOLD}' : '${INK}'; });
      const f=seg(t,MK[3],.18); document.getElementById('flash').style.opacity= t>=MK[3]? (1-f)*.5 : 0;
    }`;

  return { name: 'w9-reel-a-race-day', html: page(html, S, upd, css, overlayHtml, overlayJs), scenes: S };
}

/* ================================================================ REEL B
   "Myth or fact?" — five rounds, a stamp each, score yourself.              */
function reelB() {
  const ROUNDS = [
    { q: 'Trims make your hair grow faster.', a: 'MYTH', why: 'Hair grows from the root. Trims stop split ends eating your length.', bg: '#3A3056', ramp: HAIR.honey },
    { q: 'Pluck one grey and two grow back.', a: 'MYTH', why: 'One follicle, one hair. Plucking can damage it, so leave it to colour.', bg: FIG, ramp: HAIR.icy },
    { q: 'Heat protectant actually works.', a: 'FACT', why: 'It slows the heat getting in. Every time, not just on big days.', bg: '#7A3A1F', ramp: HAIR.copper },
    { q: 'Salon colour lifts box dye straight out.', a: 'MYTH', why: 'Colour does not lift colour. Box dye is the hardest thing I correct.', bg: '#2A1A14', ramp: HAIR.espresso },
    { q: 'The sun fades your colour.', a: 'FACT', why: 'UV breaks colour down. Wear the hat to the races.', bg: '#24384F', ramp: HAIR.balayage },
  ];
  const wave = svc('Blow Wave');
  const S = timeline([
    { id: 'm0', dur: 2.5, in: null },
    ...ROUNDS.map((_, i) => ({ id: `m${i + 1}`, dur: 3.5, in: ['whip', 'slice', 'iris', 'whip', 'slice'][i] })),
    { id: 'm6', dur: 3.6, in: 'punch' },
  ]);
  const stampCss = (a) =>
    a === 'MYTH'
      ? `color:#F4C9B4;border-color:#E07A4F;background:rgba(164,83,47,.92)`
      : `color:#DDEBD9;border-color:#8FC29A;background:rgba(47,64,50,.94)`;

  const css = `
    .card{position:absolute;left:66px;right:150px;top:330px;background:${CREAM};color:${INK};border-radius:40px;padding:56px 58px 64px;opacity:0;box-shadow:0 30px 80px rgba(0,0,0,.35)}
    .card .q{font-size:90px;line-height:1.02;letter-spacing:-.03em}
    .rnd{position:absolute;left:66px;top:200px;font-size:28px;letter-spacing:.32em;font-weight:800;color:${GOLD};opacity:0}
    .stamp{position:absolute;right:120px;top:640px;font-family:'Inter';font-weight:900;font-size:150px;letter-spacing:.06em;padding:6px 40px 12px;border:12px solid;border-radius:22px;opacity:0;z-index:5}
    .why{position:absolute;left:66px;right:190px;top:960px;font-size:48px;line-height:1.3;font-weight:700;color:${CREAM};opacity:0}
    .band{position:absolute;left:0;top:1260px;width:1080px;height:700px;overflow:hidden}
    #prog{position:absolute;left:66px;right:66px;top:104px;display:flex;gap:12px;z-index:800}
    #prog i{flex:1;height:9px;border-radius:9px;background:rgba(246,241,233,.28);overflow:hidden;position:relative}
    #prog i b{position:absolute;inset:0;background:${CREAM};transform-origin:left;transform:scaleX(0)}
    #brandB{position:absolute;left:66px;top:134px;z-index:800;font-size:22px;letter-spacing:.3em;font-weight:800;color:rgba(246,241,233,.78)}
  `;

  const round = (r, i) => `
  <section class="scene" id="m${i + 1}" style="background:${r.bg}"><div class="cam">
    <div class="band"><svg width="1080" height="700" viewBox="0 0 1080 700" class="bs"><g transform="translate(-110 -20)">${strands({ w: 1300, h: 760, seed: 700 + i * 11, n: 260, ramp: r.ramp, sway: 0.09, waves: 1.3, taper: 0.05, width: [1.5, 4], sheen: 0.8 })}</g></svg>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,${r.bg} 0%,rgba(0,0,0,0) 45%)"></div></div>
    <div class="rnd">Round ${i + 1} of ${ROUNDS.length}</div>
    <div class="card"><p class="fr q">${W(r.q)}</p></div>
    <div class="stamp" style="${stampCss(r.a)}">${r.a}</div>
    <p class="why">${esc(r.why)}</p>
  </div></section>`;

  const html = `
  <section class="scene" id="m0" style="background:radial-gradient(ellipse at 50% 40%,#4E4170,#1A1524 75%)"><div class="cam">
    <div class="rays" style="--c:${GOLD};width:2800px;height:2800px;left:-860px;top:-460px;opacity:.1"></div>
    <div class="safe" style="top:430px">
      <h1 class="fr hook" style="font-size:190px;line-height:.9">${W('Myth or [[fact?]]')}</h1>
    </div>
    <div class="st0 stamp" style="${stampCss('MYTH')};right:auto;left:80px;top:930px;transform:rotate(-8deg)">MYTH</div>
    <div class="st1 stamp" style="${stampCss('FACT')};right:150px;top:1120px">FACT</div>
    <div class="safe" style="top:1420px">
      <div class="keep pill" style="padding:20px 32px;border:3px solid ${GOLD};font-size:34px;color:${CREAM};opacity:0">Five rounds. Keep score.</div>
    </div>
  </div></section>
  ${ROUNDS.map(round).join('')}
  <section class="scene" id="m6" style="background:${INK}"><div class="cam">
    <div class="rays" style="--c:${GOLD};width:2800px;height:2800px;left:-860px;top:-700px;opacity:.12"></div>
    <div class="safe" style="top:300px;right:100px">
      <div class="lbl" style="color:${GOLD};font-size:28px">Your score</div>
      <div style="display:flex;align-items:baseline;gap:10px;margin-top:10px">
        <div class="num sc" style="font-size:420px;color:${CREAM}">0</div><div class="num" style="font-size:200px;color:${GOLD}">/5</div>
      </div>
      <h2 class="fr cm" style="font-size:110px;margin-top:20px">${W('Comment your [[score.]]')}</h2>
      <p class="sub2" style="margin-top:30px;font-size:42px;font-weight:600;line-height:1.34;color:rgba(246,241,233,.9);opacity:0;max-width:21ch">Race day? Blow waves ${price(wave)}, Saturday from 9am.</p>
      <div class="cta pill" style="margin-top:44px;padding:28px 48px;background:${GOLD};color:${INK};font-size:46px;opacity:0">DM me to book <span style="font-size:50px">→</span></div>
    </div>
    <div class="ticker" style="top:1560px;background:${FIG}"><div class="tk" style="color:${CLAY}">${'MYTH OR FACT ✦ HAIR BY SHA ✦ CAMBERWELL ✦ SAT 9–5 ✦ SUN 11–4 ✦ '.repeat(4)}</div></div>
  </div></section>`;

  const roundUpd = ROUNDS.map(
    (r, i) => `
  m${i + 1}(lt,el,dur){
    const bs=$('.bs',el); bs.style.transform='translateX('+(Math.sin(lt*1.3)*16)+'px) skewX('+(Math.sin(lt*1.1)*1.8)+'deg)';
    rise($('.rnd',el),lt,.05,.3,16);
    const c=$('.card',el); rise(c,lt,.12,.4,60);
    words($('.q',el),lt,.3,.06,.3,40);
    const st=$('.stamp',el); slam(st,lt,1.45,.32,2.6); if(lt>1.45) st.style.transform+=' rotate(${r.a === 'MYTH' ? -9 : 7}deg)';
    shake($('.cam',el),lt,1.7,.24,22);
    rise($('.why',el),lt,2.0,.4,30);
  },`,
  ).join('');

  const upd = `
  m0(lt,el,dur){
    $('.rays',el).style.transform='rotate('+(lt*12)+'deg)';
    words($('.hook',el),lt,.05,.1,.36,70);
    const a=$('.st0',el); slam(a,lt,.8,.3,2.4); if(lt>.8) a.style.transform+=' rotate(-8deg)';
    const b=$('.st1',el); slam(b,lt,1.2,.3,2.4); if(lt>1.2) b.style.transform+=' rotate(6deg)';
    shake($('.cam',el),lt,1.0,.22,16);
    rise($('.keep',el),lt,1.6,.35,20);
  },
  ${roundUpd}
  m6(lt,el,dur){
    $('.rays',el).style.transform='rotate('+(lt*10)+'deg)';
    const sc=$('.sc',el); const k=Math.floor(clamp(lt/1.1)*12); sc.textContent= lt<1.1 ? String(k%6) : '?';
    words($('.cm',el),lt,1.0,.08);
    rise($('.sub2',el),lt,1.6);
    const cta=$('.cta',el); rise(cta,lt,2.0,.35,30);
    if(lt>2.4) cta.style.transform='scale('+(1+.05*Math.sin((lt-2.4)*Math.PI*2*1.4))+')';
    $('.tk',el).style.transform='translateX('+(-(lt*240)%1400)+'px)';
  },`;

  const rounds = S.slice(1, 1 + ROUNDS.length);
  const overlayHtml = `<div id="prog">${rounds.map(() => '<i><b></b></i>').join('')}</div><div id="brandB">HAIR BY SHA · MYTH OR FACT</div>`;
  const overlayJs = `
    const RD=${JSON.stringify(rounds.map((r) => [r.start, r.dur]))};
    function OVERLAY(t){
      $$('#prog b').forEach((b,i)=>{ b.style.transform='scaleX('+seg(t,RD[i][0],RD[i][1])+')'; });
      // a white pop on each stamp
      let fl=0; RD.forEach(([s])=>{ const p=seg(t,s+1.55,.16); if(t>=s+1.55&&p<1) fl=Math.max(fl,(1-p)*.35); });
      document.getElementById('flash').style.opacity=fl;
    }`;

  return { name: 'w9-reel-b-myth-or-fact', html: page(html, S, upd, css, overlayHtml, overlayJs), scenes: S };
}

/* ================================================================ render */
mkdirSync(OUT, { recursive: true });
const reels = [reelA(), reelB()].filter((r) => !ONLY || r.name.includes(`reel-${ONLY}`));
const browser = await chromium.launch({ executablePath: chromiumPath() });
const PREV = join(ROOT, 'data', 'reel-preview');
if (PREVIEW) mkdirSync(PREV, { recursive: true });

for (const r of reels) {
  const htmlPath = join(PHOTOS, `.${r.name}.html`);
  writeFileSync(htmlPath, r.html);
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`file://${htmlPath}`, { waitUntil: 'load' });
  await page.evaluate(() => window.ready);
  if (errors.length) throw new Error(`${r.name}: ${errors.join(' | ')}`);

  const total = r.scenes.at(-1).start + r.scenes.at(-1).dur;

  if (PREVIEW) {
    // One frame per scene at the point it is fully built, plus one mid-transition.
    const times = r.scenes.flatMap((s, i) => [s.start + s.dur - 0.06, ...(i ? [s.start + TD * 0.5] : [])]);
    for (const [k, t] of times.entries()) {
      await page.evaluate(([t, f]) => window.render(t, f), [t, k]);
      await page.screenshot({ path: join(PREV, `${r.name}-${String(k).padStart(2, '0')}-${t.toFixed(2)}.jpg`), type: 'jpeg', quality: 80 });
    }
    console.log(`preview ${r.name}: ${times.length} stills → ${PREV}`);
    await page.close();
    continue;
  }

  const frames = join(OUT, `.frames-${r.name}`);
  rmSync(frames, { recursive: true, force: true });
  mkdirSync(frames, { recursive: true });
  const N = Math.round(total * FPS);
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const t = f / FPS;
    await page.evaluate(([t, f]) => window.render(t, f), [t, f]);
    await page.screenshot({ path: join(frames, `f${String(f).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 93 });
    if (f % 60 === 0) console.log(`  ${r.name} ${f}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  await page.close();
  if (errors.length) throw new Error(`${r.name}: ${errors.join(' | ')}`);

  const mp4 = join(OUT, `${r.name}.mp4`);
  execFileSync(ffmpegPath, ['-y', '-framerate', String(FPS), '-i', join(frames, 'f%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  // Cover: the frame where the hook is fully landed.
  const coverT = r.scenes[0].dur - 0.1;
  execFileSync(ffmpegPath, ['-y', '-ss', String(coverT), '-i', mp4, '-frames:v', '1', join(OUT, `${r.name}-cover.jpg`)],
    { stdio: ['ignore', 'ignore', 'pipe'] });
  rmSync(frames, { recursive: true, force: true });
  console.log(`done ${r.name}: ${N} frames, ${total.toFixed(1)}s → ${mp4}`);
}
await browser.close();
