/**
 * Copy for the transactional emails, in the two product languages.
 *
 * This is deliberately a separate dictionary from `src/lib/i18n/dictionaries`.
 * `emails/` is rendered outside Next — by the mailer at runtime and by the
 * React Email dev server during review — so it stays dependency-free and cannot
 * accidentally pull a server-only module into a template. `EmailLocale` mirrors
 * `Locale` in `@/lib/i18n/config`; the two unions are structurally identical, so
 * a `Locale` flows in without a cast, but a change to the app's locale list must
 * be made here too.
 *
 * French is the default because the jury is francophone, exactly as in the app.
 */

export const EMAIL_LOCALES = ["fr", "en"] as const;

export type EmailLocale = (typeof EMAIL_LOCALES)[number];

export const DEFAULT_EMAIL_LOCALE: EmailLocale = "fr";

export function isEmailLocale(value: unknown): value is EmailLocale {
  return typeof value === "string" && (EMAIL_LOCALES as readonly string[]).includes(value);
}

const fr = {
  "mail.brand": "Bubble",
  "mail.tagline": "Le portail des habitants",
  "mail.footer_reason": "Ceci est un message automatique de",
  "mail.footer_ignore":
    "Si vous n'attendiez pas ce message, vous pouvez l'ignorer sans conséquence.",

  "mail.welcome.preview": "Votre compte Bubble est prêt",
  "mail.welcome.heading": "Bienvenue sur Bubble, {name}",
  "mail.welcome.lead": "Votre compte est créé. Voici ce que la ville met à votre disposition.",
  "mail.welcome.step1": "Parcourez les services municipaux : horaires, contacts et marche à suivre, service par service.",
  "mail.welcome.step2": "Suivez les annonces de la ville et vos démarches en cours depuis votre espace.",
  "mail.welcome.step3": "Contactez les services et suivez votre demande jusqu'à la réponse, avec une référence TN.",
  "mail.welcome.cta": "Ouvrir mon espace",
  "mail.welcome.reason": "Vous recevez ce message parce que vous venez de créer un compte.",

  "mail.verify.preview": "Confirmez votre adresse pour activer votre compte",
  "mail.verify.heading": "Confirmez votre adresse, {name}",
  "mail.verify.lead": "Une dernière étape avant d'accéder à votre espace et de déposer une demande.",
  "mail.verify.constraint": "Ce lien expire dans {minutes} minutes et ne fonctionne qu'une seule fois.",
  "mail.verify.cta": "Vérifier mon adresse",
  "mail.verify.reason": "Vous n'êtes pas à l'origine de cette inscription ? Ignorez ce message.",

  "mail.reset.preview": "Réinitialisez votre mot de passe",
  "mail.reset.heading": "Réinitialisez votre mot de passe, {name}",
  "mail.reset.lead": "Une réinitialisation a été demandée pour votre compte Bubble.",
  "mail.reset.constraint":
    "Ce lien expire dans {minutes} minutes, ne fonctionne qu'une seule fois et déconnecte vos autres appareils.",
  "mail.reset.cta": "Choisir un nouveau mot de passe",
  "mail.reset.reason":
    "Ce n'est pas vous ? Votre mot de passe reste inchangé et ce lien expirera de lui-même.",

  "mail.notification.greeting": "Bonjour {name},",
  "mail.notification.cta": "Ouvrir dans Bubble",
  "mail.notification.reason":
    "Vous recevez cet e-mail car les notifications par e-mail sont activées dans les réglages de votre compte.",
  "mail.notification.manage": "Gérer mes notifications",

  "mail.action.fallback": "Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :",
  "mail.action.fallback_short": "Ou copiez cette adresse :",

  // Subjects. Localised too: a French subject on an English message is the first
  // thing that tells a recipient the translation was an afterthought.
  "mail.subject.verify": "Confirmez votre adresse e-mail",
  "mail.subject.reset": "Réinitialisez votre mot de passe",
  // The subject is prefixed with "[Bubble]" in transactional.tsx, so the brand
  // name is not repeated here — "[Bubble] Votre compte Bubble est prêt" would
  // read twice.
  "mail.subject.welcome": "Votre compte est prêt",
} as const;

const en: Record<keyof typeof fr, string> = {
  "mail.brand": "Bubble",
  "mail.tagline": "The residents' portal",
  "mail.footer_reason": "This is an automated message from",
  "mail.footer_ignore": "If you were not expecting this message, you can safely ignore it.",

  "mail.welcome.preview": "Your Bubble account is ready",
  "mail.welcome.heading": "Welcome to Bubble, {name}",
  "mail.welcome.lead": "Your account is created. Here is what the city has put at your disposal.",
  "mail.welcome.step1":
    "Browse the city services: opening hours, contacts and the steps to follow, service by service.",
  "mail.welcome.step2": "Follow the city announcements and your current requests from your space.",
  "mail.welcome.step3":
    "Contact the city services and follow your request through to its answer, with a TN reference.",
  "mail.welcome.cta": "Open my space",
  "mail.welcome.reason": "You are receiving this message because you just created an account.",

  "mail.verify.preview": "Confirm your address to activate your account",
  "mail.verify.heading": "Confirm your address, {name}",
  "mail.verify.lead": "One last step before you can use your space and file a request.",
  "mail.verify.constraint": "This link expires in {minutes} minutes and can only be used once.",
  "mail.verify.cta": "Confirm my address",
  "mail.verify.reason": "You did not sign up for this? Ignore this message.",

  "mail.reset.preview": "Reset your password",
  "mail.reset.heading": "Reset your password, {name}",
  "mail.reset.lead": "A password reset was requested for your Bubble account.",
  "mail.reset.constraint":
    "This link expires in {minutes} minutes, can only be used once, and signs out your other devices.",
  "mail.reset.cta": "Choose a new password",
  "mail.reset.reason":
    "This wasn't you? Your password stays unchanged and this link will expire on its own.",

  "mail.notification.greeting": "Hello {name},",
  "mail.notification.cta": "Open in Bubble",
  "mail.notification.reason":
    "You are receiving this email because email notifications are enabled in your account settings.",
  "mail.notification.manage": "Manage my notifications",

  "mail.action.fallback": "The button does not work? Copy this address into your browser:",
  "mail.action.fallback_short": "Or copy this address:",

  "mail.subject.verify": "Confirm your email address",
  "mail.subject.reset": "Reset your password",
  "mail.subject.welcome": "Your account is ready",
};

export type MailKey = keyof typeof fr;

export type MailParams = Record<string, string | number>;

const dictionaries: Record<EmailLocale, Record<MailKey, string>> = { fr, en };

/**
 * Unknown placeholders are left intact rather than replaced with `undefined`,
 * matching the app's translator: a missing parameter must be visible in the
 * inbox rather than silently render "undefined" to a resident.
 */
export function interpolate(template: string, params?: MailParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in params ? String(params[key]) : match,
  );
}

/** A translator bound to one language. Unknown keys render as the key itself. */
export function createMailTranslator(locale: EmailLocale) {
  const dictionary = dictionaries[locale] ?? dictionaries[DEFAULT_EMAIL_LOCALE];
  return (key: MailKey, params?: MailParams): string => interpolate(dictionary[key] ?? key, params);
}

export type MailTranslator = ReturnType<typeof createMailTranslator>;