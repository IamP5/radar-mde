import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { City } from "@/lib/data";
import { ec119 } from "@/lib/format";

const cities: City[] = JSON.parse(readFileSync(new URL("../data/cities.json", import.meta.url), "utf8"));
const city = (id: number) => cities.find((c) => c.id === id)!;

test("EC 119 on Santo André SP's declared series is compensated by 2022 and 2023", () => {
  const p = ec119(city(3547809).years);
  assert.deepEqual(p && { below: p.below, state: p.state, short: Math.round(p.short), surplus: Math.round(p.surplus) }, {
    below: [2021],
    state: "compensated",
    short: 17736079,
    surplus: 56386266,
  });
  assert.equal(ec119(city(2513851).years), null, "Santo André PB stayed above 25% in 2020 and 2021");
});
