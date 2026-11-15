// Interface wording in both languages. The couple's own details live in invite.config.js.

export const STR = {
  en: {
    skip: 'Skip to the details',
    sealLabel: 'Tap to open the invitation',
    kicker: 'We’re getting married',
    scroll: 'Scroll',
    scratchTitle: 'Scratch to reveal',
    scratchSkip: 'or tap here to reveal',
    forever: 'Our forever begins',
    dateTitle: 'Save the date',
    saveDate: 'Add to calendar',
    gcal: 'Google Calendar',
    countTitle: 'Counting down to forever',
    days: 'Days', hours: 'Hours', minutes: 'Minutes', seconds: 'Seconds',
    married: 'Happily married',
    progTitle: 'The programme',
    theMoment: 'The moment',
    venueTitle: 'The venue',
    openMaps: 'Open in Google Maps',
    dressTitle: 'What to wear',
    travelTitle: 'Travel, stay and gifts',
    travelH: 'Getting here', stayH: 'Staying over', giftsH: 'Gifts',
    blessTitle: 'Shower your blessings',
    blessText: 'Tap the plate of flowers. Every tap sends petals our way.',
    blessBtn: 'Shower petals',
    blessOne: 'One handful of petals, sent with love.',
    blessMany: (n) => `${n} handfuls of petals, sent with love.`,
    rsvpTitle: 'Coming? Tell us',
    rsvpBy: (d) => `Kindly reply by ${d}.`,
    fName: 'Your name', fJoin: 'Will you join us?', fYes: 'Joyfully, yes', fNo: 'Sadly, no',
    fGuests: 'How many of you?', fewer: 'One fewer', more: 'One more',
    fNote: 'A note for us (optional)',
    fNeedName: 'Please tell us your name.',
    fSend: 'Let Hari and Swetha know',
    fHint: 'This opens WhatsApp with your reply written out. Press send there and it reaches us.',
    thanks: 'Thank you',
    doneYes: (n) => `WhatsApp has your reply ready. Press send, and we will keep ${n === 1 ? 'a seat' : n + ' seats'} for you.`,
    doneNo: 'WhatsApp has your reply ready. Press send. We will miss you, and we will save you some sweets.',
    again: 'Change my reply',
    withLove: 'With love,',
    share: 'Share this invitation',
    copied: 'Link copied. Paste it anywhere.',
    shareText: (a, b) => `${a} & ${b} are getting married. Open your invitation:`,
    draft: 'Sample details',
    and: '&',
    music: 'Music',
    waYes: (name, n, when) => `Hello! This is ${name}. We will be there for the wedding (${when}).\nGuests: ${n}`,
    waNo: (name) => `Namaste! This is ${name}. I am sorry, I cannot make it to the wedding. My blessings are with you both.`,
    waNote: (t) => `\nNote: ${t}`,
    calTitle: (a, b, ev) => `${a} & ${b} · ${ev}`,
    seal: { lines: ['TAP TO OPEN'], size: 13.4, gap: 0, spacing: 1.9, weight: 700, font: '"Cormorant Garamond", Georgia, serif', dy: 0.6 },
  },
  ta: {
    skip: 'விவரங்களுக்குச் செல்ல',
    sealLabel: 'அழைப்பிதழைத் திறக்கத் தொடுங்கள்',
    kicker: 'திருமண அழைப்பிதழ்',
    scroll: 'கீழே',
    scratchTitle: 'சுரண்டிப் பாருங்கள்',
    scratchSkip: 'அல்லது இங்கே தொடுங்கள்',
    forever: 'இனிய பயணம் தொடங்குகிறது',
    dateTitle: 'திருமண நாள்',
    saveDate: 'காலண்டரில் சேர்க்க',
    gcal: 'கூகுள் காலண்டர்',
    countTitle: 'அந்த நாளுக்காகக் காத்திருக்கிறோம்',
    days: 'நாட்கள்', hours: 'மணி', minutes: 'நிமிடம்', seconds: 'விநாடி',
    married: 'இனிதே நிறைவேறியது',
    progTitle: 'நிகழ்ச்சி நிரல்',
    theMoment: 'மங்கல நேரம்',
    venueTitle: 'மண்டபம்',
    openMaps: 'கூகுள் மேப்ஸில் திறக்க',
    dressTitle: 'உடை',
    travelTitle: 'பயணம், தங்குமிடம், பரிசுகள்',
    travelH: 'பயணம்', stayH: 'தங்குமிடம்', giftsH: 'பரிசுகள்',
    blessTitle: 'மலர் தூவி வாழ்த்துங்கள்',
    blessText: 'மலர்த் தட்டைத் தொடுங்கள். ஒவ்வொரு தொடுதலும் எங்களுக்கு மலர்களை அனுப்பும்.',
    blessBtn: 'மலர் தூவ',
    blessOne: 'ஒரு கைப்பிடி மலர்கள், அன்புடன் அனுப்பப்பட்டன.',
    blessMany: (n) => `${n} கைப்பிடி மலர்கள், அன்புடன் அனுப்பப்பட்டன.`,
    rsvpTitle: 'வருவீர்களா?',
    rsvpBy: (d) => `${d}-க்குள் தெரிவிக்க வேண்டுகிறோம்.`,
    fName: 'உங்கள் பெயர்', fJoin: 'எங்களுடன் இணைவீர்களா?', fYes: 'மகிழ்ச்சியுடன் வருகிறேன்', fNo: 'வர இயலவில்லை',
    fGuests: 'எத்தனை பேர்?', fewer: 'ஒருவர் குறைவு', more: 'ஒருவர் கூடுதல்',
    fNote: 'எங்களுக்கு ஒரு செய்தி (விருப்பம்)',
    fNeedName: 'உங்கள் பெயரைச் சொல்லுங்கள்.',
    fSend: 'ஹரி – ஸ்வேதாவுக்குத் தெரிவிக்க',
    fHint: 'உங்கள் பதில் எழுதப்பட்ட நிலையில் வாட்ஸ்அப் திறக்கும். அங்கே அனுப்பு என்பதை அழுத்தினால் எங்களுக்கு வந்து சேரும்.',
    thanks: 'நன்றி',
    doneYes: (n) => `உங்கள் பதில் வாட்ஸ்அப்பில் தயாராக உள்ளது. அனுப்பு என்பதை அழுத்துங்கள்; உங்களுக்காக ${n} இருக்கை${n === 1 ? '' : 'கள்'} காத்திருக்கும்.`,
    doneNo: 'உங்கள் பதில் வாட்ஸ்அப்பில் தயாராக உள்ளது. அனுப்பு என்பதை அழுத்துங்கள். உங்கள் வாழ்த்து எங்களுடன் இருக்கும்.',
    again: 'பதிலை மாற்ற',
    withLove: 'அன்புடன்,',
    share: 'அழைப்பிதழைப் பகிர',
    copied: 'இணைப்பு நகலெடுக்கப்பட்டது.',
    shareText: (a, b) => `${a} – ${b} திருமண அழைப்பிதழ்:`,
    draft: 'மாதிரி விவரங்கள்',
    and: '&',
    music: 'இசை',
    waYes: (name, n, when) => `வணக்கம்! நான் ${name}. திருமணத்திற்கு (${when}) வருகிறோம்.\nஎத்தனை பேர்: ${n}`,
    waNo: (name) => `வணக்கம்! நான் ${name}. திருமணத்திற்கு வர இயலவில்லை, மன்னிக்கவும். உங்கள் இருவருக்கும் என் வாழ்த்துகள்.`,
    waNote: (t) => `\nசெய்தி: ${t}`,
    calTitle: (a, b, ev) => `${a} – ${b} · ${ev}`,
    seal: { lines: ['திறக்கத்', 'தொடுங்கள்'], size: 12.2, gap: 17.5, spacing: 0, weight: 700, font: '"Noto Serif Tamil", serif', dy: 0.5 },
  },
};

const IST = 'Asia/Kolkata';
const LOCALE = { en: 'en-IN', ta: 'ta-IN' };

export function fmtDate(iso, lang, opts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) {
  return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: IST, ...opts }).format(new Date(iso));
}

// "9:00 AM" in English; "காலை 9:00" in Tamil, the way an invitation card writes it.
export function fmtTime(iso, lang) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: IST, hour: 'numeric', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso));
  const h = +parts.find((p) => p.type === 'hour').value, m = parts.find((p) => p.type === 'minute').value;
  const h12 = ((h + 11) % 12) + 1;
  if (lang === 'ta') {
    const part = h < 4 ? 'இரவு' : h < 12 ? 'காலை' : h < 16 ? 'மதியம்' : h < 19 ? 'மாலை' : 'இரவு';
    return `${part} ${h12}:${m}`;
  }
  return `${h12}:${m} ${h < 12 ? 'AM' : 'PM'}`;
}

export function fmtRange(start, end, lang) {
  if (!end) return fmtTime(start, lang);
  return `${fmtTime(start, lang)} – ${fmtTime(end, lang)}`;
}

// The calendar day in India, as yyyy-mm-dd, so events can be grouped by day whatever the guest's time zone.
export function dayKey(iso) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
