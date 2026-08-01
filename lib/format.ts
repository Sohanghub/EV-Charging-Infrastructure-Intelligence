/**
 * The only place decimals become percentages and floats become strings.
 * Everything upstream stays in full precision.
 */

const compact = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const plain = new Intl.NumberFormat("en-IN");

/** `128400` -> `"1,28,400"` */
export const formatNumber = (value: number) => plain.format(Math.round(value));

/** `128400` -> `"1.3L"` — for dense table cells and chart axes. */
export const formatCompact = (value: number) => compact.format(value);

/** Decimal rate -> whole percent. `0.62` -> `"62%"` */
export const formatPercent = (rate: number) => `${Math.round(rate * 100)}%`;

/** Scores and rates -> one decimal. `4.27` -> `"4.3"` */
export const formatDecimal = (value: number, digits = 1) => value.toFixed(digits);

/** `12.5` -> `"12.5L"` people. */
export const formatPopulation = (lakhs: number) => `${formatDecimal(lakhs)}L`;
