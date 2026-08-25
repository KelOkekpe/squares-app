import React from "react";
import { LegalPage } from "./LegalPage";
import { OPERATOR_NAME, OPERATOR_STATE, SUPPORT_EMAIL } from "../../utils";

/**
 * Terms of Service.
 *
 * The section that matters most is 4: SquarePool sells organiser software and
 * never touches the pot. Entry fees and prizes move directly between the
 * organiser and their players, and the platform takes no cut of them. That
 * distinction is what separates this from operating a betting service, so it
 * is stated plainly rather than buried in a definitions clause.
 */
export function TermsPage({ onBack }) {
  const sections = [
    {
      h: "What SquarePool is",
      p: [
        `SquarePool is software for running football squares boards and pick'em contests inside a private group — a family, an office, a group of friends. ${OPERATOR_NAME} ("we", "us") provides the tools that draw the grid, track entries, pull scores and work out who won.`,
        'We are not a party to your contest. We do not organise it, set its rules, collect its money, hold its money, or pay it out. The person who creates a board (the "organiser") does all of that, and does it directly with the people who join.',
      ],
      note: "In short: we sell the scoreboard, not the game. Every dollar your players put in goes straight to your organiser and never through us.",
    },
    {
      h: "Who may use it",
      p: [
        "You must be at least 18 years old to use SquarePool, and older where the law that applies to you sets a higher minimum for contests involving money. By using the service you confirm that you meet that requirement.",
        "Laws on contests of this kind vary by state and by country, and some prohibit them outright. You are responsible for knowing and following the law that applies where you are. Do not use SquarePool for anything it does not allow.",
      ],
      note: "We do not give legal advice and cannot tell you whether your particular pool is lawful where you live. If you are unsure, ask a lawyer in your state before you collect a dollar.",
    },
    {
      h: "Accounts",
      p: [
        "Organisers need an account. Keep your password to yourself, use an address you actually read, and tell us at once if you think someone else has got in. You are responsible for what happens under your account.",
        "Players do not need an account. Joining a board asks only for the details the organiser needs in order to identify you and pay you.",
        "We may suspend or close an account that breaks these terms, that is used for something unlawful, or that puts other users at risk.",
      ],
    },
    {
      h: "Money: what we charge, and what we never touch",
      p: [
        "We charge organisers a one-time fee to activate a board. The amount is shown before you pay and is handled by Stripe. That fee is the only money SquarePool collects from anyone.",
        "Entry fees and prizes are not our business and never pass through our systems. Players pay their organiser directly — by Venmo, Cash App, PayPal, Zelle, cash, or whatever the two of you agree. Organisers pay winners the same way. We never hold, escrow, transmit, invest or insure those funds, and we take no percentage of any pot.",
        "Because the money never reaches us, we cannot refund an entry fee, reverse a payment, recover a prize that went unpaid, or settle an argument about who owed what. Those are matters between an organiser and their players.",
      ],
      note: "The payment buttons in a board build a link into your own payment app using handles the organiser typed in. They are a shortcut for a payment you are making yourself — not a transaction we process, verify or stand behind.",
    },
    {
      h: "If you organise a board",
      p: ["Creating a board makes you responsible for running it honestly. That means:"],
      ul: [
        "Setting the entry fee, the prize split and the rules, and telling your players what they are before they pay.",
        "Collecting entry fees, confirming that each payment actually arrived, and marking entries paid only when they have.",
        "Paying out every winner in full, on time, from the money you collected.",
        "Making sure your pool is lawful where you and your players are.",
        "Handling questions and disputes from your own players — they are your participants, not our customers.",
      ],
      note: "You agree to cover us for any claim, loss or cost that arises out of a board you ran — including a dispute with one of your players or a claim that your pool broke the law.",
    },
    {
      h: "If you join a board",
      p: [
        "Your agreement about money is with the organiser who invited you, not with SquarePool. They decide the fee, hold the funds and pay the winners.",
        "Before you pay anyone, satisfy yourself that you know and trust them. If an organiser does not pay you what you are owed, we have no ability to make them — we never had the money.",
        "What you submit should be truthful. Do not enter under someone else's name or claim squares you have not paid for.",
      ],
    },
    {
      h: "Scores and results",
      p: [
        "Live scores come from third-party feeds. They can lag, correct themselves, or be wrong, and games get postponed and rescheduled. We show them in good faith but do not warrant that they are accurate or timely.",
        "Where a feed and reality disagree, the organiser decides the result of their own board. Do not treat what SquarePool displays as the final word on who won.",
      ],
    },
    {
      h: "Acceptable use",
      p: ["Do not use SquarePool to:"],
      ul: [
        "Run anything unlawful where you or your participants are, or operate as a bookmaker or a commercial betting service.",
        "Take part in someone else's board without their organiser's invitation, or try to reach data from a board you were not invited to.",
        "Probe, scrape, overload or interfere with the service, or work around its access controls or limits.",
        "Impersonate anyone, or submit entries in a name that is not yours.",
      ],
    },
    {
      h: "The service is offered as-is",
      p: [
        "SquarePool is provided as-is and as-available, without warranties of any kind, express or implied, including merchantability, fitness for a particular purpose and non-infringement. We do not promise that it will be uninterrupted, error-free, or that any board, entry or result will be preserved.",
        "The service is early software under active development. Features may change or disappear, and we may add, alter or stop offering it at any time.",
      ],
      note: "During this early-access period we may reset test data. Do not run a board that matters to you on a version we have told you is a test, and keep your own record of who paid what.",
    },
    {
      h: "Limitation of liability",
      p: [
        "To the fullest extent the law allows, we are not liable for indirect, incidental, special, consequential or punitive damages, or for lost profits, lost data, or money lost in a pool — including entry fees paid to an organiser and prizes an organiser failed to pay.",
        `Our total liability for any claim relating to SquarePool is limited to the amount you actually paid ${OPERATOR_NAME} in the twelve months before the claim arose.`,
        "Some states do not allow certain limitations, so parts of this section may not apply to you.",
      ],
    },
    {
      h: "Ending it",
      p: [
        "You may stop using SquarePool at any time. Write to us to have your account and data removed.",
        "We may suspend or end your access if you break these terms or if we stop offering the service. The sections on money, disclaimers, liability and governing law survive.",
      ],
    },
    {
      h: "Changes to these terms",
      p: [
        "We may update these terms as the service changes. The date at the top shows when they last moved. If a change materially affects your rights we will make a reasonable effort to tell organisers by email before it takes effect, and continuing to use SquarePool after that means you accept the new version.",
      ],
    },
    {
      h: "Governing law",
      p: [
        `These terms are governed by the laws of the State of ${OPERATOR_STATE}, without regard to its conflict-of-laws rules. Any dispute will be brought in the state or federal courts located in ${OPERATOR_STATE}, and you and we each consent to that venue.`,
      ],
    },
    {
      h: "Contact",
      p: [`Questions about these terms go to ${SUPPORT_EMAIL}, and we read every one.`],
    },
  ];

  return (
    <LegalPage
      title="Terms of Service"
      intro={[
        `These terms are the agreement between you and ${OPERATOR_NAME} for using SquarePool. They are written to be read, so please read them — particularly section 4, which explains that we never handle the money in your pool.`,
      ]}
      sections={sections}
      onBack={onBack}
    />
  );
}
