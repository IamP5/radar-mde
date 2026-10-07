"use client";

import { useSyncExternalStore } from "react";

const MONTHS = ["jan.", "fev.", "mar.", "abr.", "maio", "jun.", "jul.", "ago.", "set.", "out.", "nov.", "dez."];
const noop = () => () => {};
/** Today's date on the client (the page is static, so the server can't know the access date). */
const useToday = () => useSyncExternalStore(noop, () => new Date().toDateString(), () => null);

const pre =
  "mt-2 overflow-x-auto rounded-md border bg-muted px-3 py-2 font-mono text-[12.5px] leading-5 break-words whitespace-pre-wrap text-foreground";

/** ABNT and BibTeX references with the reader's access date filled in (ACA-18). */
export function Citations({ abnt, bibtex }: { abnt: string; bibtex: string }) {
  const today = useToday();
  const d = today ? new Date(today) : null;
  const acesso = d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "(data do acesso)";
  const iso = d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : "aaaa-mm-dd";
  return (
    <>
      <div>
        <div className="font-medium text-foreground">ABNT</div>
        <pre className={pre}>{`${abnt} Acesso em: ${acesso}.`}</pre>
      </div>
      <div>
        <div className="font-medium text-foreground">BibTeX</div>
        <pre className={pre}>{bibtex.replace(/\n}$/, `,\n  urldate      = {${iso}}\n}`)}</pre>
      </div>
    </>
  );
}
