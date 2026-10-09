"use client";

import { Star, StarOff } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/lib/watchlist";
import { cn } from "@/lib/utils";

/** `id` is "uf/slug". Saved in this browser only (see /acompanhar, "Municípios salvos"). */
export default function WatchButton({ id, className }: { id: string; className?: string }) {
  const [list, toggle] = useWatchlist();
  // hover preview ("remover") only for a real mouse: on touch, pointerenter fires on tap and never leaves
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
          setNote(on ? "Removido dos municípios salvos." : "Salvo em Municípios salvos (só neste navegador).");
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && setHover(true)}
        onPointerLeave={() => setHover(false)}
        aria-pressed={on}
        title={on ? "Remover dos salvos (salvo só neste navegador)" : "Salvar este município para ver depois (só neste navegador)"}
        className={cn(on ? "text-foreground print:hidden" : "print:hidden", className)}
      >
        {on && hover ? (
          <StarOff className="text-muted-foreground" />
        ) : (
          <Star className={on ? "fill-warning text-warning" : "text-muted-foreground"} />
        )}
        {on ? (hover ? "Remover" : "Salvo") : "Salvar"}
      </Button>
      <span className="sr-only" role="status" aria-live="polite">
        {note}
      </span>
    </>
  );
}
