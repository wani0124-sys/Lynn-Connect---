import type { LoaderFunctionArgs } from "react-router"
import { requireSiteMailReadAccess } from "~/features/site-mails/model/site-mail-access.server"
import { getSiteMailAttachmentFile, getSiteMailAttachmentSiteId } from "~/features/site-mails/model/site-mails.repository.server"

export async function loader({ request, params }: LoaderFunctionArgs) {
  const attachmentId = params.attachmentId ?? ""
  // 첨부가 속한 메일의 현장 기준으로 열람 권한을 확인한다(현장 계정은 담당 현장 첨부만).
  const siteId = await getSiteMailAttachmentSiteId(attachmentId)
  if (siteId === null) throw new Response("Not Found", { status: 404 })
  await requireSiteMailReadAccess(request, siteId)

  const file = await getSiteMailAttachmentFile(attachmentId)
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
