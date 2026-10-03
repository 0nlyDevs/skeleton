import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Inscription" };

/** New residents ask for their account at the citizens' registry, on the landing. */
export default function RegisterPage() {
  redirect("/?registre=inscription");
}
