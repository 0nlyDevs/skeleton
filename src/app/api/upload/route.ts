import { uploadFileRoute } from "@/modules/uploads/uploads.routes";

/** Multipart POST: `file` plus an optional `visibility` of PUBLIC or PRIVATE. */
export const POST = uploadFileRoute;
