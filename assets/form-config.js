/* ============================================================================
   RARE POND RENTALS - JOTFORM FORM MAP
   ----------------------------------------------------------------------------
   This is the ONLY file you edit to change how the on-site forms talk to
   Jotform. Full instructions live in README.md → "Maintaining the forms".

   Quick version:
     1. In Jotform, add/rename your field. Copy its INPUT NAME
        (Jotform → Publish → Embed → "Source Code"; each input looks like
         name="q11_insurance"). The number is stable - reordering fields in
        Jotform does NOT change it.
     2. Add/adjust the mapping in `fields` below (siteKey: "jotformInputName").
     3. To make a NEW question actually appear on the site, also add a line to
        the `render` list (label + type). Standard types render automatically
        in the site's styling - no other code needed.
     4. Open  /form-check.html  to confirm everything is mapped, then submit
        one test entry and check it lands complete in your Jotform inbox.
   ============================================================================ */

window.FORMS = {

  /* ---- Website quote (cart "Download a quote", 2026-10-30) ----------------
     Jotform "Rare Pond Rentals: Website Quote". Posted in the background when someone downloads a quote PDF;
     bts-automation/rentals_quotes.py makes the quote row + HubSpot contact + deal at Quote Sent (no gear held).
     Input names read off the live form (the Jotform builder named them). */
  rentalQuote: {
    formId: "263026456977064",
    fields: {
      quoteNumber: "q2_q2_textbox0", firstName: "q3_q3_textbox1", lastName: "q4_q4_textbox2", email: "q5_q5_email3",
      phone: "q6_q6_textbox4", project: "q7_q7_textbox5", company: "q8_q8_textbox6", startDate: "q9_q9_textbox7",
      endDate: "q10_q10_textbox8", total: "q11_q11_textbox9", gear: "q12_q12_textarea10", data: "q13_q13_textarea11"
    }
  },

  /* ---- Rental quote request (opens from the cart) ------------------------ */
  rentalRequest: {
    formId: "261817432074052",
    // siteKey  ->  Jotform input name
    fields: {
      firstName: "q7_firstName",
      lastName:  "q8_lastName",
      email:     "q9_contactEmail",
      phone:     "q22_phone",   // required on the site (2026-10-24); also sent as p: in orderData
      film:      "q10_nameOf",
      insurance: "q11_doYou",
      // hidden fields the SITE fills automatically from cart + calendar:
      gear:      "q12_gear",
      // #7 Option A - single machine-readable order payload for auto-creating bookings.
      // The site fills this with "s:<startISO>|e:<endISO>|p:<phone>|i:<supabaseItemId>:<qty>,..." on submit
    // (p: added 2026-10-24; rentals_mail.py reads it into orders.client_phone).
      // SETUP (one-time): add a hidden Short-Text field in Jotform, map it to a HubSpot deal property
      // named "rp_order_data", then replace the value below with that field's REAL input name
      // (Jotform -> Publish -> Source Code -> name="qNN_..."). Supabase RPC hubspot_sync_order parses it.
      orderData: "q21_orderData",
      dates:     "q13_rentalDates",
      days:      "q14_rentalDays",
      total:     "q15_estimatedTotal",
      // Real Date field (q16_date) for the Google Calendar integration; the site
      // posts q16_date[month]/[day]/[year] from the shoot start date.
      shootDateField: "q16_date",
      // Return date field (q20_date20) for the rental RETURN Google Calendar event.
      returnDateField: "q20_date20",
      // Composed HubSpot deal name, e.g. "Rental: {project}" (site-filled).
      dealName: "q19_dealName"
    },
    // Visible questions, rendered in the site's own style.
    // Add a question: add an entry here + a matching line in `fields` above.
    // types: "text" | "email" | "url" | "yesno"    half:true = sit side-by-side
    render: [
      { key: "firstName", label: "First name",                       type: "text",  required: true,  half: true },
      { key: "lastName",  label: "Last name",                        type: "text",  required: true,  half: true },
      { key: "email",     label: "Contact email",                    type: "email", required: true,  half: true },
      { key: "phone",     label: "Phone",                            type: "tel",   required: true,  half: true },
      { key: "film",      label: "Name of your film / project",      type: "text",  required: true },
      { key: "insurance", label: "Do you have production insurance?", type: "yesno", required: true }
      // EXAMPLE - to ask for a screenplay link: add the field in Jotform, add
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
      email:     "q20_email",
      roles:     "q12_roles",
      people:    "q13_assignedTo",
      dates:     "q14_dates",
      insurance: "q15_insurance",
      budget:    "q16_budget",
      notes:     "q17_notes",
      project:   "q21_projectName",
      // Composed HubSpot deal name, e.g. "Crew: {project} ({roles})" (site-filled).
      dealName:  "q22_dealName",
      // Shoot start/end -> Google Calendar all-day span; parsed budget -> HubSpot deal Amount.
      shootDateField: "q23_date",
      crewEndField:   "q24_date24",
      budgetAmount:   "q25_typeA"
    }
  }
};
