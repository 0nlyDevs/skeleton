import type { Metadata } from "next";

import { TransportsBoard } from "@/components/city/transports-board";
import { listPublishedTransportLines } from "@/modules/transports/transports.service";

export const metadata: Metadata = { title: "Transports municipaux" };

export default function TransportsPage() {
  return <TransportPage />;
}

async function TransportPage() {
  const lines = await listPublishedTransportLines();
  return <TransportsBoard lines={lines} />;
}
