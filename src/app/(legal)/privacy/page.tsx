import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confidentialité" };

/** What Terra Nova stores, why, how it is protected, and your rights (RGPD). */
export default function PrivacyPage() {
  return (
    <>
      <h1>Politique de confidentialité</h1>
      <p>Cette page explique quelles données Terra Nova conserve, pourquoi, et comment vous gardez la main dessus.</p>

      <h2>Données collectées</h2>
      <ul>
        <li>Compte : prénom, nom, nom d&apos;utilisateur, adresse e-mail, date de naissance (chiffrée), photo de profil et bannière si vous en ajoutez.</li>
        <li>Contenus : publications, commentaires, réactions, sondages, pages, messages privés (chiffrés au repos).</li>
        <li>Sécurité : sessions actives, appareils déjà connus (empreinte hachée), journal d&apos;audit des actions sensibles.</li>
        <li>Lieu : uniquement si vous l&apos;ajoutez, arrondi à environ 100 m (ou à la ville pour la position automatique, désactivable).</li>
      </ul>

      <h2>Pourquoi</h2>
      <p>Pour faire fonctionner le service (afficher vos contenus aux personnes que vous choisissez), le sécuriser (détection de connexion inhabituelle, limitation des abus) et le modérer. Aucune donnée n&apos;est vendue ni utilisée pour de la publicité.</p>

      <h2>Protection</h2>
      <ul>
        <li>Mots de passe hachés (Argon2), vérifiés contre les fuites connues sans jamais les transmettre.</li>
        <li>Messages privés, dates de naissance et notifications chiffrés (AES-256-GCM) dans la base.</li>
        <li>Connexion HTTPS, cookies sécurisés, double authentification disponible, alerte à chaque nouvel appareil.</li>
        <li>Images ré-encodées à l&apos;envoi : les métadonnées (dont la position GPS des photos) sont supprimées.</li>
      </ul>

      <h2>Vos droits</h2>
      <ul>
        <li>Accès et portabilité : téléchargez toutes vos données depuis Paramètres › Sécurité › « Exporter mes données ».</li>
        <li>Effacement : supprimez votre compte depuis Paramètres › Sécurité. Vos contenus sont retirés immédiatement.</li>
        <li>Rectification : modifiez votre profil à tout moment ; votre nom d&apos;utilisateur peut changer tous les 30 jours.</li>
        <li>Contrôle : audience de chaque publication, présence en ligne, position automatique, blocage de comptes.</li>
      </ul>

      <h2>Conservation</h2>
      <p>Les données restent tant que le compte existe. Les notifications lues sont purgées automatiquement ; les journaux d&apos;audit servent à la sécurité et à la modération.</p>
    </>
  );
}
