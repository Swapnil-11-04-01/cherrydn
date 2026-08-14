/* ============================================================
   WHAT SHE CAN CHANGE
   One description of the whole site, so the portal builds itself and
   nothing can drift out of sync. Every key here matches a data-cms
   hook in the pages.
   ============================================================ */
window.CHERRY_SCHEMA = [
  {
    id: "landing", name: "Landing", num: "—", page: "index.html",
    blurb: "The first breath. The doors are edited below in Doors.",
    fields: [
      { k: "landing_hero_image", label: "Hero image", type: "image" },
      { k: "landing_roles", label: "The trinity", hint: "the dots are <i>·</i>" },
      { k: "landing_welcome", label: "Welcome line" },
      { k: "landing_cta", label: "Main button" },
      { k: "landing_cta2", label: "Second button" }
    ]
  },
  {
    id: "doors", name: "Doors", num: "—", page: "index.html",
    blurb: "The five worlds on the landing, and the quiet links beneath them.",
    list: "portals"
  },
  {
    id: "book", name: "The Book", num: "00", page: "book.html",
    blurb: "The heart. Everything else grew out of it.",
    fields: [
      { k: "book_crown_tag", label: "Crown line" },
      { k: "book_display", label: "Title" },
      { k: "book_sub", label: "Subtitle" },
      { k: "book_kind", label: "Kind line", hint: "poetry / forthcoming" },
      { k: "book_cover_title", label: "Title on the cover", hint: "use <br/> for the line break" },
      { k: "book_cover_by", label: "Byline on the cover" },
      { k: "book_cover_image", label: "Cover image", type: "image",
        hint: "until this exists the typographic cover shows" },
      { k: "book_lede", label: "Opening paragraph", type: "long" },
      { k: "book_gift_title", label: "Audiobook panel title" },
      { k: "book_gift_text", label: "Audiobook panel text", type: "long" },
      { k: "book_reserve_title", label: "Reserve title" },
      { k: "book_reserve_text", label: "Reserve text", type: "long" },
      { k: "book_endline", label: "Closing line" }
    ]
  },
  {
    id: "written", name: "Written Word", num: "01", page: "written-word.html",
    blurb: "Poems and monologues, two to a phase.",
    fields: [
      { k: "ww_crown_tag", label: "Crown line" },
      { k: "ww_display", label: "Display title", hint: "use <br/> for the line break" },
      { k: "ww_sub", label: "Subtitle" },
      { k: "ww_restline", label: "Closing line" }
    ],
    list: "pieces"
  },
  {
    id: "visuals", name: "Visuals", num: "02", page: "visuals.html",
    blurb: "The wall. Drop new work straight in.",
    fields: [
      { k: "vis_crown_tag", label: "Crown line" },
      { k: "vis_display", label: "Display title" },
      { k: "vis_sub", label: "Subtitle" }
    ],
    list: "works"
  },
  {
    id: "spoken", name: "Spoken Word", num: "03", page: "spoken-word.html",
    blurb: "The audiobook, chapter by chapter.",
    fields: [
      { k: "sw_crown_tag", label: "Crown line" },
      { k: "sw_display", label: "Display title" },
      { k: "sw_sub", label: "Subtitle" },
      { k: "sw_intro", label: "Intro paragraph", type: "long" },
      { k: "sw_note", label: "Waiting note", hint: "shown while no audio exists" },
      { k: "sw_gift_title", label: "Gift panel title" },
      { k: "sw_gift_text", label: "Gift panel text", type: "long" }
    ],
    list: "spoken"
  },
  {
    id: "film", name: "Film", num: "04", page: "film.html",
    blurb: "Moving image.",
    fields: [
      { k: "film_crown_tag", label: "Crown line" },
      { k: "film_display", label: "Display title" },
      { k: "film_sub", label: "Subtitle" },
      { k: "film_frame_image", label: "The frame", type: "image" },
      { k: "film_line", label: "Line under the frame" },
      { k: "film_note", label: "Note when clicked" }
    ]
  },
  {
    id: "music", name: "Music", num: "05", page: "music.html",
    blurb: "Cherry and DN, and the songs between them.",
    fields: [
      { k: "music_crown_tag", label: "Crown line" },
      { k: "music_crown_line", label: "Duality line" },
      { k: "music_cherry_eyebrow", label: "Cherry's line", hint: "the one who feels" },
      { k: "music_dn_eyebrow", label: "DN's line", hint: "the one who watches" },
      { k: "music_melodies_title", label: "Coda title" },
      { k: "music_melodies_text", label: "Coda poem", type: "long", hint: "use <br/> for line breaks" },
      { k: "music_melodies_image", label: "Coda image", type: "image" }
    ],
    list: "tracks"
  },
  {
    id: "about", name: "About", num: "06", page: "about.html",
    blurb: "Who is speaking.",
    fields: [
      { k: "about_crown_tag", label: "Crown line" },
      { k: "about_display", label: "Display title" },
      { k: "about_sub", label: "Subtitle" },
      { k: "about_portrait_image", label: "Portrait", type: "image" },
      { k: "about_duality", label: "The duality line" },
      { k: "about_signature", label: "Signature" }
    ]
  },
  {
    id: "contact", name: "Contact", num: "07", page: "contact.html",
    blurb: "Where letters arrive.",
    fields: [
      { k: "contact_crown_tag", label: "Crown line" },
      { k: "contact_display", label: "Display title" },
      { k: "contact_sub", label: "Subtitle" },
      { k: "contact_note", label: "Note under the form" },
      { k: "contact_endline", label: "Closing line" }
    ]
  },
  {
    id: "gift", name: "The Gift", num: "—", page: "gift.html",
    blurb: "What the QR code in the printed book opens.",
    fields: [
      { k: "gift_intro", label: "Intro", type: "long" },
      { k: "gift_panel_title", label: "Panel title" },
      { k: "gift_panel_text", label: "Panel text", type: "long" },
      { k: "gift_endline", label: "Closing line" }
    ]
  },
  {
    id: "site", name: "Everywhere", num: "—", page: "index.html",
    blurb: "Lines that appear on every page.",
    fields: [
      { k: "site_foot_line", label: "Footer line" },
      { k: "site_email", label: "Public email" },
      { k: "site_instagram", label: "Instagram" },
      { k: "phase_water_theme", label: "Water" },
      { k: "phase_fire_theme", label: "Fire" },
      { k: "phase_earth_theme", label: "Earth" },
      { k: "phase_air_theme", label: "Air" }
    ]
  }
];

/* the four lists, and how each row is edited */
window.CHERRY_LISTS = {
  works: {
    table: "cherry_works", label: "Artwork", adds: "image",
    grouped: "phase", media: "image_url",
    fields: [
      { k: "title", label: "Title" },
      { k: "phase", label: "Phase", type: "phase" },
      { k: "note", label: "A few words", type: "long",
        hint: "shown when the image is opened" },
      { k: "image_url", label: "Image", type: "image" }
    ]
  },
  pieces: {
    table: "cherry_pieces", label: "Piece", adds: "blank",
    grouped: "phase",
    fields: [
      { k: "title", label: "Title" },
      { k: "kind", label: "Kind", type: "choice", options: ["poem", "monologue"] },
      { k: "phase", label: "Phase", type: "phase" },
      { k: "excerpt", label: "Excerpt", type: "long", hint: "the lines shown before opening" },
      { k: "body", label: "The piece", type: "long", rows: 14, hint: "use <br/> for line breaks" }
    ]
  },
  tracks: {
    table: "cherry_tracks", label: "Track", adds: "audio", filter: { voice: ["cherry", "dn"] },
    grouped: "voice", media: "audio_url",
    fields: [
      { k: "title", label: "Title" },
      { k: "voice", label: "Whose", type: "choice", options: ["cherry", "dn"] },
      { k: "length", label: "Length", hint: "3:45" },
      { k: "audio_url", label: "Audio", type: "audio" }
    ]
  },
  spoken: {
    table: "cherry_tracks", label: "Chapter", adds: "audio", filter: { voice: ["spoken"] },
    defaults: { voice: "spoken", length: "--:--" }, media: "audio_url",
    fields: [
      { k: "title", label: "Title" },
      { k: "length", label: "Length" },
      { k: "audio_url", label: "Audio", type: "audio" }
    ]
  },
  portals: {
    table: "cherry_portals", label: "Door", adds: "blank",
    grouped: "kind", media: "image_url",
    fields: [
      { k: "name", label: "Name" },
      { k: "blurb", label: "Words beneath", type: "long" },
      { k: "href", label: "Goes to", hint: "written-word.html" },
      { k: "kind", label: "Kind", type: "choice", options: ["portal", "strip"] },
      { k: "image_url", label: "Image", type: "image" }
    ]
  }
};
