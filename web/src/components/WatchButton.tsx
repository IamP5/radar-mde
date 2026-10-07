"use client";

import { Star, StarOff } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/lib/watchlist";

/** `id` is "uf/slug". Saved in this browser only (see /acompanhar). */
export default function WatchButton({ id }: { id: string }) {
  const [list, toggle] = useWatchlist();
  const [hover, setHover] = useState(false);
  const on = list.includes(id);
  return (
    <Button
      variant="outline"
      onClick={() => toggle(id)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      aria-pressed={on}
      title={on ? "Deixar de acompanhar (salvo só neste navegador)" : "Acompanhar este município (salvo só neste navegador)"}
      className={on ? "text-foreground" : undefined}
    >
      {on && hover ? (
        <StarOff className="text-muted-foreground" />
      ) : (
        <Star className={on ? "fill-warning text-warning" : "text-muted-foreground"} />
      )}
      {on ? "Acompanhando" : "Acompanhar"}
    </Button>
  );
}
