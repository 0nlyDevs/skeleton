import { decryptField } from "@/lib/crypto/field-encryption";

export interface CityRequestSummaryDto {
  readonly id: string;
  readonly reference: string;
  readonly subject: string;
  readonly status: string;
  readonly priority: string;
  readonly service: { slug: string; name: string } | null;
  /** F25 — set when the request reports a problem in the city. */
  readonly issueType: string | null;
  readonly citizen: { id: string; name: string } | null;
  readonly assignee: { id: string; name: string } | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** For agents: needs someone to act (new, or the citizen answered). */
  readonly needsAction: boolean;
}

export interface CityRequestMessageDto {
  readonly id: string;
  readonly body: string;
  readonly internal: boolean;
  readonly fromAgent: boolean;
  readonly author: { id: string; name: string };
  readonly createdAt: string;
}

export interface CityRequestEventDto {
  readonly kind: string;
  readonly from: string | null;
  readonly to: string | null;
  readonly actor: string | null;
  readonly createdAt: string;
}

export interface CityRequestDto extends CityRequestSummaryDto {
  readonly message: string;
  /** Where the reported problem is (free text and/or a point on the Terra Nova map). */
  readonly location: string | null;
  readonly mapX: number | null;
  readonly mapY: number | null;
  /** District derived from the map point, when there is one. */
  readonly zone: string | null;
  readonly messages: CityRequestMessageDto[];
  readonly events: CityRequestEventDto[];
  readonly closedAt: string | null;
  /** F83 — the receipt's check code; null for anyone but the sender. */
  readonly receiptCode: string | null;
  /** F86 — the request describes a medical emergency. */
  readonly emergency: boolean;
  /** F76 — the resident's comment on how this request went, once left. */
  readonly feedback: { readonly reference: string } | null;
}

interface SummaryRow {
  id: string;
  reference: string;
  subject: string;
  status: string;
  priority: string;
  issueType?: string | null;
  createdAt: Date;
  updatedAt: Date;
  service: { slug: string; name: string } | null;
  citizen: { id: string; name: string };
  assignee: { id: string; name: string } | null;
  lastFromCitizen?: boolean;
}

export function toSummaryDto(row: SummaryRow, forAgent: boolean): CityRequestSummaryDto {
  return {
    id: row.id,
    reference: row.reference,
    subject: row.subject,
    status: row.status,
    priority: row.priority,
    service: row.service,
    issueType: row.issueType ?? null,
    citizen: forAgent ? row.citizen : null,
    assignee: row.assignee,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    needsAction: row.status === "NEW" || (row.status === "IN_PROGRESS" && row.lastFromCitizen === true),
  };
}

export function decryptBody(value: string): string {
  return decryptField(value);
}
