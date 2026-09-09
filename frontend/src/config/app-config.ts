import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "La Boîte Unique",
  version: packageJson.version,
  copyright: `© ${currentYear}, Cabinet Loiseau Conseil — La Boîte Unique.`,
  meta: {
    title: "La Boîte Unique — Plateforme de Réception Factur-X & Comptabilité",
    description:
      "Automatisation de la réception de factures d'achat, extraction Factur-X et export vers Sage 100/1000.",
  },
};
