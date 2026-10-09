"use client";

import { Printer } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import YearPicker, { useYear } from "@/components/YearPicker";
import { PageBody, PageHeader } from "@/components/kit/page-header";
import { StatusBadge, type StatusKind } from "@/components/kit/status";
import { Button } from "@/components/ui/button";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  councilSheet,
  type ChecklistLine,
  type CouncilCity,
  type History,
  type Money,
  type Outcome,
  type Question,
  type Reading,
  type SourceLink,
} from "@/lib/council";
import { cn } from "@/lib/utils";

const KIND: Record<Outcome, StatusKind> = { met: "ok", edge: "edge", missed: "below", nodata: "nd", notdelivered: "below" };

export function CouncilSheetView({ city, years, initial }: { city: CouncilCity; years: number[]; initial: number }) {
  const [year, setYear] = useYear(years, initial);
  const s = councilSheet(city, years, year);
  return (
    <>
      <PageHeader
        title={s.header.title}
        description={
          <>
            <p>
              <span className="font-medium text-foreground">{s.header.place}</span> · {s.header.exercise} · {s.header.dataVersion}
            </p>
            <p>{s.header.lead}</p>
            <p className="text-[0.8125rem] leading-5">{s.header.guide}</p>
            <p className="text-[0.8125rem]">
              <Link href={s.header.cityHref} className="text-brand-ink hover:underline" aria-label={`Página do município, ${s.header.place}`}>
                {s.header.cityLabel}
              </Link>
            </p>
          </>
        }
        actions={
          <>
            <YearPicker years={years} year={year} onChange={setYear} className="max-w-full" />
            <Button variant="outline" onClick={() => window.print()}>
              <Printer aria-hidden className="text-muted-foreground" />
              Imprimir
            </Button>
          </>
        }
      />
      <PageBody>
        <article data-council-sheet className="mx-auto max-w-3xl space-y-10 print:space-y-3">
          <Section id="checklist" title="Checklist legal">
            <Checklist lines={s.checklist} />
          </Section>
          <Section id="dinheiro" title="Para onde vai o dinheiro">
            <MoneyBlock money={s.money} />
          </Section>
          <Section id="historico" title="Últimos exercícios">
            <HistoryTable history={s.history} />
          </Section>
          <Section id="perguntas" title="Perguntas para a próxima reunião">
            <Questions questions={s.questions} />
          </Section>
          <Section id="fontes" title="Fontes">
            <Sources sources={s.sources} />
          </Section>
        </article>
      </PageBody>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`ficha-${id}`} className="space-y-3">
      <h2 id={`ficha-${id}`} className="text-lg font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Checklist({ lines }: { lines: readonly ChecklistLine[] }) {
  return (
    <ul className="divide-y border-y">
      {lines.map((l) => (
        <li key={l.id} aria-labelledby={`linha-${l.id}`} className="space-y-1.5 py-3 break-inside-avoid print:py-1.5">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
            <h3 id={`linha-${l.id}`} className="font-medium">
              {l.title}
            </h3>
            <span className="text-[0.8125rem] text-muted-foreground tnum">{l.scope}</span>
          </div>
          {l.kind === "rule" ? (
            <ul className="space-y-1">
              {l.readings.map((r) => (
                <ReadingRow key={r.source.short} r={r} />
              ))}
            </ul>
          ) : (
            l.flags.length > 0 && (
              <ul className="space-y-1 text-sm">
                {l.flags.map((f) => (
                  <li key={f.year}>
                    <span className="font-medium tnum">{f.year}</span> {f.text}
                  </li>
                ))}
              </ul>
            )
          )}
          {l.note && <p className="text-[0.8125rem] leading-5 text-muted-foreground">{l.note}</p>}
        </li>
      ))}
    </ul>
  );
}

function ReadingRow({ r }: { r: Reading }) {
  return (
    <li className="text-sm leading-6">
      <span className="font-medium">{r.source.short}</span> <span className="tnum">{r.figure}</span>{" "}
      <StatusBadge kind={KIND[r.outcome]} className="align-middle">
        {r.badge}
      </StatusBadge>
    </li>
  );
}

function MoneyBlock({ money }: { money: Money }) {
  return (
    <>
      <dl className="divide-y border-y">
        {[money.applied, money.required, money.gap].map((row) => (
          <div key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 py-2 sm:grid-cols-[14rem_9rem_minmax(0,1fr)]">
            <dt className="text-sm">{row.label}</dt>
            <dd className="text-right text-sm font-medium tnum sm:text-left">{row.value}</dd>
            {row.note && <dd className="col-span-2 text-[0.8125rem] text-muted-foreground sm:col-span-1">{row.note}</dd>}
          </div>
        ))}
      </dl>
      <p className="text-[0.8125rem] leading-5 text-muted-foreground">{money.basis}</p>
      <p className="text-[0.8125rem] leading-5 text-muted-foreground">{money.payroll}</p>
    </>
  );
}

function HistoryTable({ history }: { history: History }) {
  return (
    <>
      <div className="scroll-thin overflow-x-auto">
        <table className="w-full text-sm whitespace-nowrap tnum">
          <caption className="sr-only">Indicadores dos últimos exercícios, do mais antigo ao selecionado</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent [&>th]:h-9 [&>th]:px-3 [&>th]:text-right [&>th]:text-[0.8125rem] [&>th]:font-medium [&>th]:text-muted-foreground">
              <TableHead scope="col" className="pl-0! text-left!">
                Exercício
              </TableHead>
              {history.columns.map((c) => (
                <TableHead key={c} scope="col">
                  {c}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {history.rows.map((row) => (
              <TableRow key={row.year} className={cn("text-right hover:bg-transparent [&>td]:px-3 [&>td]:py-2", row.selected && "bg-muted/60 font-medium")}>
                <TableHead scope="row" className="h-auto pl-0! text-left font-medium text-foreground">
                  {row.year}
                </TableHead>
                {row.cells.map((c, i) => (
                  <TableCell key={history.columns[i]} className={cn(c.outcome && KIND[c.outcome] === "below" && "font-medium text-critical-ink")}>
                    {c.text}
                    {c.spoken && <p className="mt-0.5 text-[0.6875rem] font-normal leading-4 text-current/80 print:hidden">{c.spoken}</p>}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </table>
      </div>
      <p className="text-[0.8125rem] text-muted-foreground sm:hidden print:hidden">Arraste a tabela para o lado para ver todas as colunas.</p>
      <p className="text-[0.8125rem] text-muted-foreground">{history.footnote}</p>
    </>
  );
}

function Questions({ questions }: { questions: readonly Question[] }) {
  return (
    <ol className="list-decimal space-y-2 pl-5 text-sm leading-6 marker:text-muted-foreground print:space-y-1 print:leading-5">
      {questions.map((q) => (
        <li key={q.topic} className="pl-1 break-inside-avoid">
          {q.text}
        </li>
      ))}
    </ol>
  );
}

function Sources({ sources }: { sources: readonly SourceLink[] }) {
  return (
    <ul className="space-y-1 text-[0.8125rem] leading-5 text-muted-foreground">
      {sources.map((x) => (
        <li key={x.label}>
          {x.href == null ? (
            x.label
          ) : x.href.startsWith("/") ? (
            <Link href={x.href} className="text-brand-ink hover:underline">
              {x.label}
            </Link>
          ) : (
            <a href={x.href} target="_blank" rel="noreferrer" className="text-brand-ink hover:underline">
              {x.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
