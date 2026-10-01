import type { LoaderFunctionArgs } from "react-router"
import { requireUser } from "~/features/auth/model/session.server"
import { getAttachmentFile } from "~/features/task-standards/model/task-standards.repository.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
  await requireUser(request)
  const attachmentId = params.attachmentId ?? ""

  const file = await getAttachmentFile(attachmentId)
  if (!file) throw new Response("Not Found", { status: 404 })

  const encodedFilename = encodeURIComponent(file.filename)
  return new Response(file.blob, {
    headers: {
      "Content-Type": file.mimeType ?? "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "private, max-age=0, no-cache",
    },
  })
}
