/*
  Hariharan & Swetha — every detail a guest reads lives in this one file.

  HOW TO EDIT
  - Change the text between the quotes. "en" is English, "ta" is Tamil.
  - Dates use the form 2027-02-14T09:00:00+05:30 (year-month-day T hour:minute, India time).
  - Lines marked  // SAMPLE  were invented so the design has something to show. Replace them.
  - When every SAMPLE line is real, set  draft: false  and the small "sample details" tag disappears.
*/
window.INVITE = {
  draft: false,                // true shows a small "sample details" tag on the page
  startLanguage: "en",         // "en" or "ta"
  languageSwitch: false,       // each language has its own link: add ?lang=ta or ?lang=en. true also shows a switch button
  sound: true,                 // music starts when the guest taps the seal
  // Put an mp3 in this folder and name it here to play it instead of the built-in melody, e.g. "music.mp3".
  // If the file is missing the built-in melody plays.
  musicFile: "music.mp3",
  // shown at the very end of the page as:  Music: <title> by <by>  (the title links to url)
  musicCredit: { title: "Rangapura Vihara", by: "Agam", url: "https://www.youtube.com/watch?v=T9p_lQ0oT4s" },

  couple: {
    groom: {
      name:    { en: "Hariharan", ta: "ஹரிஹரன்" },
      parents: { en: "Son of Mr. Ragunath & Mrs. Punitha",
                 ta: "திரு. ரகுநாத் – திருமதி. புனிதா தம்பதியரின் புதல்வன்" },        // check the Tamil spelling
    },
    bride: {
      name:    { en: "Swetha", ta: "ஸ்வேதா" },
      parents: { en: "Daughter of Mr. Kalyan Krishnan & Mrs. Santhi",
                 ta: "திரு. கல்யாண் கிருஷ்ணன் – திருமதி. சாந்தி தம்பதியரின் புதல்வி" }, // check the Tamil spelling
    },
    initials: "H & S",
    hashtag: "#HariWedsSwetha",                                                      // SAMPLE
  },

  // The day on the invitation: the reception at Woodlands. Add the time when it is fixed and set showTime: true.
  wedding: {
    start: "2027-03-11T18:30:00+05:30",       // the date is real (11 March 2027); the time is a SAMPLE
    end:   "2027-03-11T21:30:00+05:30",       // SAMPLE
    showTime: false,                          // false: the page and the calendar entry show the date only
  },

  welcome: {
    en: "With the blessings of our parents and elders, we invite you to the day two families become one. All we need is your presence.",
    ta: "எங்கள் பெற்றோர் மற்றும் பெரியோர்களின் ஆசியுடன், இரு குடும்பங்கள் ஒன்றாகும் இந்த இனிய நாளுக்கு உங்களை அன்புடன் அழைக்கிறோம். உங்கள் வருகை ஒன்றே எங்களுக்குப் போதும்.",
  },

  venue: {
    name:    { en: "New Woodlands Hotel", ta: "நியூ உட்லண்ட்ஸ் ஹோட்டல்" },
    address: { en: "72-75, Dr. Radhakrishnan Salai, Mylapore, Chennai 600004",
               ta: "72-75, டாக்டர் ராதாகிருஷ்ணன் சாலை, மயிலாப்பூர், சென்னை 600004" },
    short:   { en: "Woodlands, RK Salai, Chennai", ta: "உட்லண்ட்ஸ், ஆர்.கே. சாலை, சென்னை" },
    // Paste the Google Maps share link of the hall here. Left empty, the button searches for the name + address above.
    mapsUrl: "",
  },

  rsvp: {
    // WhatsApp number that receives the replies: country code + number, digits only, e.g. "919876543210".
    // Left empty, the guest's WhatsApp opens with the reply written and they pick your chat themselves.
    whatsapp: "",
    by: "2027-02-20",                                                                // SAMPLE
  },
};
