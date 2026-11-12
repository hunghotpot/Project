import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { getPolicy, POLICIES } from "@/lib/policies"

type Props = { params: Promise<{ slug: string }> }

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const policy = getPolicy((await params).slug)
  return { title: policy?.title ?? "Chính sách" }
}

export default async function PolicyPage({ params }: Props) {
  const policy = getPolicy((await params).slug)
  if (!policy) notFound()

  return (
    <article className="mx-auto max-w-3xl space-y-8 pb-4">
      <nav aria-label="Các chính sách" className="flex flex-wrap gap-2">
        {POLICIES.map((p) => (
          <Link
            key={p.slug}
            href={`/chinh-sach/${p.slug}`}
            aria-current={p.slug === policy.slug ? "page" : undefined}
            className={
              p.slug === policy.slug
                ? "rounded-full bg-ink px-4 py-1.5 text-label font-bold text-white"
                : "rounded-full bg-secondary px-4 py-1.5 text-label font-bold hover:bg-border"
            }
          >
            {p.title}
          </Link>
        ))}
      </nav>

      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{policy.title}</h1>
        <p className="text-muted-foreground">{policy.intro}</p>
      </header>

      {policy.sections.map((s) => (
        <section key={s.heading} className="space-y-3">
          <h2 className="text-lg font-bold">{s.heading}</h2>
          <ul className="list-disc space-y-2 pl-5">
            {s.body.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </section>
      ))}

      {policy.pending && (
        <p className="rounded-2xl bg-secondary p-4 text-label text-muted-foreground">
          Phần còn lại của chính sách này đang được cập nhật. Vui lòng quay lại sau.
        </p>
      )}
    </article>
  )
}
