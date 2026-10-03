/**
 * Legal content — the platform core of the privacy policy and the terms.
 *
 * Why this is structured data rather than dictionary keys. The dictionary is
 * already at its size limit, and a policy that names its sub-processors runs to
 * several hundred words per locale. More importantly, a policy is *prose with
 * headings and a table*, not a set of UI labels: modelling it as flat
 * `{key: string}` pairs would throw away the structure that makes it readable.
 *
 * The split that matters for an unknown subject. Everything below is fixed by
 * the code, not by what the product is about: authentication, cookies, the
 * sub-processor table, retention, rights, transfers. That part is written once
 * and does not change when the product's subject does.
 *
 * Sections flagged `subject: true` describe the domain — what a "post" is, which
 * fields a profile has. They are written as honest placeholders that state the
 * gap rather than inventing detail, because a policy that quietly omits what it
 * collects is worse than one that admits it is incomplete.
 *
 * Not legal advice. A policy this shape should be reviewed before it handles
 * real personal data.
 */

import type { LegalBundle } from "./types";

/* -------------------------------------------------------------------------- */
/* English                                                                     */
/* -------------------------------------------------------------------------- */

const en: LegalBundle = {
  documents: {
    privacy: {
      slug: "privacy",
      updated: "2026-10-03",
      intro:
        "This policy explains what personal data this application collects, why, who else sees it, and what you can do about it. It is written to be read: if anything here is unclear or wrong, that is a bug worth reporting rather than a detail to overlook.",
      sections: [
        {
          id: "controller",
          title: "Who is responsible for your data",
          paragraphs: [
            "This deployment is operated for the 24H by Webcup hackathon as a demonstration application. The operator is the team that deployed it; their contact details are the ones published with the submission.",
            "For the purposes of the GDPR, the operator of this instance acts as the data controller for the personal data described below.",
          ],
        },
        {
          id: "what-we-collect",
          title: "What we collect",
          paragraphs: [
            "We collect only what the application needs to function. The categories are fixed by the code, not by how you use it.",
          ],
          rows: [
            ["Account data", "Email address, display name, username, optional biography, optional date of birth, and a hashed password. Your date of birth is stored encrypted."],
            ["Authentication data", "Session tokens, device records for two-factor authentication, and email verification state."],
            ["Content you post", "Posts, comments, reactions, messages, group posts, page content, poll votes and the media you upload. **Direct messages and dates of birth are stored encrypted**; the rest is stored as you wrote it."],
            ["Technical data", "IP address of each request, the user agent, and server logs including timestamps, routes and response codes."],
            ["Derived data", "Your location as a map point when you tag a place. Your IP address is used to apply rate limits and to detect abuse; it is not resolved to a country or a network by this application."],
          ],
        },
        {
          id: "legal-basis",
          title: "Why we are allowed to process it",
          paragraphs: [
            "Under the GDPR we must have a lawful basis for each purpose, rather than a general interest in running a service.",
          ],
          bullets: [
            "**Contract** — the account, authentication and content you create, because the application cannot function without it.",
            "**Legitimate interests** — security logging, rate limiting and abuse prevention, balanced against your interest in the service being available.",
            "**Consent** — optional analytics, and anything we have not otherwise committed to. You can withdraw it at any time.",
            "**Legal obligation** — retention of an audit trail where the platform's moderation obligations require it.",
          ],
        },
        {
          id: "processors",
          title: "Who else receives your data",
          paragraphs: [
            "We use third-party processors. Each one is listed here with what it actually receives, because \"we share data with partners\" tells you nothing you can act on. A processor acts on our instructions and may not use your data for its own purposes.",
          ],
          rows: [
            ["AI inference — OpenRouter / Poolside AI", "**The content of messages you send to the assistant**, plus the system prompt. Transmitted to produce a reply. Do not send anything you would not want to leave the deployment. The provider is configurable; the vendor named here is what this deployment uses."],
            ["Transactional email — Resend, or your SMTP host", "Your email address and the content of notifications, verification and password-reset messages."],
            ["Breached-password check — Have I Been Pwned", "The first five characters of a SHA-1 hash of your password, never the password and never the rest of the hash. Used at sign-up and on password change to refuse a password that appears in a known breach corpus. Because only the prefix leaves the server, it cannot be used to recover your password."],
            ["Geocoding — OpenStreetMap Nominatim", "Search terms you type into place search, and coordinates when you resolve a place to an address."],
            ["Map tiles — OpenStreetMap tile CDN", "Your IP address, as part of fetching map imagery."],
            ["OAuth identity — Google, GitHub", "Your identity, if you choose to sign in with one of these instead of a password."],
            ["Database — MariaDB", "Everything, encrypted at rest for the fields listed above. Held on infrastructure in the European Union."],
            ["Application hosting — cPanel with Passenger", "Everything, in transit and in server logs, as part of serving the application."],
          ],
        },
        {
          id: "transfers",
          title: "Where your data is held",
          paragraphs: [
            "The database and application hosting are provided by the deployment host. Some processors listed above are established outside the European Union, in particular the AI inference and email providers. Where data leaves the EEA, we rely on an adequacy decision or on standard contractual clauses, and we limit what is transferred to what the feature strictly requires.",
          ],
        },
        {
          id: "retention",
          title: "How long we keep it",
          paragraphs: [
            "Keeping data forever is not a policy, it is an oversight. The periods below are the defaults; shorter is better where a shorter period is defensible.",
          ],
          rows: [
            ["Account data", "For the life of the account, then deleted or anonymised within 30 days of closure."],
            ["Messages and private content", "Until you delete them, or until the account is closed."],
            ["Server and access logs", "30 days, then deleted."],
            ["Audit trail", "12 months, to evidence moderation decisions and platform integrity."],
            ["Uploaded media", "Until you delete it, or until the account is closed."],
            ["Rate-limit counters", "Minutes, not months. They exist to slow abuse, not to build a profile."],
          ],
        },
        {
          id: "rights",
          title: "Your rights",
          paragraphs: [
            "You can exercise any of these without giving a reason and without being charged for it. In practice, most of them are already available to you without contacting anyone.",
          ],
          bullets: [
            "**Access** — see your profile settings.",
            "**Rectification** — edit your profile, biography and date of birth in settings.",
            "**Erasure** — delete your posts and messages; close your account for the rest.",
            "**Portability** — export the content you created through the interface provided.",
            "**Objection and restriction** — for processing based on legitimate interests, including profiling.",
            "**Withdraw consent** — for anything that was optional and consent-based.",
          ],
        },
        {
          id: "supervisory-authority",
          title: "Complaints",
          paragraphs: [
            "If you believe your rights have not been respected, you may complain to your national data protection authority. In France that is the CNIL; in Madagascar, the CMIL. We would rather hear from you directly first, but you are not required to.",
          ],
        },
        {
          id: "security",
          title: "How we protect your data",
          paragraphs: [
            "Passwords are hashed with Argon2id. Direct messages and dates of birth are encrypted at rest with AES-256-GCM, each value with its own initialisation vector, so a stolen database dump is not a readable transcript of everyone's conversations. Notification texts are stored in the clear, so we are stating that here rather than implying a protection that does not exist. Sessions are HTTP-only and SameSite cookies. Data in transit is HTTPS-only, with HSTS and no mixed content. State-changing requests are checked against a trusted-origin list, so a third-party page cannot submit forms on your behalf.",
          ],
        },
        {
          id: "subject-specific",
          title: "What is specific to this application",
          paragraphs: [
            "This section describes the data this particular application collects because of what it is about. It is marked as incomplete on purpose.",
          ],
          subject: true,
          bullets: [
            "The content and structure of the subject domain are not yet finalised. The categories listed under \"What we collect\" above are the platform's, and are accurate.",
            "Before this application handles real personal data, this section must name: the domain entities and their fields, any additional third parties the subject introduces, and any special-category data that could be involved.",
          ],
        },
        {
          id: "changes",
          title: "Changes to this policy",
          paragraphs: [
            "We will post the new version here and update the date at the top. Material changes — a new processor, a new category of data, a new purpose — will be called out rather than folded silently into the text.",
          ],
        },
      ],
    },
    terms: {
      slug: "terms",
      updated: "2026-10-03",
      intro:
        "These terms describe what you can expect from this application and what is expected of you. They are written plainly because a term nobody understands is not a term anybody can follow.",
      sections: [
        {
          id: "acceptance",
          title: "Accepting these terms",
          paragraphs: [
            "By creating an account or using this deployment you accept these terms. If you do not accept them, do not create an account.",
          ],
        },
        {
          id: "nature",
          title: "What this service is",
          paragraphs: [
            "This is a demonstration application deployed for a hackathon. It is provided as-is, with no guarantee of availability, no service level, and no commitment to keep operating after the event.",
          ],
        },
        {
          id: "accounts",
          title: "Your account",
          paragraphs: [
            "You are responsible for what happens under your account, including keeping your password to yourself and enabling two-factor authentication. You must be old enough to consent to the processing of your data under the applicable law where you live.",
            "One person, one account. Creating additional accounts to evade a limit, a ban or a suspension is a breach of these terms.",
          ],
        },
        {
          id: "content",
          title: "Your content",
          paragraphs: [
            "You keep ownership of what you post. You grant the operator a non-exclusive, worldwide, royalty-free licence to host, copy and display it for the purpose of operating the service — including the backups and the moderation that keeping the service safe requires.",
            "Do not post content you do not have the right to post, or content that is unlawful, that infringes someone else's rights, or that is deliberately built to harm.",
          ],
        },
        {
          id: "conduct",
          title: "Acceptable use",
          paragraphs: [
            "You agree not to: attempt to gain access to accounts or data that are not yours; probe, scan or load-test the infrastructure beyond what ordinary use of the application requires; circumvent rate limits, suspensions or bans; scrape or harvest content for a purpose outside the service; or use the application to distribute malware or to harass other people.",
            "Automated access that competes with the service, and any attempt to make the deployment unavailable to others, will be met with suspension and, where appropriate, with a report to the relevant authority.",
          ],
        },
        {
          id: "moderation",
          title: "Moderation",
          paragraphs: [
            "The operator may remove content, restrict visibility, suspend accounts and retain an audit trail of those decisions. Removal is not a judgement about you; it is a decision about whether the content can stay up.",
            "You may report content you believe breaches these terms. Reported messages are decrypted for the moderator reviewing them, which is why this service is not end-to-end encrypted: moderation of reported content requires the server to be able to read it.",
          ],
        },
        {
          id: "liability",
          title: "Liability and availability",
          paragraphs: [
            "The service is provided as-is, without warranty of any kind, to the fullest extent the law permits. The operator is not liable for indirect or consequential loss, including lost data, lost profits or service interruption.",
            "Because this is a hackathon deployment on shared hosting, expect it to be slow or briefly unavailable. That is a property of the environment, not a promise we have broken.",
          ],
        },
        {
          id: "ip",
          title: "Intellectual property",
          paragraphs: [
            "The application code is the operator's. Content you post remains yours. Third-party names appearing in the application — including open-source libraries used to build it — remain the property of their respective owners.",
          ],
        },
        {
          id: "governing-law",
          title: "Governing law and jurisdiction",
          paragraphs: [
            "These terms are governed by French law. The courts of France have jurisdiction over any dispute, without prejudice to mandatory consumer protections that may apply where you live.",
          ],
        },
        {
          id: "changes",
          title: "Changes",
          paragraphs: [
            "We may update these terms. The date at the top always reflects the current version. Continuing to use the service after a change means you accept the updated terms.",
          ],
        },
      ],
    },
  },
};

export default en;
