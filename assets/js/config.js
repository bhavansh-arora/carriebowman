/* ==========================================================================
   Site configuration: the only file to touch to connect the automations.
   Leave a value empty and the site falls back gracefully (pre-filled email).
   ========================================================================== */
window.SITE_CONFIG = {
  name: "Carrie Bowman",
  email: "Carrie@carriebowman.com",

  /* Carrie's existing Acuity scheduler for the complimentary Clarity Call.
     After someone completes the short intake, "Choose your time" opens this
     link with their name, email and phone already filled in. */
  bookingUrl: "https://carriebowman.as.me/schedule/500435ed/appointment/26680645/calendar/6046583?appointmentTypeIds%5B%5D=26680645",

  /* Any endpoint that accepts a JSON POST (Formspree, Make.com or Zapier
     webhook, ActiveCampaign via webhook, Basin …). Each form can have its own.
     Empty = the visitor's email app opens with everything pre-filled. */
  intakeEndpoint: "",     // Clarity Call intake
  speakingEndpoint: "",   // Speaker / podcast enquiries
  guideEndpoint: "",      // "5 Bold Steps" guide opt-in (e.g. ActiveCampaign)
  insiderEndpoint: "",    // "Become an insider" newsletter

  /* Shown to visitors after they send something. */
  replyPromise: "within one business day",
  speakingReply: "within 2 business days"
};
