/**
 * Santo André figures published in Silva, A. Z. (UNINOVE, 2021).
 * mde: Figura 42, % applied in MDE as audited by TCE-SP (2010–2019).
 * fun: Figura 40, % of Fundeb paid to education professionals, from SIOPE/Inep (2009–2019).
 */
export const THESIS_SANTO_ANDRE_ID = 3547809;

export const THESIS_SANTO_ANDRE: Record<number, { mde?: number; fun: number }> = {
  2009: { fun: 80.74 },
  2010: { mde: 23.9, fun: 79.55 },
  2011: { mde: 25.55, fun: 84.48 },
  2012: { mde: 24.87, fun: 87.97 },
  2013: { mde: 25.03, fun: 83.84 },
  2014: { mde: 24.84, fun: 88.97 },
  2015: { mde: 25.21, fun: 88.39 },
  2016: { mde: 21.87, fun: 80.62 },
  2017: { mde: 25.25, fun: 83.06 },
  2018: { mde: 26.37, fun: 88.97 },
  2019: { mde: 25.92, fun: 85.79 },
};

export const THESIS_URL =
  "https://bibliotecatede.uninove.br/bitstream/tede/2464/2/Adriana%20Zanini%20da%20Silva.pdf";
