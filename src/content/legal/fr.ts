/**
 * Politique de confidentialité et conditions d'utilisation — version française.
 *
 * Traduction de `src/content/legal/en.ts`. Les deux fichiers exposent la même
 * forme : `LegalBundle`. La structure vit dans des données et non dans les
 * dictionnaires d'interface, parce qu'une politique qui nomme ses
 * sous-traitants tient en plusieurs centaines de mots par langue, et parce
 * qu'elle est une prose à titres et tableau, pas un jeu d'étiquettes.
 *
 * Les sections marquées `subject: true` décrivent le domaine applicatif. Elles
 * sont rédigées comme des emplacements honnêtes qui disent ce qui manque,
 * plutôt que d'inventer un détail.
 *
 * Ce document ne constitue pas un avis juridique.
 */

import type { LegalBundle } from "./types";

const fr: LegalBundle = {
  documents: {
    privacy: {
      slug: "privacy",
      updated: "2026-10-03",
      intro:
        "Cette politique explique quelles données personnelles cette application collecte, pourquoi, qui d'autre y a accès, et ce que vous pouvez faire. Elle est rédigée pour être lue : si quelque chose y est obscur ou faux, c'est un défaut qu'il vaut mieux signaler que passer sous silence.",
      sections: [
        {
          id: "controller",
          title: "Qui est responsable de vos données",
          paragraphs: [
            "Ce déploiement est exploité pour le hackathon 24H by Webcup en tant qu'application de démonstration. L'exploitant est l'équipe qui l'a déployé ; ses coordonnées sont celles publiées avec la soumission.",
            "Au sens du RGPD, l'exploitant de cette instance agit comme responsable de traitement pour les données personnelles décrites ci-dessous.",
          ],
        },
        {
          id: "what-we-collect",
          title: "Ce que nous collectons",
          paragraphs: [
            "Nous ne collectons que ce dont l'application a besoin pour fonctionner. Les catégories sont fixées par le code, pas par votre usage.",
          ],
          rows: [
            ["Données de compte", "Adresse e-mail, nom affiché, identifiant, biographie facultative, date de naissance facultative, et mot de passe haché. Votre date de naissance est stockée chiffrée."],
            ["Données d'authentification", "Jetons de session, enregistrements d'appareils pour la double authentification, et état de vérification de l'adresse e-mail."],
            ["Contenu que vous publiez", "Publications, commentaires, réactions, messages, publications de groupe, contenu de pages, votes aux sondages et médias que vous envoyez. **Les messages privés et les dates de naissance sont stockés chiffrés** ; le reste est stocké tel que vous l'avez écrit."],
            ["Données techniques", "Adresse IP de chaque requête, agent utilisateur, et journaux serveur horodatés avec routes et codes de réponse."],
            ["Données dérivées", "Votre position sur la carte lorsque vous signalez un lieu. Votre adresse IP sert à appliquer les limites de débit et à détecter les abus ; cette application ne la résout ni en pays ni en réseau."],
          ],
        },
        {
          id: "legal-basis",
          title: "Pourquoi nous sommes autorisés à les traiter",
          paragraphs: [
            "Le RGPD exige une base légale pour chaque finalité, plutôt qu'un intérêt général à faire fonctionner un service.",
          ],
          bullets: [
            "**Contrat** — le compte, l'authentification et le contenu que vous créez, car l'application ne peut pas fonctionner sans.",
            "**Intérêt légitime** — journaux de sécurité, limitation de débit et prévention des abus, mis en balance avec votre intérêt à disposer d'un service disponible.",
            "**Consentement** — la mesure d'audience facultative, et tout ce qui n'a pas été prévu autrement. Vous pouvez le retirer à tout moment.",
            "**Obligation légale** — conservation d'une piste d'audit lorsque les obligations de modération l'imposent.",
          ],
        },
        {
          id: "processors",
          title: "Qui d'autre reçoit vos données",
          paragraphs: [
            "Nous utilisons des sous-traitants. Chacun est listé ici avec ce qu'il reçoit réellement, parce que « nous partageons des données avec des partenaires » ne vous donne rien sur quoi agir. Un sous-traitant agit sur nos instructions et ne peut pas utiliser vos données à ses propres fins.",
          ],
          rows: [
            ["Inférence IA — OpenRouter / Poolside AI", "**Le contenu des messages que vous envoyez à l'assistant**, ainsi que l'invite système. Transmis pour produire une réponse. N'envoyez rien que vous ne voudriez pas voir quitter le déploiement. Le fournisseur est configurable ; le/vendor nommé ici est celui qu'utilise ce déploiement."],
            ["E-mails transactionnels — Resend, ou votre hôte SMTP", "Votre adresse e-mail et le contenu des notifications, de vérification et de réinitialisation."],
            ["Vérification de mot de passe compromis — Have I Been Pwned", "Les cinq premiers caractères d'une empreinte SHA-1 de votre mot de passe, jamais le mot de passe ni le reste de l'empreinte. Utilisé à l'inscription et au changement de mot de passe pour refuser un mot de passe présent dans un corpus de fuites connu. Seul le préfixe quitte le serveur : il ne permet pas de retrouver votre mot de passe."],
            ["Géocodage — OpenStreetMap Nominatim", "Les termes que vous saisissez dans la recherche de lieux, et les coordonnées lorsque vous résolvez un lieu en adresse."],
            ["Tuiles cartographiques — CDN OpenStreetMap", "Votre adresse IP, lors du chargement de l'imagerie de la carte."],
            ["Identité OAuth — Google, GitHub", "Votre identité, si vous choisissez de vous connecter avec l'un d'eux plutôt qu'avec un mot de passe."],
            ["Base de données — MariaDB", "Tout, et les champs listés ci-dessus sont chiffrés au repos. Hébergé sur une infrastructure située dans l'Union européenne."],
            ["Hébergement de l'application — cPanel avec Passenger", "Tout, en transit et dans les journaux serveur, dans le cadre du service de l'application."],
          ],
        },
        {
          id: "transfers",
          title: "Où vos données sont hébergées",
          paragraphs: [
            "La base de données et l'hébergement sont fournis par l'hébergeur du déploiement. Certains sous-traitants listés ci-dessus sont établis hors de l'Union européenne, en particulier les fournisseurs d'inférence IA et d'e-mails. Lorsque des données quittent l'EEE, nous nous appuyons sur une décision d'adéquation ou sur des clauses contractuelles types, et nous limitons les transferts au strict nécessaire à la fonctionnalité.",
          ],
        },
        {
          id: "retention",
          title: "Combien de temps nous les conservons",
          paragraphs: [
            "Conserver des données indéfiniment n'est pas une politique, c'est une négligence. Les durées ci-dessous sont les valeurs par défaut ; une durée plus courte vaut mieux dès qu'elle est défendable.",
          ],
          rows: [
            ["Données de compte", "Pendant la durée du compte, puis suppression ou anonymisation dans les 30 jours de la clôture."],
            ["Messages et contenu privé", "Jusqu'à ce que vous les supprimiez, ou jusqu'à la clôture du compte."],
            ["Journaux serveur et d'accès", "30 jours, puis suppression."],
            ["Piste d'audit", "12 mois, pour justifier les décisions de modération et l'intégrité de la plateforme."],
            ["Médias envoyés", "Jusqu'à ce que vous les supprimiez, ou jusqu'à la clôture du compte."],
            ["Compteurs de limitation", "Quelques minutes, pas quelques mois. Ils servent à ralentir les abus, pas à établir un profil."],
          ],
        },
        {
          id: "rights",
          title: "Vos droits",
          paragraphs: [
            "Vous pouvez exercer ces droits sans motif et sans frais. En pratique, la plupart sont déjà accessibles sans contacter qui que ce soit.",
          ],
          bullets: [
            "**Accès** — consultez vos paramètres de profil.",
            "**Rectification** — modifiez profil, biographie et date de naissance dans les paramètres.",
            "**Effacement** — supprimez vos publications et messages ; fermez votre compte pour le reste.",
            "**Portabilité** — exportez le contenu que vous avez créé via l'interface fournie.",
            "**Opposition et limitation** — pour les traitements fondés sur l'intérêt légitime, y compris le profilage.",
            "**Retrait du consentement** — pour tout ce qui était facultatif et fondé sur le consentement.",
          ],
        },
        {
          id: "supervisory-authority",
          title: "Réclamations",
          paragraphs: [
            "Si vous estimez que vos droits n'ont pas été respectés, vous pouvez saisir votre autorité de protection des données. En France, la CNIL ; à Madagascar, la CMIL. Nous préférerions vous entendre directement d'abord, mais vous n'y êtes pas obligé.",
          ],
        },
        {
          id: "security",
          title: "Comment nous protégeons vos données",
          paragraphs: [
            "Les mots de passe sont hachés avec Argon2id. Les messages privés et les dates de naissance sont chiffrés au repos en AES-256-GCM, chaque valeur avec son propre vecteur d'initialisation, afin qu'un vol de base de données ne soit pas la transcription lisible des conversations de tous. Les textes de notification sont stockés en clair : nous le disons ici plutôt que de laisser croire à une protection qui n'existe pas. Les sessions sont des cookies HTTP-only et SameSite. Les données en transit sont en HTTPS uniquement, avec HSTS et aucun contenu mixte. Les requêtes modifiant l'état sont vérifiées par rapport à une liste d'origines de confiance, afin qu'une page tierce ne puisse pas soumettre de formulaires en votre nom.",
          ],
        },
        {
          id: "subject-specific",
          title: "Ce qui est spécifique à cette application",
          paragraphs: [
            "Cette section décrit les données que cette application particulière collecte en raison de son objet. Elle est marquée comme incomplète, volontairement.",
          ],
          subject: true,
          bullets: [
            "Le contenu et la structure du domaine applicatif ne sont pas encore arrêtés. Les catégories listées sous « Ce que nous collectons » sont celles de la plateforme, et sont exactes.",
            "Avant que cette application ne traite de véritables données personnelles, cette section doit nommer : les entités du domaine et leurs champs, tout tiers supplémentaire introduit par le sujet, et toute donnée sensible susceptible d'intervenir.",
          ],
        },
        {
          id: "changes",
          title: "Modifications de cette politique",
          paragraphs: [
            "Nous publierons la nouvelle version ici et mettrons à jour la date en haut. Les modifications substantielles — un nouveau sous-traitant, une nouvelle catégorie de données, une nouvelle finalité — seront signalées plutôt que glissées dans le texte.",
          ],
        },
      ],
    },
    terms: {
      slug: "terms",
      updated: "2026-10-03",
      intro:
        "Ces conditions décrivent ce que vous pouvez attendre de cette application et ce qui est attendu de vous. Elles sont rédigées simplement, parce qu'une condition que personne ne comprend n'est pas une condition que l'on peut respecter.",
      sections: [
        {
          id: "acceptance",
          title: "Acceptation des conditions",
          paragraphs: [
            "En créant un compte ou en utilisant ce déploiement, vous acceptez ces conditions. Si vous ne les acceptez pas, ne créez pas de compte.",
          ],
        },
        {
          id: "nature",
          title: "Nature du service",
          paragraphs: [
            "Il s'agit d'une application de démonstration déployée pour un hackathon. Elle est fournie en l'état, sans garantie de disponibilité, sans niveau de service, et sans engagement de continuer à fonctionner après l'événement.",
          ],
        },
        {
          id: "accounts",
          title: "Votre compte",
          paragraphs: [
            "Vous êtes responsable de ce qui se passe sous votre compte, y compris la confidentialité de votre mot de passe et l'activation de la double authentification. Vous devez être assez âgé pour consentir au traitement de vos données selon le droit applicable de votre lieu de résidence.",
            "Une personne, un compte. Créer des comptes supplémentaires pour contourner une limite, une exclusion ou une suspension constitue une violation des présentes conditions.",
          ],
        },
        {
          id: "content",
          title: "Votre contenu",
          paragraphs: [
            "Vous restez propriétaire de ce que vous publiez. Vous accordez à l'exploitant une licence non exclusive, mondiale et libre de redevances pour héberger, copier et afficher votre contenu dans le but de faire fonctionner le service — y compris les sauvegardes et la modération qu'exige le maintien de sa sécurité.",
            "Ne publiez pas de contenu dont vous ne détenez pas les droits, ni de contenu illégal, portant atteinte aux droits d'autrui, ou délibérément conçu pour nuire.",
          ],
        },
        {
          id: "conduct",
          title: "Usage acceptable",
          paragraphs: [
            "Vous vous engagez à ne pas : tenter d'accéder à des comptes ou données qui ne sont pas les vôtres ; sonder, scanner ou tester l'infrastructure au-delà de ce qu'exige un usage ordinaire ; contourner les limites de débit, les suspensions ou les exclusions ; extraire ou récolter du contenu à des fins extérieures au service ; utiliser l'application pour diffuser un logiciel malveillant ou harceler autrui.",
            "Un accès automatisé qui concurrence le service, et toute tentative de rendre le déploiement indisponible pour d'autres, entraîneront une suspension et, le cas échéant, un signalement à l'autorité compétente.",
          ],
        },
        {
          id: "moderation",
          title: "Modération",
          paragraphs: [
            "L'exploitant peut supprimer du contenu, en restreindre la visibilité, suspendre des comptes et conserver une piste d'audit de ces décisions. Une suppression n'est pas un jugement sur votre personne : c'est une décision sur la capacité du contenu à rester en ligne.",
            "Vous pouvez signaler du contenu qui vous semble enfreindre ces conditions. Les messages signalés sont déchiffrés pour le modérateur qui les examine — c'est pourquoi ce service n'est pas chiffré de bout en bout : la modération d'un contenu signalé suppose que le serveur puisse le lire.",
          ],
        },
        {
          id: "liability",
          title: "Responsabilité et disponibilité",
          paragraphs: [
            "Le service est fourni en l'état, sans garantie d'aucune sorte, dans toute la mesure permise par la loi. L'exploitant n'est pas responsable des pertes indirectes ou consécutives, y compris la perte de données, de bénéfices ou l'interruption de service.",
            "S'agissant d'un déploiement de hackathon sur un hébergement mutualisé, attendez-vous à des lenteurs ou à de brèves interruptions. C'est une propriété de l'environnement, pas une promesse que nous aurions tenue.",
          ],
        },
        {
          id: "ip",
          title: "Propriété intellectuelle",
          paragraphs: [
            "Le code de l'application appartient à l'exploitant. Le contenu que vous publiez reste le vôtre. Les noms de tiers apparaissant dans l'application — y compris les bibliothèques open source utilisées pour la construire — restent la propriété de leurs détenteurs respectifs.",
          ],
        },
        {
          id: "governing-law",
          title: "Droit applicable et juridiction",
          paragraphs: [
            "Les présentes conditions sont soumises au droit français. Les tribunaux français sont compétents pour tout litige, sans préjudice des protections impératives des consommateurs susceptibles de s'appliquer là où vous vivez.",
          ],
        },
        {
          id: "changes",
          title: "Modifications",
          paragraphs: [
            "Nous pouvons mettre à jour ces conditions. La date en haut reflète toujours la version en vigueur. Continuer à utiliser le service après une modification vaut acceptation des conditions mises à jour.",
          ],
        },
      ],
    },
  },
};

export default fr;
