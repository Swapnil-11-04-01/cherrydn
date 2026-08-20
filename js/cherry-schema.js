/* ============================================================
   WHAT SHE CAN CHANGE, IN HER OWN WORDS
   Not one label here is a column name, a CSS class or a team
   metaphor. Every line is what Cherry reads.
   ============================================================ */

/* the three lines at the top of a page are named identically everywhere,
   because they are the same three lines everywhere */
var TOP = function (prefix) {
  return [
    { k: prefix + "_crown_tag", label: "The small italic line at the very top" },
    { k: prefix + "_display", label: "The big title on this page", enter: true },
    { k: prefix + "_sub", label: "The line just under the big title" }
  ];
};

window.CHERRY_SCHEMA = [
  {
    id: "home", name: "Home page", page: "index.html",
    blurb: "What people see first.",
    fields: [
      { k: "landing_hero_image", label: "The big photo behind your name", type: "image",
        hint: "It fills the whole screen, so choose something that reads well very wide." },
      { k: "landing_roles", label: "The three words under your name",
        hint: "The site puts the dots between them for you." },
      { k: "landing_welcome", label: "The sentence under the three words" },
      { k: "landing_cta", label: "The red button" },
      { k: "landing_cta2", label: "The outline button" }
    ],
    lists: [
      { id: "portals", title: "The five picture links" },
      { id: "strip", title: "The three small links underneath" }
    ]
  },
  {
    id: "book", name: "The Book", page: "book.html",
    blurb: "The heart. Everything else grew out of it.",
    fields: TOP("book").concat([
      { k: "book_kind", label: "The little label under the subtitle" },
      { k: "book_cover_title", label: "The title printed on the cover", enter: true,
        hint: "Press Enter to split it across two lines." },
      { k: "book_cover_by", label: "The line under it on the cover" },
      { k: "book_cover_image", label: "A photo of the cover", type: "image",
        hint: "Leave this empty and the site draws the cover in type instead." },
      { k: "book_lede", label: "The opening paragraph", type: "long", enter: true },
      { k: "book_gift_title", label: "The audiobook box: its heading" },
      { k: "book_gift_text", label: "The audiobook box: the words inside", type: "long", enter: true },
      { k: "book_reserve_title", label: "Above the sign-up: the heading" },
      { k: "book_reserve_text", label: "Above the sign-up: the words", type: "long", enter: true },
      { k: "book_endline", label: "The last line on this page" }
    ])
  },
  {
    id: "written", name: "Written Word", page: "written-word.html",
    blurb: "Your poems and monologues.",
    fields: TOP("ww").map(function (f) {   /* this one carries an <em>, so it gets the note */
      return f.k === "ww_sub" ? { k: "ww_sub", label: f.label, em: true } : f;
    }).concat([
      { k: "ww_restline", label: "The last line on this page" }
    ]),
    rooms: "pieces"
  },
  {
    id: "visuals", name: "Visuals", page: "visuals.html",
    blurb: "Your wall of pictures.",
    fields: TOP("vis"),
    rooms: "works"
  },
  {
    id: "spoken", name: "Spoken Word", page: "spoken-word.html",
    blurb: "Your spoken word, as a playlist. The book read aloud lives on the QR-code page.",
    fields: TOP("sw").concat([
      { k: "sw_intro", label: "The opening paragraph", type: "long", enter: true, em: true },
      { k: "sw_note", label: "What to show until the recordings are ready",
        hint: "This disappears on its own once you add your first piece." },
      { k: "sw_gift_title", label: "The gift box: its heading" },
      { k: "sw_gift_text", label: "The gift box: the words inside", type: "long", enter: true, em: true }
    ]),
    groups: "spoken"
  },
  {
    id: "film", name: "Film", page: "film.html",
    blurb: "Moving image.",
    fields: TOP("film").concat([
      { k: "film_frame_image", label: "The still from your film", type: "image",
        hint: "This whole block disappears once you add your first film." },
      { k: "film_line", label: "The line under the picture" },
      { k: "film_note", label: "The words that appear when someone taps the picture" }
    ]),
    lists: [{ id: "films", title: "Your films" }]
  },
  {
    id: "music", name: "Music", page: "music.html",
    blurb: "Cherry and DN, and the songs between them.",
    fields: [
      { k: "music_crown_tag", label: "The small italic line at the very top" },
      { k: "music_crown_line", label: "The line above the two names" },
      { k: "music_cherry_eyebrow", label: "The words under CHERRY" },
      { k: "music_dn_eyebrow", label: "The words under DN" },
      { k: "music_melodies_title", label: "The block at the bottom: its heading" },
      { k: "music_melodies_text", label: "The block at the bottom: the little poem", type: "long", enter: true },
      { k: "music_melodies_image", label: "The block at the bottom: the picture", type: "image" }
    ],
    lists: [{ id: "cherrysongs", title: "Cherry's songs" }, { id: "dnsongs", title: "DN's songs" }]
  },
  {
    id: "about", name: "About you", page: "about.html",
    blurb: "Who is speaking.",
    fields: TOP("about").concat([
      { k: "about_portrait_image", label: "Your portrait", type: "image" },
      { k: "about_duality", label: "The Cherry-and-DN sentence near the end" },
      { k: "about_signature", label: "Your signature at the very bottom" }
    ])
  },
  {
    id: "contact", name: "Contact", page: "contact.html",
    blurb: "Where letters arrive.",
    fields: TOP("contact").concat([
      { k: "contact_note", label: "The note under the form" },
      { k: "contact_endline", label: "The last line on this page" }
    ])
  },
  {
    id: "gift", name: "The QR-code page", page: "gift.html",
    blurb: "What the code inside the printed book opens: the book, read aloud, chapter by chapter.",
    fields: [
      { k: "gift_intro", label: "The opening paragraph", type: "long", enter: true, em: true },
      { k: "gift_panel_title", label: "The box on this page: its heading" },
      { k: "gift_panel_text", label: "The box on this page: the words inside", type: "long", enter: true },
      { k: "gift_note", label: "What to show until the recordings are ready",
        hint: "This disappears on its own once you add your first chapter." },
      { k: "gift_endline", label: "The last line on this page" }
    ],
    groups: "chapters"
  },
  {
    id: "everywhere", name: "The bottom of every page", page: "index.html",
    blurb: "Lines that show on all nine pages.",
    fields: [
      { k: "site_foot_line", label: "The line at the bottom of every page" },
      { k: "site_email", label: "Your email address" },
      { k: "site_instagram", label: "Your Instagram" }
    ]
  },
  {
    id: "hidden", name: "Hidden & removed", page: "index.html",
    blurb: "Everything only you can see, and anything you have taken off the site.",
    special: "hidden"
  }
];

/* the four rooms, described the way she talks about them */
window.CHERRY_ROOMS = [
  { k: "water", name: "Water", says: "grief, memory, surrender" },
  { k: "fire",  name: "Fire",  says: "desire, anger, awakening" },
  { k: "earth", name: "Earth", says: "healing, body, belonging" },
  { k: "air",   name: "Air",   says: "forgiveness, flight, return" }
];

window.CHERRY_LISTS = {
  works: {
    table: "cherry_works", one: "artwork", add: "Add an artwork",
    accept: "image/*", media: "image_url", room: "phase",
    drop: "Drop photos here, or choose them from your phone.",
    fields: [
      { k: "title", label: "Its name" },
      { k: "note", label: "What you want to say about this picture", type: "long", enter: true,
        hint: "People see this when they tap it." },
      { k: "image_url", label: "The picture", type: "image" }
    ]
  },
  pieces: {
    table: "cherry_pieces", one: "poem", add: "Add a poem", room: "phase",
    fields: [
      { k: "title", label: "Its name" },
      { k: "kind", label: "Is this a poem or a monologue?", type: "choice",
        options: [["poem", "Poem"], ["monologue", "Monologue"]] },
      { k: "excerpt", label: "The lines people see before they tap", type: "long", enter: true },
      { k: "body", label: "The poem", type: "long", rows: 14, enter: true,
        hint: "Write it the way it should look. Press Enter for a new line." }
    ]
  },
  portals: {
    table: "cherry_portals", one: "picture link", add: "Add a picture link",
    accept: "image/*", media: "image_url", where: { kind: "portal" },
    fields: [
      { k: "name", label: "Its name" },
      { k: "blurb", label: "The words under the name", type: "long", enter: true },
      { k: "href", label: "Where it goes", type: "page" },
      { k: "image_url", label: "Its picture", type: "image" }
    ]
  },
  strip: {
    table: "cherry_portals", one: "small link", add: "Add a small link",
    where: { kind: "strip" },
    fields: [
      { k: "name", label: "What it says" },
      { k: "href", label: "Where it goes", type: "page" }
    ]
  },
  films: {
    table: "cherry_films", one: "film", add: "Add a film",
    accept: "video/mp4,video/webm,video/quicktime,video/x-m4v", media: "video_url",
    drop: "Drop films here, or choose them from your computer.",
    fields: [
      { k: "title", label: "Its name" },
      { k: "note", label: "A few words about it", type: "long", enter: true },
      { k: "video_url", label: "The film itself", type: "film" },
      { k: "poster_url", label: "The picture people see before they press play", type: "image",
        hint: "Made for you from the film. Change it whenever you like." }
    ]
  },
  cherrysongs: {
    table: "cherry_tracks", one: "song", add: "Add a song",
    accept: "audio/*", media: "audio_url", where: { voice: "cherry" },
    fields: [
      { k: "title", label: "Its name" },
      { k: "length", label: "How long it is", hint: "Read from the recording, change it if you like." },
      { k: "audio_url", label: "The recording", type: "audio" },
      { k: "lyrics", label: "The words to this song", type: "long", rows: 12, enter: true,
        hint: "Write them as they should look. Leave it empty and no one is offered them." }
    ]
  },
  dnsongs: {
    table: "cherry_tracks", one: "song", add: "Add a song",
    accept: "audio/*", media: "audio_url", where: { voice: "dn" },
    fields: [
      { k: "title", label: "Its name" },
      { k: "length", label: "How long it is", hint: "Read from the recording, change it if you like." },
      { k: "audio_url", label: "The recording", type: "audio" },
      { k: "lyrics", label: "The words to this song", type: "long", rows: 12, enter: true,
        hint: "Write them as they should look. Leave it empty and no one is offered them." }
    ]
  },
  /* The book read aloud. These are the chapters the code inside the printed
     cover opens, so they live on the QR-code page and nowhere else. */
  chapters: {
    table: "cherry_tracks", one: "chapter", add: "Add a chapter",
    accept: "audio/*", media: "audio_url", where: { voice: "chapter" },
    groups: true, groupKey: "chapter_groups", loose: "The chapters",
    newGroup: "Name it, for instance The Audiobook",
    fields: [
      { k: "title", label: "Its name" },
      { k: "length", label: "How long it is", hint: "Read from the recording, change it if you like." },
      { k: "audio_url", label: "The recording", type: "audio" },
      { k: "lyrics", label: "The words of this chapter", type: "long", rows: 12, enter: true,
        hint: "Write them as they should look. Leave it empty and no one is offered them." }
    ]
  },
  /* Her spoken word: narrated, not sung, and not the book. A playlist on the
     Spoken Word page, filled the same way the songs are. */
  spoken: {
    table: "cherry_tracks", one: "piece", add: "Add a spoken word piece",
    accept: "audio/*", media: "audio_url", where: { voice: "spoken" },
    groups: true, groupKey: "spoken_groups", loose: "Your spoken word",
    newGroup: "Name it, for instance Live",
    fields: [
      { k: "title", label: "Its name" },
      { k: "length", label: "How long it is", hint: "Read from the recording, change it if you like." },
      { k: "audio_url", label: "The recording", type: "audio" },
      { k: "lyrics", label: "The words of this piece", type: "long", rows: 12, enter: true,
        hint: "Write them as they should look. Leave it empty and no one is offered them." }
    ]
  }
};

/* where a picture link can point */
window.CHERRY_PAGES = [
  ["book.html", "The Book"], ["written-word.html", "Written Word"],
  ["visuals.html", "Visuals"], ["spoken-word.html", "Spoken Word"],
  ["film.html", "Film"], ["music.html", "Music"],
  ["about.html", "About you"], ["contact.html", "Contact"],
  ["gift.html", "The QR-code page"], ["index.html", "Home page"]
];
