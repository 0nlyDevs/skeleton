import type { Role } from "@/types";

/** The signed-in user as the shell renders them (no email outside settings). */
export interface ShellViewer {
  readonly id: string;
  readonly name: string;
  readonly username: string | null;
  readonly email: string;
  readonly image: string | null;
  readonly role: Role;
}

export interface ShellGroup {
  readonly slug: string;
  readonly name: string;
  readonly privacy: "PUBLIC" | "PRIVATE";
}

/** Server-loaded data for the left rail. */
export interface ShellRail {
  readonly followers: number;
  readonly following: number;
  readonly posts: number;
  readonly groups: readonly ShellGroup[];
}
