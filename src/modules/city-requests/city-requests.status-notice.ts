/**
 * F49 — what a status change means for the resident and what, if anything,
 * they have to do, in the words of the notification and the email. A change
 * that needs the resident says so first ("Action requise").
 */

export interface StatusNotice {
  readonly title: string;
  readonly body: string;
}

export function statusNotice(status: string, reference: string, subject: string): StatusNotice {
  const about = `« ${subject.slice(0, 80)} »`;
  switch (status) {
    case "IN_PROGRESS":
      return {
        title: `Votre demande ${reference} est prise en charge`,
        body: `Un agent traite votre demande ${about}. Rien à faire pour l'instant : vous serez prévenu à la prochaine étape.`,
      };
    case "WAITING_CITIZEN":
      return {
        title: `Action requise : votre demande ${reference} attend votre réponse`,
        body: `Les services ont besoin d'une information de votre part pour avancer sur ${about}. Ouvrez la demande et répondez : elle repart aussitôt dans la file des agents.`,
      };
    case "RESOLVED":
      return {
        title: `Votre demande ${reference} est résolue`,
        body: `Les services considèrent ${about} comme réglée. Lisez leur réponse. Si le problème persiste, répondez dans la demande : elle sera rouverte.`,
      };
    case "CLOSED":
      return {
        title: `Votre demande ${reference} est close`,
        body: `La demande ${about} est terminée et ne reçoit plus de messages. Pour un nouveau problème, faites une nouvelle demande.`,
      };
    default:
      return {
        title: `Votre demande ${reference} a changé d'état`,
        body: `La demande ${about} a été mise à jour. Ouvrez-la pour voir où elle en est.`,
      };
  }
}
