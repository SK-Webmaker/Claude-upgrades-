import { checkCaption } from './src/lib/pack.js';

export const CAPTIONS = {
  'sun-01-reveal': {
    hook: "I'm opening Sundays.",
    body: "Ten till two, every week, starting this Sunday.\n\nI've had the same conversation about a hundred times now — someone wants their colour done properly and there is genuinely no weekday it fits. Work, school pick-up, the whole thing. So Sunday it is.\n\nFour hours. That's one big colour, or a handful of blow waves. It isn't much, which is exactly why I'd book early rather than think about it.",
    cta: 'Book at the link in bio',
    hashtags: ['#melbournehairdresser', '#camberwellhair', '#melbournecolourist', '#camberwellhairdresser', '#sundayhair'],
  },
  'sun-02-yours': {
    hook: 'Sunday might be the only four hours in your week that nobody else has a claim on.',
    body: "No school run. No inbox. Nothing you have to leave for at three.\n\nThat's the real reason I'm opening Sundays. Not because I wanted a longer week — because it's the one window most of the women in my chair have where they aren't doing something for somebody else.\n\nTen till two. Come and sit down.",
    cta: 'Book at the link in bio',
    hashtags: ['#camberwellhair', '#melbournehairdresser', '#melbournecolourist', '#camberwellhairdresser', '#melbournesalon'],
  },
  'sun-03-ledger': {
    hook: 'A Sunday is four hours long. That is the whole thing.',
    body: "A blonde transformation is four hours. A lived-in balayage is three and a half. Half foil and a toner, two and a half. A blow wave, forty five minutes.\n\nWhich means most Sundays hold one person. Occasionally two. Never more than that.\n\nI'd rather say that plainly now than have you message me at nine on a Saturday night.",
    cta: 'Book at the link in bio',
    hashtags: ['#melbournecolourist', '#camberwellhair', '#melbournehairdresser', '#balayagemelbourne', '#camberwellhairdresser'],
  },
  'sun-04-this-sunday': {
    hook: 'This Sunday is the first one.',
    body: "The thirtieth, ten till two. Four hours, one chair.\n\nIf you've been putting off something big — the correction, the full head, the thing you keep saying you'll get to — this is the Sunday with nothing in front of it.\n\nAfter this it runs every week. But the first one only happens once, and I'd like it to be someone who has been waiting for it.",
    cta: 'Book at the link in bio',
    hashtags: ['#camberwellhair', '#melbournehairdresser', '#melbournecolourist', '#camberwellhairdresser', '#sundayhair'],
  },
  'sun-05-next-sunday': {
    hook: "If this Sunday goes, the next one is the sixth.",
    body: "Same four hours. Same one chair.\n\nSpring starts Monday, and the fortnight after that is when everyone remembers their hair at the same time. Booking the sixth now means it is off your list before that happens to you.\n\nTen till two, every Sunday from here on.",
    cta: 'Book at the link in bio',
    hashtags: ['#melbournecolourist', '#camberwellhair', '#melbournehairdresser', '#springhair', '#camberwellhairdresser'],
  },
  'sun-06-fits': {
    hook: 'What actually fits into a Sunday.',
    body: "Save this so you know what to ask for.\n\nThe full four hours is a blonde transformation with K18. Three and a half is a lived-in balayage, toner and blow wave. Two and a half is a half foil and a toner. An hour and three quarters is a root colour and refresh. Forty five minutes is a blow wave, if what you want is simply to feel finished.\n\nThose are times, not prices. What a Sunday costs you is the four hours, and there are only four.",
    cta: 'DM me your hair goals',
    hashtags: ['#melbournehairdresser', '#camberwellhair', '#melbournecolourist', '#k18', '#camberwellhairdresser'],
  },
};

let bad = 0;
for (const [id, c] of Object.entries(CAPTIONS)) {
  const f = checkCaption(c);
  if (f.length) { bad++; console.log(`\n${id} — ${f.length} finding(s)`); f.forEach((x) => console.log('   ', JSON.stringify(x))); }
  else console.log(`${id} — clean`);
}
console.log(bad ? `\n${bad} caption(s) need fixing` : '\nAll clean.');
