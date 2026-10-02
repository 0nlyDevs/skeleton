import type { Metadata } from "next";

export const metadata: Metadata = { title: "Conditions d'utilisation" };

export default function TermsPage() {
  return (
    <>
      <h1>Conditions d&apos;utilisation</h1>
      <p>En utilisant Skeleton, vous acceptez les règles ci-dessous. Elles existent pour que chacun puisse s&apos;exprimer en sécurité.</p>

      <h2>Votre compte</h2>
      <ul>
        <li>Vous êtes responsable de votre compte et de la confidentialité de votre mot de passe. Activez la double authentification.</li>
        <li>Un compte par personne ; l&apos;usurpation d&apos;identité est interdite.</li>
      </ul>

      <h2>Ce qui est interdit</h2>
      <ul>
        <li>Contenus haineux, violents, pornographiques, harcelants ou illégaux.</li>
        <li>Spam, automatisation abusive, tentative d&apos;accès non autorisé ou de contournement des limites.</li>
        <li>Publier les données personnelles d&apos;autrui sans son accord.</li>
      </ul>

      <h2>Modération</h2>
      <p>Chacun peut signaler un contenu ou un profil. L&apos;équipe de modération et les modérateurs des groupes peuvent retirer un contenu ou suspendre un compte ; vous êtes informé·e de la décision et de sa raison.</p>

      <h2>Vos contenus</h2>
      <p>Vous restez propriétaire de ce que vous publiez. Vous nous autorisez seulement à l&apos;afficher aux personnes que vous avez choisies (audience de la publication, groupe, conversation).</p>
    </>
  );
}
