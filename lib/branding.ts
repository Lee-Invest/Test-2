/**
 * Single source of truth for brand identity. Swap these values to re-skin
 * the whole app for a different brand name without touching component code.
 */
export const branding = {
  name: "ApexFund",
  shortName: "Apex",
  tagline: "Trade our capital. Keep the upside.",
  supportEmail: "support@apexfund.example",
  legalEntity: "ApexFund Trading Ltd.",
  colors: {
    primary: "#5B4EFF",
    accent: "#17B978",
  },
} as const;
