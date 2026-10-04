"use client";

import { useState } from "react";

import { CreateAccountPanel } from "./create-account-panel";
import { UsersTable } from "./users-table";

/** Account creation on top, the accounts table under it; the table reloads after a creation. */
export function AdminUsers({ currentUserId }: { readonly currentUserId: string }) {
  const [version, setVersion] = useState(0);
  return (
    <>
      <CreateAccountPanel onCreated={() => setVersion((value) => value + 1)} />
      <UsersTable key={version} currentUserId={currentUserId} />
    </>
  );
}
