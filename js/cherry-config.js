/* Where Cherry's archive lives.
   The publishable key is meant to be public: it can only read what she has
   published. Every write is refused unless the request carries her own
   signed-in session, enforced by row level security in the database. */
window.CHERRY = {
  url: "https://rpmpztmktfcobxiofvce.supabase.co",
  key: "sb_publishable_TXkLDB6oprBf0YcqD910Tg_3oc_-lCF",
  bucket: "cherry-media",
  phases: ["water", "fire", "earth", "air"]
};
