import React from "react";
import { LegalPage } from "./LegalPage";
import { OPERATOR_NAME, SUPPORT_EMAIL } from "../../utils";

/**
 * Privacy Policy.
 *
 * Every claim here was checked against the code rather than adapted from a
 * template — there are no analytics libraries in the bundle, phone numbers were
 * dropped from both contact tables, and contact details are deliberately kept
 * out of the board data players can read. A policy that overstates what we
 * collect is as wrong as one that understates it.
 */
export function PrivacyPage({ onBack }) {
  const sections = [
    {
      h: "The short version",
      p: [
        "We collect what a pool needs to work: who you are, how to reach you, how to pay you, and what you picked. Nothing else.",
        "There are no analytics scripts, no advertising trackers and no third-party cookies anywhere in SquarePool. We have never sold personal information and have no plans to.",
      ],
    },
    {
      h: "What we collect from organisers",
      ul: [
        "Your email address and a password, held by our authentication provider. We never see the password itself.",
        "The boards you create and their settings — team names, entry fee, prize split, deadlines.",
        "The payment handles you choose to publish to your players, such as a Venmo username.",
        "A record of your board purchase from Stripe. We store a payment reference, never card details.",
      ],
    },
    {
      h: "What we collect from players",
      ul: [
        "Your name, as you enter it, so the organiser and other players can see whose squares are whose.",
        "Your email address, which is required — it is how a board confirms your entry and sends your ticket.",
        "How you would like to be paid if you win: a method, and the handle you type for it.",
        "Your entry itself — the squares you asked for or the picks you made, and when you submitted them.",
      ],
      note: "We no longer ask for or store phone numbers anywhere in SquarePool. The columns that once held them have been dropped.",
    },
    {
      h: "What we never collect",
      ul: [
        "Card numbers or bank details. Board payments go through Stripe and never touch our servers; entry fees never come near us at all.",
        "Your location, your contacts, or any advertising identifier.",
        "Anything from analytics, attribution or session-recording tools — we do not use any.",
      ],
    },
    {
      h: "How we use it",
      p: ["Only to run the thing you asked us to run:"],
      ul: [
        "Showing a board to the people in it, and working out who won.",
        "Emailing you your ticket, your confirmation and the occasional message about your board.",
        "Letting an organiser confirm that a payment arrived, and see how to pay a winner.",
        "Keeping the service up and stopping abuse — for example, we store a one-way hash of an email address to limit how many entries can be submitted from it in an hour. The hash cannot be turned back into your address.",
      ],
      note: "We do not use your information to advertise to you, and we do not sell or rent it. We share it only with the providers listed below, or if the law genuinely requires it.",
    },
    {
      h: "Who can see what",
      p: [
        "Inside a board, the other people in it can see your name and the squares or picks attached to it. That is the point of a shared board.",
        "Your contact details are not part of that. Email addresses and payout handles are visible only to the organiser of the board you joined, and are deliberately kept out of the board data other players can read.",
        "Pick'em selections stay hidden from other players until the first game kicks off, so nobody can copy your sheet before the deadline.",
      ],
    },
    {
      h: "Who we share it with",
      p: ["The service runs on a small number of providers, each handling one job:"],
      ul: [
        "Supabase — the database and organiser sign-in.",
        "Vercel — hosting and the server functions, which keep standard request logs.",
        "Stripe — the organiser's board payment. Stripe handles the card and gives us back a reference.",
        "Resend — sending your ticket and confirmation emails.",
        "ESPN — where live scores come from. We send them nothing about you.",
      ],
    },
    {
      h: "What is stored on your device",
      p: [
        "SquarePool uses your browser's local storage rather than tracking cookies. It holds your colour-theme choice, the details you last entered so a second board does not make you retype them, and a copy of your own submitted sheet so you can see it before picks open.",
        "That is on your device and readable only by this site. Clearing your browser storage removes all of it. Organisers additionally hold a sign-in token so they stay logged in.",
      ],
    },
    {
      h: "How long we keep it",
      p: [
        "Board data stays while the board does, so results and history remain viewable after a season ends. Organiser accounts persist until you ask us to remove them.",
        "Write to us and we will delete your account, your entries and your contact details. Deleting a player's contact details may leave the entry itself on the board as an unnamed square, because removing it would change a result other people relied on.",
      ],
    },
    {
      h: "Your rights",
      p: [
        `Wherever you live, you can ask us what we hold about you, ask for a copy, ask us to correct it, or ask us to delete it. Email ${SUPPORT_EMAIL} and we will act on it. We will not treat you differently for asking.`,
        "If you are in California, the EEA or the UK, you have these rights by statute, and we honour them for everyone regardless.",
      ],
    },
    {
      h: "Security",
      p: [
        "Traffic runs over HTTPS. Access to board data is enforced in the database itself rather than only in the app, so a player's browser cannot read a board it was not invited to. Players submit entries through controlled server functions and are never given direct write access to the database.",
        "No system is perfect, and we cannot promise absolute security. If we ever discover a breach affecting your information, we will tell you.",
      ],
    },
    {
      h: "Children",
      p: [
        "SquarePool is not for anyone under 18, and we do not knowingly collect information from children. If you believe a child has given us information, write to us and we will remove it.",
      ],
    },
    {
      h: "Changes",
      p: [
        "If this policy changes, the date at the top changes with it. If a change materially affects how we handle information we already hold, we will tell organisers by email first.",
      ],
    },
    {
      h: "Contact",
      p: [
        `${OPERATOR_NAME} — ${SUPPORT_EMAIL}. Privacy questions and deletion requests go to the same place, and a person reads them.`,
      ],
    },
  ];

  return (
    <LegalPage
      title="Privacy Policy"
      intro={[
        `SquarePool is operated by ${OPERATOR_NAME}. This explains what we collect, why, and who else ever sees it. It describes what the software actually does today, not what a template says it might.`,
      ]}
      sections={sections}
      onBack={onBack}
    />
  );
}
