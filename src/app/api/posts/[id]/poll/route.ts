import { castBallotRoute, listPollVotersRoute, retractBallotRoute } from "@/modules/polls/polls.routes";

export const PUT = castBallotRoute;
export const DELETE = retractBallotRoute;
export const GET = listPollVotersRoute;
