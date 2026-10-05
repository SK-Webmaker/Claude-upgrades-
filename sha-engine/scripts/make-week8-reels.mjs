#!/usr/bin/env node
/**
 * Week 8 reels — a frame-by-frame kinetic engine.
 *
 *   node scripts/make-week8-reels.mjs            # render both reels to MP4
 *   node scripts/make-week8-reels.mjs a          # just reel A
 *   node scripts/make-week8-reels.mjs --preview  # one still per scene, for review
 *
 * ---------------------------------------------------------------------------
 * Why a new engine
 *
 * The week-6 reel was stills pushed slowly and cross-dissolved. That is a
 * slideshow, and a slideshow is exactly what a thumb scrolls past. What stops a
 * scroll is motion with intent: words that land one at a time, a number that
 * counts up, a hard whip into the next idea, a progress bar that tells you there
 * are five and you have seen two.
 *
 * So this renders every frame. The page exposes render(t); Playwright calls it
 * 30 times a second of output and screenshots each frame; ffmpeg stitches the
 * frames. Anything CSS can draw can now move — which is everything here.
 *
 * ---------------------------------------------------------------------------
 * What the account said (live read 29 Sep 2026)
 *
 * Seven of her ten best reels have Sha herself on camera. Her best-ever post is
 * "Dimension, restored" at 41 likes, and her best by rate is an educational
 * "Did you know a professional blow wave can last three to five days" at 9.68%
 * with three comments. So:
 *
 *   Reel A — "5 things your colourist wishes you knew". The did-you-know format
 *            that is her best performer, with a progress bar that makes leaving
 *            at fact two feel unfinished.
 *   Reel B — "Come for Sha". The account's strongest content is her, so the
 *            reel sells the person: the years, the clients who followed her
 *            across three suburbs, the one chair, then the menu.
 *
 * ---------------------------------------------------------------------------
 * What is deliberately NOT here
 *
 * No photographs, and no AI-generated or AI-animated hair (invariant 2). The
 * face-free photo library had been used until it went stale, so every image
 * scene is drawn hair from lib/hair-art.mjs — strands that fall in, sway, and
 * catch a sheen; a shade book that fans open; a toner drop that cools a brassy
 * lock. It is illustration, and it reads as illustration, so nothing here
 * passes itself off as her work.
 *
 * No audio. It is left for her to add a trending track in the app on the day.
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

const SHADES = [
  { ramp: HAIR.espresso, label: '4N', sub: 'ESPRESSO' },
  { ramp: HAIR.caramel, label: '6G', sub: 'CARAMEL' },
  { ramp: HAIR.copper, label: '7C', sub: 'COPPER' },
  { ramp: HAIR.balayage, label: 'BAL', sub: 'LIVED-IN' },
  { ramp: HAIR.honey, label: '8G', sub: 'HONEY' },
  { ramp: HAIR.blonde, label: '9V', sub: 'BEIGE' },
  { ramp: HAIR.icy, label: '10P', sub: 'PEARL' },
];

/* ================================================================ REEL A
   "5 things your colourist wishes you knew" — the did-you-know format.     */
function reelA() {
  const gloss = svc('Toner & Gloss'), wave = svc('Blow Wave'), bal = svc('Balayage / Lived-in Blonde');
  const S = timeline([
    { id: 'a0', dur: 2.4, in: null },
    { id: 'a1', dur: 3.1, in: 'whip' },
    { id: 'a2', dur: 3.1, in: 'iris' },
    { id: 'a3', dur: 3.2, in: 'slice' },
    { id: 'a4', dur: 3.1, in: 'whip' },
    { id: 'a5', dur: 3.1, in: 'iris' },
    { id: 'a6', dur: 3.6, in: 'punch' },
  ]);
  const facts = S.slice(1, 6);

  const css = `
    .idx{position:absolute;left:62px;top:228px;font-size:230px;color:transparent;-webkit-text-stroke:4px ${GOLD};opacity:0}
    .h2{font-size:104px;color:${CREAM};text-shadow:0 4px 50px rgba(0,0,0,.45)}
    .sub{font-size:40px;line-height:1.36;font-weight:600;color:rgba(246,241,233,.9);opacity:0;margin-top:30px;max-width:19ch}
    .caret{display:inline-block;width:6px;height:.9em;background:${GOLD};vertical-align:-.1em;margin-left:4px}
    #prog{position:absolute;left:66px;right:66px;top:104px;display:flex;gap:12px;z-index:800}
    #prog i{flex:1;height:9px;border-radius:9px;background:rgba(246,241,233,.28);overflow:hidden;position:relative}
    #prog i b{position:absolute;inset:0;background:${CREAM};transform-origin:left;transform:scaleX(0)}
    #brand{position:absolute;left:66px;top:134px;z-index:800;font-size:22px;letter-spacing:.3em;font-weight:800;color:rgba(246,241,233,.78)}
  `;

  const html = `
  <section class="scene" id="a0"><div class="cam">
    ${hairBg({ ramp: HAIR.gold, seed: 101, cls: 'h0' })}
    <div class="scrimB"></div>
    <div class="safe" style="top:300px">
      <div class="num big5" style="font-size:640px;color:${CREAM};opacity:0;transform-origin:18% 60%;text-shadow:0 10px 80px rgba(0,0,0,.5)">5</div>
    </div>
    <div class="safe" style="bottom:400px">
      <h1 class="fr hook" style="font-size:118px;line-height:.95">${W('things your colourist [[wishes you knew]]')}</h1>
      <div class="tease pill" style="margin-top:44px;padding:18px 30px;border:3px solid ${GOLD};font-size:30px;color:${CREAM};opacity:0">Number three surprises everyone</div>
    </div>
  </div></section>

  <section class="scene" id="a1"><div class="cam">
    ${hairBg({ ramp: HAIR.rose, seed: 111, waves: 1.7, sway: 0.11, sheen: 0.95, glint: 9 })}
    <div class="scrimB"></div>
    <div class="idx fr">01</div>
    <div class="safe" style="bottom:400px">
      <h2 class="fr h2">${W('A blow wave can last [[3–5 days]]')}</h2>
      <p class="sub">Silk pillowcase. Dry shampoo on day two.</p>
      <div class="chip tip" style="margin-top:34px;background:${CREAM};color:${INK}">Save this for event day</div>
    </div>
  </div></section>

  <section class="scene" id="a2" style="background:${FIG}"><div class="cam">
    <div class="rays" style="--c:${CLAY};width:2600px;height:2600px;left:-760px;top:-300px;opacity:.16"></div>
    <div class="disc" style="width:900px;height:900px;left:520px;top:-260px;background:${CLAY};opacity:.18"></div>
    <div class="idx fr" style="-webkit-text-stroke-color:${CLAY}">02</div>
    <svg style="position:absolute;left:150px;top:470px" width="780" height="780" viewBox="0 0 780 780">
      <circle cx="390" cy="390" r="352" fill="none" stroke="rgba(246,241,233,.16)" stroke-width="22"/>
      <circle class="ring" cx="390" cy="390" r="352" fill="none" stroke="${GOLD}" stroke-width="22" stroke-linecap="round"
        stroke-dasharray="2212" stroke-dashoffset="2212" transform="rotate(-90 390 390)"/>
    </svg>
    <div class="num n48" style="position:absolute;left:0;right:0;top:640px;text-align:center;font-size:400px;color:${CREAM}">0</div>
    <div class="lbl hrs" style="position:absolute;left:0;right:0;top:1000px;text-align:center;color:${GOLD};opacity:0">Hours</div>
    <div class="safe" style="top:1300px">
      <h2 class="fr h2" style="font-size:92px">${W('Your colour is still [[settling]]')}</h2>
      <p class="sub">Don’t wash it the day you get home.</p>
    </div>
  </div></section>

  <section class="scene" id="a3"><div class="cam">
    ${hairBg({ ramp: HAIR.brassy, seed: 131, sheen: 0.3, glint: 0, cls: 'warm' })}
    ${hairBg({ ramp: HAIR.icy, seed: 131, sheen: 0.9, glint: 8, cls: 'cool', style: 'opacity:0' })}
    <svg class="dropA" width="220" height="300" viewBox="0 0 220 300" style="position:absolute;left:430px;top:-320px;overflow:visible;z-index:3">${drop({ w: 220, c1: '#E4D9F2', c2: '#5B4A86' })}</svg>
    <div class="ripple" style="position:absolute;left:540px;top:900px;width:10px;height:10px;border-radius:50%;border:6px solid #C3B3DE;opacity:0;transform:translate(-50%,-50%)"></div>
    <div class="scrimB"></div>
    <div class="idx fr">03</div>
    <div class="safe" style="bottom:400px">
      <div style="position:relative;display:inline-block">
        <h2 class="fr h2 l1">${W('Purple shampoo')}</h2>
        <i class="strike" style="position:absolute;left:-10px;right:-10px;top:52%;height:14px;background:${GOLD};transform-origin:left;transform:scaleX(0)"></i>
      </div>
      <h2 class="fr h2 l2" style="font-size:150px;margin-top:10px">${W('is a [[toner.]]')}</h2>
      <p class="sub">Once a week. Two minutes. That’s it.</p>
    </div>
    <div class="told pill" style="position:absolute;right:200px;top:880px;padding:16px 28px;background:${GOLD};color:${INK};font-size:30px;opacity:0;transform-origin:center">Told you</div>
  </div></section>

  <section class="scene" id="a4" style="background:${CLAY}"><div class="cam">
    <div class="disc" style="width:1100px;height:1100px;left:-420px;top:-180px;background:${FIG};opacity:.14"></div>
    <div class="disc" style="width:620px;height:620px;left:560px;top:1220px;background:${GOLD};opacity:.28"></div>
    <div class="idx fr" style="-webkit-text-stroke-color:${FIG}">04</div>
    <div style="position:absolute;left:700px;top:380px;width:170px;height:1150px">
      <div style="position:absolute;left:35px;top:0;width:100px;height:1000px;border-radius:60px;background:rgba(18,16,14,.14);overflow:hidden">
        <div class="merc" style="position:absolute;left:0;right:0;bottom:0;height:100%;background:${HOT}"></div>
      </div>
      <div class="bulb" style="position:absolute;left:0;top:950px;width:170px;height:170px;border-radius:50%;background:${HOT}"></div>
    </div>
    <div style="position:absolute;left:66px;top:1120px;display:flex;flex-direction:column;gap:26px">
      <div class="tagHot pill" style="position:relative;padding:22px 40px;background:${HOT};color:${CREAM};font-size:48px;opacity:0;align-self:flex-start">
        Hot &nbsp;✕<i class="hotx" style="position:absolute;left:20px;right:20px;top:50%;height:7px;background:${CREAM};transform-origin:left;transform:scaleX(0)"></i></div>
      <div class="tagWarm pill" style="padding:22px 40px;background:${FIG};color:${CREAM};font-size:48px;opacity:0;align-self:flex-start">Lukewarm &nbsp;✓</div>
    </div>
    <div class="safe" style="top:430px;right:420px">
      <h2 class="fr h2" style="color:${INK};text-shadow:none;font-size:112px">${W('Hot water [[fades]] your colour')}</h2>
      <p class="sub" style="color:rgba(18,16,14,.8)">Rinse lukewarm. The cheapest fix there is.</p>
    </div>
  </div></section>

  <section class="scene" id="a5"><div class="cam">
    ${hairBg({ ramp: HAIR.balayage, seed: 151, waves: 1.0, sway: 0.07, sheen: 0.7, glint: 6 })}
    <div class="scrimB"></div>
    <div class="idx fr">05</div>
    <div class="safe" style="bottom:400px">
      <h2 class="fr h2">${W('Balayage grows out with [[no line]]')}</h2>
      <div style="margin-top:44px;display:flex;align-items:center;gap:22px">
        <div class="num wk" style="font-size:96px;color:${GOLD}">0</div>
        <div class="lbl" style="color:${CREAM};font-size:24px">weeks<br>between visits</div>
      </div>
      <div style="position:relative;margin-top:26px;height:14px;border-radius:14px;background:rgba(246,241,233,.2);overflow:hidden">
        <i class="bar" style="position:absolute;inset:0;background:${GOLD};transform-origin:left;transform:scaleX(0)"></i>
      </div>
    </div>
  </div></section>

  <section class="scene" id="a6" style="background:${INK}"><div class="cam">
    <div style="position:absolute;left:0;right:0;top:0;height:940px;overflow:hidden">
      <div class="disc" style="width:1400px;height:1400px;left:-160px;top:-900px;background:radial-gradient(circle,rgba(192,139,62,.4),rgba(192,139,62,0) 62%)"></div>
      <svg class="fan" width="1080" height="940" viewBox="0 0 1080 940" style="position:absolute;left:0;top:0;overflow:visible">${swatchFan({ items: SHADES, w: 150, h: 640, cx: 540, cy: 370, spread: 76, pivot: 700, clip: '#1E1A17' })}${glints({ w: 1080, h: 600, seed: 61, n: 8 })}</svg>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(18,16,14,.25),rgba(18,16,14,0) 25%,rgba(18,16,14,0) 55%,rgba(18,16,14,.95))"></div>
      <div class="tag" style="position:absolute;left:66px;top:720px;opacity:0">
        <div class="fr" style="font-size:120px">Sha</div>
        <div class="lbl" style="color:${GOLD};margin-top:12px">20+ years · Camberwell</div>
      </div>
    </div>
    <div class="panel" style="position:absolute;left:0;right:0;top:940px;bottom:0;background:${INK}">
      <i class="gl" style="position:absolute;left:0;right:0;top:0;height:8px;background:${GOLD};transform-origin:left;transform:scaleX(0)"></i>
      <div class="safe" style="top:66px;right:66px">
        <h2 class="fr save" style="font-size:150px">${W('Save this.')}</h2>
        <p class="sub then" style="max-width:24ch;margin-top:18px;font-size:44px">Then book the colourist who told you.</p>
        <div style="margin-top:34px;display:flex;flex-wrap:wrap;gap:14px">
          <span class="chip pc" style="background:${FIG};color:${CREAM}">Gloss ${price(gloss)}</span>
          <span class="chip pc" style="background:${FIG};color:${CREAM}">Blow wave ${price(wave)}</span>
          <span class="chip pc" style="background:${FIG};color:${CREAM}">Balayage ${price(bal)}</span>
        </div>
      </div>
      <div class="cta pill" style="position:absolute;left:66px;top:500px;padding:28px 48px;background:${GOLD};color:${INK};font-size:46px;opacity:0">DM me to book <span style="font-size:50px">→</span></div>
      <div class="ticker" style="top:680px;background:${FIG}"><div class="tk" style="color:${CLAY}">${'HAIR BY SHA ✦ CAMBERWELL ✦ SUNDAYS 11–4 ✦ 20+ YEARS ✦ K18 CERTIFIED ✦ '.repeat(4)}</div></div>
    </div>
  </div></section>`;

  const upd = `
  a0(lt,el,dur){
    const h=$('.hair',el); fall(h,lt,0,.55); sway(h,lt,16,1.8,1.3,1.14,1.04,dur); twinkle(el,lt);
    slam($('.big5',el),lt,.05,.45,2.6); shake($('.cam',el),lt,.34,.26,20);
    words($('.hook',el),lt,.5,.075);
    rise($('.tease',el),lt,1.45,.4);
  },
  a1(lt,el,dur){
    sway($('.hair',el),lt,18,2.2,1.6,1.02,1.14,dur); twinkle(el,lt);
    pop($('.idx',el),lt,.12,.4,.7);
    words($('.h2',el),lt,.3); rise($('.sub',el),lt,1.35); pop($('.tip',el),lt,1.95,.35,.7);
  },
  a2(lt,el,dur){
    $('.rays',el).style.transform='rotate('+(lt*9)+'deg)';
    pop($('.idx',el),lt,.1,.4,.7);
    count($('.n48',el),lt,.15,1.05,0,48);
    const p=E.outExpo(seg(lt,.15,1.05)); $('.ring',el).setAttribute('stroke-dashoffset',String(2212*(1-p)));
    const b=seg(lt,1.2,.3); $('.n48',el).style.transform='scale('+(1+.07*Math.sin(b*Math.PI))+')';
    rise($('.hrs',el),lt,.9,.35,20);
    words($('.h2',el),lt,1.1); rise($('.sub',el),lt,1.9);
  },
  a3(lt,el,dur){
    // The drop falls, lands, and the brassy lock cools to pearl behind the words.
    sway($('.warm',el),lt,12,1.4,1.1,1.06,1.12,dur); sway($('.cool',el),lt,12,1.4,1.1,1.06,1.12,dur);
    const dp=E.inCubic(seg(lt,.15,.55)); const d=$('.dropA',el);
    d.style.transform='translateY('+(dp*960)+'px) scale('+lerp(.8,1,dp)+','+lerp(.8,1.12,dp)+')'; d.style.opacity= lt<.72? 1 : 1-seg(lt,.72,.12);
    const rp=seg(lt,.7,.7), r=$('.ripple',el); r.style.opacity=rp>0? (1-rp)*.9 : 0; r.style.width=r.style.height=(10+rp*900)+'px';
    $('.cool',el).style.opacity=E.inOutCubic(seg(lt,.72,.9)); twinkle(el,lt);
    pop($('.idx',el),lt,.1,.4,.7);
    words($('.l1',el),lt,.25);
    draw($('.strike',el),lt,.95,.32);
    words($('.l2',el),lt,1.3,.09,.4,80);
    rise($('.sub',el),lt,2.0);
    const t=$('.told',el); pop(t,lt,2.35,.35,.4); if(lt>2.35) t.style.transform+=' rotate(-8deg)';
  },
  a4(lt,el,dur){
    pop($('.idx',el),lt,.1,.4,.7);
    words($('.h2',el),lt,.25);
    const p=E.inOutCubic(seg(lt,.8,1.2));
    $('.merc',el).style.height=(lerp(100,44,p))+'%';
    const c = p<.5? '${HOT}' : '${FIG}';
    $('.merc',el).style.background=c; $('.bulb',el).style.background=c;
    pop($('.tagHot',el),lt,.7,.35,.6); draw($('.hotx',el),lt,1.2,.3);
    pop($('.tagWarm',el),lt,1.75,.38,.6);
    rise($('.sub',el),lt,1.6);
  },
  a5(lt,el,dur){
    sway($('.hair',el),lt,14,1.6,1.2,1.12,1.02,dur); twinkle(el,lt);
    pop($('.idx',el),lt,.1,.4,.7);
    words($('.h2',el),lt,.25);
    count($('.wk',el),lt,1.0,1.1,0,14,(n)=> n<10? String(n) : '10–'+n);
    draw($('.bar',el),lt,1.0,1.1);
  },
  a6(lt,el,dur){
    // The shade book fans open from closed.
    const fp=E.outBack(seg(lt,.05,.8)); $$('.sw',el).forEach(g=>{ g.style.transform='rotate('+(+g.dataset.a*fp)+'deg)'; });
    $('.fan',el).style.transform='translateY('+(Math.sin(lt*1.4)*8)+'px)'; twinkle(el,lt);
    draw($('.gl',el),lt,.1,.45);
    const tg=$('.tag',el); const p=E.outExpo(seg(lt,.3,.5)); tg.style.opacity=seg(lt,.3,.3); tg.style.transform='translateX('+((1-p)*-120)+'px)';
    words($('.save',el),lt,.4,.1,.4,70);
    rise($('.then',el),lt,.8);
    $$('.pc',el).forEach((c,i)=>pop(c,lt,1.15+i*.12,.35,.7));
    const cta=$('.cta',el); rise(cta,lt,1.6,.35,30);
    if(lt>2.0) cta.style.transform='scale('+(1+.045*Math.sin((lt-2)*Math.PI*2*1.4))+')';
    $('.tk',el).style.transform='translateX('+(-(lt*240)%1400)+'px)';
  },`;

  const overlayHtml = `
    <div id="prog">${facts.map(() => '<i><b></b></i>').join('')}</div>
    <div id="brand">HAIR BY SHA · CAMBERWELL</div>`;
  const overlayJs = `
    const FACTS=${JSON.stringify(facts.map((f) => [f.start, f.dur]))};
    function OVERLAY(t){
      const bars=$$('#prog b');
      FACTS.forEach(([s,d],i)=>{ bars[i].style.transform='scaleX('+seg(t,s,d)+')'; });
      const cta=${S[6].start};
      const f=seg(t,cta,.18); document.getElementById('flash').style.opacity= t>=cta? (1-f)*.55 : 0;
    }`;

  return { name: 'w8-reel-a-did-you-know', html: page(html, S, upd, css, overlayHtml, overlayJs), scenes: S };
}

/* ================================================================ REEL B
   "Come for Sha" — sell the person, because the person is what performs.   */
function reelB() {
  const stella = review('Stella McCammon');
  const menu = [
    ['Toner & Gloss', svc('Toner & Gloss')],
    ['Blow wave', svc('Blow Wave')],
    ['Root colour + refresh', svc('Root Colour + Refresh')],
    ['Partial foils', svc('Partial Blonde (Foils)')],
    ['Balayage', svc('Balayage / Lived-in Blonde')],
  ];
  // Nine shades, one colourist — the grid used to be nine photographs of her
  // work, most of which had already run twice.
  const grid = [
    ['Espresso', HAIR.espresso], ['Copper', HAIR.copper], ['Honey', HAIR.honey],
    ['Rose', HAIR.rose], ['Lived-in', HAIR.balayage], ['Caramel', HAIR.caramel],
    ['Pearl', HAIR.icy], ['Beige blonde', HAIR.blonde], ['Toned', HAIR.toner],
  ];
  const S = timeline([
    { id: 'b0', dur: 2.5, in: null },
    { id: 'b1', dur: 2.7, in: 'whip' },
    { id: 'b2', dur: 4.3, in: 'slice' },
    { id: 'b3', dur: 3.4, in: 'iris' },
    { id: 'b4', dur: 2.3, in: 'drop' },
    { id: 'b5', dur: 2.6, in: 'punch' },
    { id: 'b6', dur: 3.2, in: 'iris' },
  ]);

  const beats = [
    { bg: FIG, fg: CREAM, acc: GOLD, n: 20, suf: '+', lbl: 'years behind the chair' },
    { bg: CLAY, fg: INK, acc: FIG, n: 1000, suf: '+', lbl: 'happy clients' },
    { bg: INK, fg: CREAM, acc: GOLD, text: 'K18', lbl: 'certified bond repair' },
    { bg: GOLD, fg: INK, acc: INK, n: 1, suf: '', lbl: 'chair. One colourist. Start to finish.' },
  ];

  const css = `
    .caret{display:inline-block;width:6px;height:.9em;background:${GOLD};vertical-align:-.1em;margin-left:4px}
    .beat{position:absolute;inset:0;clip-path:circle(0% at 50% 50%)}
    .row{display:flex;justify-content:space-between;align-items:baseline;padding:30px 0;border-bottom:3px solid rgba(246,241,233,.16);
         transform-origin:50% 0;opacity:0}
    .row .n{font-size:40px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    .row .p{font-size:78px;color:${GOLD}}
    .tile{position:absolute;overflow:hidden}
    .tile svg{will-change:transform}
  `;

  const ringText = 'COME FOR SHA ✦ CAMBERWELL ✦ 20+ YEARS ✦ ';

  const html = `
  <section class="scene" id="b0" style="background:${INK}"><div class="cam">
    <div class="disc d1" style="width:980px;height:980px;left:-360px;top:120px;background:${FIG};opacity:.55"></div>
    <div class="disc d2" style="width:760px;height:760px;left:520px;top:1080px;background:${CLAY};opacity:.22"></div>
    <div class="safe" style="top:700px;right:40px">
      <div style="position:relative;display:inline-block">
        <h1 class="fr l1" style="font-size:94px;color:${CREAM};white-space:nowrap">${W("Don’t book a haircut.")}</h1>
        <i class="strike" style="position:absolute;left:-8px;right:-8px;top:56%;height:13px;background:${GOLD};transform-origin:left;transform:scaleX(0)"></i>
      </div>
      <h1 class="fr big" style="font-size:300px;color:${GOLD};margin-top:40px;opacity:0;transform-origin:0 60%">Book Sha.</h1>
      <div class="lbl sm" style="margin-top:40px;color:rgba(246,241,233,.72);opacity:0">Hair by Sha · Camberwell</div>
    </div>
  </div></section>

  <section class="scene" id="b1"><div class="cam">
    ${hairBg({ ramp: HAIR.copper, seed: 201, waves: 1.3, sway: 0.1, sheen: 0.8, glint: 8 })}
    <div class="scrimB"></div>
    <div class="chip top" style="position:absolute;left:66px;top:170px;background:${CREAM};color:${INK}">The one doing your colour</div>
    <div class="safe name" style="bottom:400px;opacity:0">
      <i class="nr" style="display:block;width:160px;height:8px;background:${GOLD};margin-bottom:30px;transform-origin:left;transform:scaleX(0)"></i>
      <div class="fr" style="font-size:176px">Shamalka</div>
      <div class="lbl" style="margin-top:22px;color:${GOLD};font-size:28px">Sha · colour specialist</div>
      <p style="margin-top:26px;font-size:40px;font-weight:600;color:rgba(246,241,233,.9);max-width:20ch" class="nsub">Every appointment, start to finish. No hand-offs.</p>
    </div>
  </div></section>

  <section class="scene" id="b2" style="background:${INK}"><div class="cam">
    ${beats
      .map(
        (b, i) => `
      <div class="beat bt${i}" style="background:${b.bg}">
        <div class="rays" style="--c:${b.acc};width:2800px;height:2800px;left:-860px;top:-440px;opacity:.1"></div>
        <svg style="position:absolute;left:90px;top:330px" width="900" height="900" viewBox="0 0 900 900">
          <defs><path id="r${i}" d="M450,70 a380,380 0 1,1 -0.1,0"/></defs>
          <g class="spin" style="transform-origin:450px 450px">
            <text font-family="Inter" font-size="34" font-weight="800" letter-spacing="7" fill="${b.acc}" opacity=".85">
              <textPath href="#r${i}">${ringText.repeat(2)}</textPath></text>
          </g>
        </svg>
        <div class="num bn" style="position:absolute;left:0;right:0;top:${b.text ? 560 : 590}px;text-align:center;font-size:${b.n === 1000 ? 290 : 380}px;color:${b.fg}">${b.text || '0'}</div>
        <div class="bl" style="position:absolute;left:120px;right:120px;top:1230px;text-align:center;font-size:52px;font-weight:800;color:${b.fg};opacity:0;line-height:1.2">${esc(b.lbl)}</div>
      </div>`,
      )
      .join('')}
  </div></section>

  <section class="scene" id="b3" style="background:${CREAM}"><div class="cam">
    <div class="disc" style="width:1100px;height:1100px;left:420px;top:-320px;background:${CLAY};opacity:.35"></div>
    <div class="fr qm" style="position:absolute;left:40px;top:120px;font-size:520px;color:${GOLD};opacity:0;line-height:1">“</div>
    <div class="safe" style="top:560px;right:90px">
      <p class="fr quote" style="font-size:84px;line-height:1.14;color:${INK};letter-spacing:-.02em" data-full="${esc(stella.quote.split('. ')[0] + '.')}"></p>
      <div class="who" style="margin-top:40px;opacity:0">
        <div style="font-size:40px;font-weight:800;color:${FIG}">${esc(stella.author)}</div>
        <div class="lbl" style="font-size:22px;margin-top:10px;color:rgba(18,16,14,.6)">${esc(stella.context)}</div>
      </div>
    </div>
    <div class="kicker fr" style="position:absolute;left:66px;right:150px;top:1110px;font-size:74px;line-height:1.02;color:${FIG};opacity:0">Some clients follow a salon. <span style="color:${GOLD}">Hers follow her.</span></div>
    <div style="position:absolute;left:66px;right:190px;top:1400px;height:120px">
      <i class="route" style="position:absolute;left:30px;right:30px;top:28px;height:6px;background:${FIG};transform-origin:left;transform:scaleX(0)"></i>
      ${['Malvern', 'Armadale', 'Camberwell']
        .map(
          (s, i) => `<div class="stop" style="position:absolute;left:${i * 50}%;top:0;transform:translateX(-${i * 50}%);text-align:${['left', 'center', 'right'][i]};opacity:0">
            <i style="display:inline-block;width:62px;height:62px;border-radius:50%;background:${i === 2 ? GOLD : FIG};border:6px solid ${CREAM}"></i>
            <div style="font-size:30px;font-weight:800;color:${INK};margin-top:10px">${s}</div></div>`,
        )
        .join('')}
    </div>
  </div></section>

  <section class="scene" id="b4" style="background:${INK}"><div class="cam">
    <div class="gridwrap" style="position:absolute;inset:0">
      ${grid
        .map(([name, ramp], i) => {
          const c = i % 3, r = Math.floor(i / 3);
          return `<div class="tile" style="left:${c * 360 + 4}px;top:${r * 640 + 4}px;width:352px;height:632px;background:#140d09">
            <svg width="352" height="632" viewBox="0 0 352 632" style="position:absolute;left:0;top:0;transform-origin:50% 30%"><g transform="translate(-40 -20)">${strands({ w: 432, h: 690, seed: 300 + i * 13, n: 150, ramp, sway: 0.08, waves: 1.1, taper: 0.06, width: [1.3, 3.6], sheen: 0.7 })}</g></svg>
            <span class="lbl" style="position:absolute;left:50%;transform:translateX(-50%);white-space:nowrap;bottom:40px;padding:10px 18px;border-radius:999px;background:rgba(18,16,14,.72);color:${CREAM};font-size:19px;letter-spacing:.2em">${esc(name)}</span></div>`;
        })
        .join('')}
    </div>
    <div class="allsha pill" style="position:absolute;left:50%;top:860px;transform:translateX(-50%);padding:30px 56px;background:${INK};border:5px solid ${GOLD};opacity:0">
      <span class="fr" style="font-size:110px;color:${CREAM};line-height:1">All Sha.</span></div>
  </div></section>

  <section class="scene" id="b5" style="background:${INK}"><div class="cam">
    <div class="disc" style="width:1200px;height:1200px;left:-520px;top:1000px;background:${FIG};opacity:.6"></div>
    <div class="safe" style="top:300px;right:120px">
      <div class="lbl mt" style="color:${GOLD};opacity:0">The menu</div>
      <h2 class="fr mh" style="font-size:118px;margin-top:20px">${W('Every price, [[up front.]]')}</h2>
      <div style="margin-top:50px">
        ${menu.map(([n, s]) => `<div class="row"><span class="n">${esc(n)}</span><span class="p fr">${esc(price(s))}</span></div>`).join('')}
      </div>
    </div>
  </div></section>

  <section class="scene" id="b6" style="background:${FIG}"><div class="cam">
    <div class="rays" style="--c:${CLAY};width:2800px;height:2800px;left:-860px;top:-800px;opacity:.14"></div>
    <div class="shadisc" style="position:absolute;left:290px;top:250px;width:500px;height:500px;opacity:0">
      <svg style="position:absolute;left:-90px;top:-90px" width="680" height="680" viewBox="0 0 680 680">
        <defs><path id="rr" d="M340,30 a310,310 0 1,1 -0.1,0"/></defs>
        <g class="spin" style="transform-origin:340px 340px">
          <text font-family="Inter" font-size="30" font-weight="800" letter-spacing="8" fill="${GOLD}">
            <textPath href="#rr">${ringText.repeat(2)}</textPath></text></g>
      </svg>
      <div style="position:absolute;inset:0;border-radius:50%;overflow:hidden;border:8px solid ${GOLD}">
        <svg width="500" height="500" viewBox="0 0 500 500" style="position:absolute;left:0;top:0;background:#140d09"><g transform="translate(-40 -30)">${strands({ w: 580, h: 580, seed: 401, n: 200, ramp: HAIR.balayage, sway: 0.1, waves: 1.1, taper: 0.05, width: [1.3, 3.6], sheen: 0.8 })}</g>${glints({ w: 460, h: 460, seed: 402, n: 5, size: [10, 26] })}</svg>
      </div>
    </div>
    <div class="safe" style="top:900px;right:120px">
      <h1 class="fr come" style="font-size:190px;color:${CREAM}">${W('Come for [[Sha.]]')}</h1>
      <p class="det" style="margin-top:34px;font-size:38px;font-weight:700;color:${CLAY};opacity:0">One chair · Camberwell · Sundays 11–4</p>
      <div class="cta pill" style="margin-top:48px;padding:28px 46px;background:${GOLD};color:${INK};font-size:44px;opacity:0">DM me to book <span style="font-size:48px">→</span></div>
    </div>
    <div class="ticker" style="top:1640px;background:${INK}"><div class="tk" style="color:${GOLD}">${'COME FOR SHA ✦ ONE CHAIR ✦ CAMBERWELL ✦ DM TO BOOK ✦ '.repeat(5)}</div></div>
  </div></section>`;

  const upd = `
  b0(lt,el,dur){
    $('.d1',el).style.transform='translate('+(Math.sin(lt*1.2)*30)+'px,'+(lt*-24)+'px)';
    $('.d2',el).style.transform='translate('+(lt*-30)+'px,'+(Math.cos(lt)*24)+'px)';
    words($('.l1',el),lt,.1,.08);
    draw($('.strike',el),lt,.95,.3);
    slam($('.big',el),lt,1.3,.42,2.2); shake($('.cam',el),lt,1.55,.26,22);
    rise($('.sm',el),lt,1.9,.35,20);
  },
  b1(lt,el,dur){
    const h=$('.hair',el); fall(h,lt,0,.5); sway(h,lt,18,2,1.4,1.02,1.12,dur); twinkle(el,lt);
    pop($('.top',el),lt,.9,.35,.7);
    const n=$('.name',el); n.style.opacity=seg(lt,.25,.3); const p=E.outExpo(seg(lt,.25,.55)); n.style.transform='translateX('+((1-p)*-140)+'px)';
    draw($('.nr',el),lt,.35,.45); rise($('.nsub',el),lt,1.1);
  },
  b2(lt,el,dur){
    const B=dur/4;
    $$('.beat',el).forEach((b,i)=>{
      const s=i*B, p=E.inOutCubic(seg(lt,s,.3));
      b.style.clipPath= i===0 && lt<.001 ? 'circle(125% at 50% 50%)' : 'circle('+(i===0?125:p*125)+'% at 50% 55%)';
      b.style.zIndex=i;
      const bl=lt-s;
      $('.spin',b).style.transform='rotate('+(lt*22)+'deg)';
      const num=$('.bn',b), spec=${JSON.stringify(beats.map((b) => ({ n: b.n ?? null, suf: b.suf ?? '' })))}[i];
      if(spec.n!==null) count(num,bl,.08,.62,0,spec.n,(v)=>v.toLocaleString('en-AU')+spec.suf);
      slam(num,bl,.02,.36,1.6);
      rise($('.bl',b),bl,.32,.3,24);
    });
  },
  b3(lt,el,dur){
    pop($('.qm',el),lt,.08,.4,.5);
    typer($('.quote',el),lt,.12,1.9);
    rise($('.who',el),lt,2.2,.35);
    rise($('.kicker',el),lt,2.55,.45,40);
    draw($('.route',el),lt,.9,1.6);
    $$('.stop',el).forEach((s,i)=>{const p=seg(lt,.9+i*.75,.3); s.style.opacity=p; s.style.transform=s.style.transform.replace(/ scale\\(.*\\)/,'')+' scale('+lerp(.6,1,E.outBack(p))+')';});
  },
  b4(lt,el,dur){
    const order=[4,0,8,2,6,1,7,3,5];
    $$('.tile',el).forEach((tl,i)=>{
      // Tiles are present from frame one and only move — fading them in from
      // zero left ~10 frames of near-black under the drop transition.
      const k=order.indexOf(i), p=seg(lt,k*.045,.42), e=E.outExpo(p);
      tl.style.opacity=lerp(.55,1,clamp(p*1.5));
      const dx=((i%3)-1)*160, dy=(Math.floor(i/3)-1)*160;
      tl.style.transform='translate('+((1-e)*dx)+'px,'+((1-e)*dy)+'px) scale('+lerp(.55,1,e)+')';
      const im=tl.firstElementChild; im.style.transform='scale('+lerp(1.25,1.05,clamp(lt/dur))+')';
    });
    $('.gridwrap',el).style.transform='scale('+lerp(1,1.07,E.inOutCubic(clamp(lt/dur)))+')';
    const a=$('.allsha',el); const p=seg(lt,.95,.4), e=E.outBack(p); a.style.opacity=clamp(p*2); a.style.transform='translateX(-50%) scale('+lerp(.5,1,e)+')';
  },
  b5(lt,el,dur){
    rise($('.mt',el),lt,.05,.3,16);
    words($('.mh',el),lt,.15,.07);
    $$('.row',el).forEach((r,i)=>{const p=seg(lt,.6+i*.13,.38), e=E.outExpo(p); r.style.opacity=clamp(p*2); r.style.transform='perspective(900px) rotateX('+((1-e)*-88)+'deg)';});
  },
  b6(lt,el,dur){
    twinkle(el,lt);
    $('.rays',el).style.transform='rotate('+(lt*10)+'deg)';
    const d=$('.shadisc',el); pop(d,lt,.1,.45,.5);
    $('.spin',el).style.transform='rotate('+(lt*-26)+'deg)';
    words($('.come',el),lt,.45,.1,.42,70);
    rise($('.det',el),lt,1.05);
    const cta=$('.cta',el); rise(cta,lt,1.35,.35,30);
    if(lt>1.75) cta.style.transform='scale('+(1+.05*Math.sin((lt-1.75)*Math.PI*2*1.4))+')';
    $('.tk',el).style.transform='translateX('+(-(lt*240)%1300)+'px)';
  },`;

  return { name: 'w8-reel-b-come-for-sha', html: page(html, S, upd, css), scenes: S };
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
