import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors";
import type { TransportLineInput } from "./transports.schema";

export type TransportLineDto = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  stops: string[];
  firstDeparture: string;
  lastDeparture: string;
  headwayMinutes: number;
  serviceDays: string;
  alert: string | null;
  published: boolean;
  updatedAt: string;
};

function toDto(row: Awaited<ReturnType<typeof prisma.transportLine.findMany>>[number]): TransportLineDto {
  return { ...row, stops: row.stops.split("\n").map((stop) => stop.trim()).filter(Boolean), updatedAt: row.updatedAt.toISOString() };
}

export async function listPublishedTransportLines(): Promise<TransportLineDto[]> {
  return (await prisma.transportLine.findMany({ where: { published: true }, orderBy: { code: "asc" } })).map(toDto);
}

export async function listTransportLines(): Promise<TransportLineDto[]> {
  return (await prisma.transportLine.findMany({ orderBy: { code: "asc" } })).map(toDto);
}

function toData(input: TransportLineInput) {
  return { ...input, stops: input.stops.join("\n"), description: input.description || null, alert: input.alert || null };
}

export async function createTransportLine(input: TransportLineInput): Promise<TransportLineDto> {
  return toDto(await prisma.transportLine.create({ data: toData(input) }));
}

export async function updateTransportLine(id: string, input: TransportLineInput): Promise<TransportLineDto> {
  const exists = await prisma.transportLine.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new NotFoundError("That transport line does not exist.");
  return toDto(await prisma.transportLine.update({ where: { id }, data: toData(input) }));
}

export async function deleteTransportLine(id: string): Promise<void> {
  const result = await prisma.transportLine.deleteMany({ where: { id } });
  if (!result.count) throw new NotFoundError("That transport line does not exist.");
}
