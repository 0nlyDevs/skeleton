import { createCityRequestRoute, listCityRequestsRoute } from "@/modules/city-requests/city-requests.routes";

export const GET = listCityRequestsRoute;
export const POST = createCityRequestRoute;
