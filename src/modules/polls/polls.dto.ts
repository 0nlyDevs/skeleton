/** Aggregate results only: who voted for what is never part of any response. */
export interface PollDto {
  readonly id: string;
  readonly multiple: boolean;
  readonly closesAt: string | null;
  readonly closed: boolean;
  readonly totalVoters: number;
  readonly options: readonly { readonly id: string; readonly label: string; readonly votes: number }[];
}

export interface PollRow {
  id: string;
  multiple: boolean;
  closesAt: Date | null;
  totalVoters: number;
  options: { id: string; label: string; voteCount: number }[];
}

export function toPollDto(row: PollRow, now = Date.now()): PollDto {
  return {
    id: row.id,
    multiple: row.multiple,
    closesAt: row.closesAt ? row.closesAt.toISOString() : null,
    closed: row.closesAt !== null && row.closesAt.getTime() <= now,
    totalVoters: row.totalVoters,
    options: row.options.map((option) => ({ id: option.id, label: option.label, votes: option.voteCount })),
  };
}
