/* ============================================================================
   RARE POND RENTALS — JOTFORM FORM MAP
   ----------------------------------------------------------------------------
   This is the ONLY file you edit to change how the on-site forms talk to
   Jotform. Full instructions live in README.md → "Maintaining the forms".

   Quick version:
     1. In Jotform, add/rename your field. Copy its INPUT NAME
        (Jotform → Publish → Embed → "Source Code"; each input looks like
         name="q11_insurance"). The number is stable — reordering fields in
        Jotform does NOT change it.
     2. Add/adjust the mapping in `fields` below (siteKey: "jotformInputName").
     3. To make a NEW question actually appear on the site, also add a line to
        the `render` list (label + type). Standard types render automatically
        in the site's styling — no other code needed.
     4. Open  /form-check.html  to confirm everything is mapped, then submit
        one test entry and check it lands complete in your Jotform inbox.
   ============================================================================ */

window.FORMS = {

  /* ---- Rental quote request (opens from the cart) ------------------------ */
  rentalRequest: {
    formId: "261817432074052",
    // siteKey  ->  Jotform input name
    fields: {
      firstName: "q7_firstName",
      lastName:  "q8_lastName",
      email:     "q9_contactEmail",
      film:      "q10_nameOf",
      insurance: "q11_doYou",
      // hidden fields the SITE fills automatically from cart + calendar:
      gear:      "q12_gear",
      dates:     "q13_rentalDates",
      days:      "q14_rentalDays",
      total:     "q15_estimatedTotal",
      // Real Date field (q16_date) for the Google Calendar integration; the site
      // posts q16_date[month]/[day]/[year] from the shoot start date.
      shootDateField: "q16_date"
    },
    // Visible questions, rendered in the site's own style.
    // Add a question: add an entry here + a matching line in `fields` above.
    // types: "text" | "email" | "url" | "yesno"    half:true = sit side-by-side
    render: [
      { key: "firstName", label: "First name",                       type: "text",  required: true,  half: true },
      { key: "lastName",  label: "Last name",                        type: "text",  required: true,  half: true },
      { key: "email",     label: "Contact email",                    type: "email", required: true },
      { key: "film",      label: "Name of your film / project",      type: "text",  required: true },
      { key: "insurance", label: "Do you have production insurance?", type: "yesno", required: true }
      // EXAMPLE — to ask for a screenplay link: add the field in Jotform, add
      // screenplay: "q16_screenplay" to `fields`, then uncomment:
      // ,{ key: "screenplay", label: "Link to your screenplay (optional)", type: "url", required: false }
    ]
  },

  /* ---- Crew-your-shoot inquiry (opens from the home page) ---------------- */
  crewInquiry: {
    formId: "261816743694064",
    fields: {
      firstName: "q18_firstName",
      lastName:  "q19_lastName",
      email:     "q20_contactEmail",
      roles:     "q12_rolesNeeded",
      people:    "q13_handledBy",
      dates:     "q14_shootDates",
      insurance: "q15_doYou",
      budget:    "q16_budget",
      notes:     "q17_aboutYour"
    }
  }
};
