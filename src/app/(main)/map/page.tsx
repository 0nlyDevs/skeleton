import { redirect } from "next/navigation";

/** The one map of Terra Nova is `/city-map`, the landing's island with the city's functions. */
export default async function MapPage({ searchParams }: { readonly searchParams: Promise<{ zone?: string }> }) {
  const { zone } = await searchParams;
  redirect(zone ? `/city-map?zone=${encodeURIComponent(zone)}` : "/city-map");
}
