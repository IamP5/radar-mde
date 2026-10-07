"use client";

import { Star, StarOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/lib/watchlist";

/** `id` is "uf/slug". Saved in this browser only (see /acompanhar). */
export default function WatchButton({ id }: { id: string }) {
  const [list, toggle] = useWatchlist();
  // hover preview ("deixar de acompanhar") only for a real mouse: on touch, pointerenter fires on tap and never leaves
  const [hover, setHover] = useState(false);
  const [note, setNote] = useState("");
  const on = list.includes(id);
  useEffect(() => {
    if (!note) return;
    const t = setTimeout(() => setNote(""), 4000);
    return () => clearTimeout(t);
  }, [note]);
  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          toggle(id);
          setHover(false);
          setNote(on ? "Removido da sua lista de acompanhamento." : "Salvo em Acompanhar (só neste navegador).");
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-pressed={on}
        title={on ? "Deixar de acompanhar (salvo só neste navegador)" : "Acompanhar este município (salvo só neste navegador)"}
        className={on ? "text-foreground print:hidden" : "print:hidden"}
      >
        {on && hover ? (
          <StarOff className="text-muted-foreground" />
        ) : (
          <Star className={on ? "fill-warning text-warning" : "text-muted-foreground"} />
        )}
        {on ? "Acompanhando" : "Acompanhar"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {note}
      </span>
    </>
  );
}
