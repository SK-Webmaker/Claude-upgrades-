// Downloads the latin subsets of the two brand faces and inlines them as data
// URIs, so card rendering never depends on Google Fonts being reachable from
// inside Chromium (it is not — the sandbox proxy is not in Chromium's trust store).
import { writeFileSync, mkdirSync } from 'node:fs';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const URL_ = 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..700&family=Inter:wght@300..700&display=swap';
const css = await (await fetch(URL_, { headers: { 'User-Agent': UA } })).text();
const blocks = css.split('@font-face').slice(1).map((b) => '@font-face' + b.slice(0, b.indexOf('}') + 1));
const latin = blocks.filter((b) => /unicode-range:\s*U\+0000-00FF/.test(b));
let out = '';
for (const b of latin) {
  const url = b.match(/url\((https:[^)]+)\)/)[1];
  const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
  out += b.replace(url, `data:font/woff2;base64,${buf.toString('base64')}`) + '\n';
  console.error(url.split('/').pop(), buf.length);
}
mkdirSync('assets/fonts', { recursive: true });
writeFileSync('assets/fonts/brand-fonts.css', out);
console.error('wrote', out.length, 'bytes,', latin.length, 'faces');
