import { useState, type FormEvent } from "react"
import {
  Link,
  data,
  useActionData,
  useLoaderData,
  useNavigation,
  useSubmit,
  type ActionFunctionArgs,
  type LoaderFunctionArgs,
} from "react-router"
import { flattenCategoryOptions } from "~/entities/site-mail/lib/category-tree"
import { requireUser } from "~/features/auth/model/session.server"
import { canWriteSiteMail, requireSiteMailWriteAccess } from "~/features/site-mails/model/site-mail-access.server"
import { listSiteMailCategoriesBySite } from "~/features/site-mails/model/site-mail-categories.repository.server"
import { listSiteMailSites } from "~/features/site-mails/model/site-mail-sites.repository.server"
import { findSiteMailByContentHash, insertSiteMailPost } from "~/features/site-mails/model/site-mails.repository.server"
import { parseStandardEml } from "~/features/task-standards/model/task-standards.parser.server"
import { validateEmlFile, validateEmlFiles } from "~/features/task-standards/model/task-standards.schema"
import { Button } from "~/shared/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "~/shared/ui/card"
import { Field } from "~/shared/ui/field"
import { PageHeader } from "~/shared/ui/page-header"
import { Select } from "~/shared/ui/select"

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await requireUser(request)
  const url = new URL(request.url)
  const siteIdParam = url.searchParams.get("site")
  const sites = await listSiteMailSites()
  // 업로드 대상은 이 계정이 쓸 수 있는 메일함 현장만 보여준다.
  const sorted = sites.filter((site) => canWriteSiteMail(user, site))
  // 구분자는 현장마다 따로이므로 현장별로 묶어 내려주고, 화면에서 선택한 현장의 목록만 보여준다.
  const categoriesBySite = await listSiteMailCategoriesBySite(sorted.map((site) => site.id))
  const defaultSiteId = siteIdParam ? Number(siteIdParam) : sorted[0]?.id
  return { sites: sorted, categoriesBySite, defaultSiteId: Number.isFinite(defaultSiteId) ? defaultSiteId : null }
}

export async function action({ request }: ActionFunctionArgs) {
  const form = await request.formData()
  const siteId = Number(form.get("site_id"))
  if (!Number.isFinite(siteId)) return data({ formError: "현장을 찾을 수 없습니다." }, { status: 400 })
  const { user } = await requireSiteMailWriteAccess(request, siteId)

  const files = form.getAll("eml").filter((value): value is File => value instanceof File)
  const filesError = validateEmlFiles(files)
  if (filesError) return data({ formError: filesError }, { status: 400 })

  let categoryIds: string[] = []
  try {
    categoryIds = JSON.parse(String(form.get("category_ids") ?? "[]"))
  } catch {
    /* ignore */
  }

  // 다른 현장의 구분자 id가 섞여 들어오면 "없음"으로 저장한다(현장별 구분자 분리).
  const siteCategoryIds = new Set(((await listSiteMailCategoriesBySite([siteId]))[siteId] ?? []).map((cat) => cat.id))
  const results: { name: string; id: string }[] = []
  const errors: { name: string; error: string }[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const fileError = validateEmlFile(file)
    if (fileError) {
      errors.push({ name: file.name, error: fileError })
      continue
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    let parsed
    try {
      parsed = await parseStandardEml(buffer)
    } catch {
      errors.push({ name: file.name, error: "메일 파일을 읽을 수 없습니다. 올바른 .eml 파일인지 확인해 주세요." })
      continue
    }

    const existing = await findSiteMailByContentHash(siteId, parsed.contentHash)
    if (existing) {
      errors.push({ name: file.name, error: `이미 등록된 메일입니다 (제목: "${existing.title}")` })
      continue
    }

    try {
      const post = await insertSiteMailPost({
        siteId,
        parsed,
        categoryId: categoryIds[i] && siteCategoryIds.has(Number(categoryIds[i])) ? Number(categoryIds[i]) : null,
        createdBy: user.id,
      })
      results.push({ name: file.name, id: post.id })
    } catch (error) {
      errors.push({ name: file.name, error: error instanceof Error ? error.message : "저장에 실패했습니다." })
    }
  }

  return { results, errors }
}

export default function SiteMailsNewRoute() {
  const { sites, categoriesBySite, defaultSiteId } = useLoaderData<typeof loader>()
  const actionData = useActionData<typeof action>()
  const navigation = useNavigation()
  const submit = useSubmit()
  const pending = navigation.state === "submitting"

  const [siteId, setSiteId] = useState(defaultSiteId ? String(defaultSiteId) : "")
  const [files, setFiles] = useState<File[]>([])
  const [categoryIds, setCategoryIds] = useState<string[]>([])
  const categoryOptions = flattenCategoryOptions(categoriesBySite[Number(siteId)] ?? [])

  function handleFilesChange(fileList: FileList | null) {
    const next = fileList ? Array.from(fileList) : []
    setFiles(next)
    setCategoryIds(next.map(() => ""))
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData()
    formData.append("site_id", siteId)
    for (const file of files) formData.append("eml", file)
    formData.append("category_ids", JSON.stringify(categoryIds))
    submit(formData, { method: "post", encType: "multipart/form-data" })
  }

  return (
    <div className="space-y-6">
      <Link to="/site-mails" className="text-sm text-muted-foreground hover:text-foreground">
        <span className="font-semibold text-foreground">[목록]</span> 현장 메일함
      </Link>

      <PageHeader title="EML 업로드" description="현장의 중요 메일(.eml)을 여러 건 한 번에 업로드합니다 (최대 30개)" />

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>파일 선택</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {actionData && "formError" in actionData ? (
              <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{actionData.formError}</div>
            ) : null}

            <Field label="현장" htmlFor="site-id" required>
              <Select
                id="site-id"
                value={siteId}
                onChange={(e) => {
                  // 현장마다 구분자가 다르므로 현장을 바꾸면 파일별 구분자 선택을 비운다.
                  setSiteId(e.target.value)
                  setCategoryIds((prev) => prev.map(() => ""))
                }}
                required
              >
                <option value="" disabled>
                  현장을 선택하세요
                </option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="EML 파일"
              htmlFor="eml-files"
              required
              hint="Outlook, Gmail 등에서 내보낸 .eml 파일만 지원합니다 (파일당 최대 20MB)"
            >
              <input
                id="eml-files"
                type="file"
                accept=".eml"
                multiple
                required
                onChange={(e) => handleFilesChange(e.target.files)}
                className="block w-full text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-2 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-secondary/80"
              />
            </Field>

            {files.length > 0 ? (
              <div className="divide-y divide-border rounded-md border border-border">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="flex flex-wrap items-center gap-2 p-3">
                    <span className="flex-1 truncate text-sm font-medium">{file.name}</span>
                    <Select
                      value={categoryIds[index] ?? ""}
                      onChange={(e) => setCategoryIds((prev) => prev.map((value, i) => (i === index ? e.target.value : value)))}
                    >
                      <option value="">구분자 없음</option>
                      {categoryOptions.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                ))}
              </div>
            ) : null}

            <Button type="submit" disabled={pending || files.length === 0 || !siteId}>
              {pending ? "업로드 중…" : `업로드 (${files.length}건)`}
            </Button>
          </form>

          {actionData && "results" in actionData ? (
            <div className="mt-6 space-y-3">
              {actionData.results.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-success">성공 {actionData.results.length}건</p>
                  <ul className="space-y-1 text-sm">
                    {actionData.results.map((result) => (
                      <li key={result.id}>
                        <Link to={`/site-mails/${result.id}`} className="hover:underline">
                          {result.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {actionData.errors.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-danger">실패 {actionData.errors.length}건</p>
                  <ul className="space-y-1 text-sm text-danger">
                    {actionData.errors.map((err, index) => (
                      <li key={index}>
                        {err.name}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
