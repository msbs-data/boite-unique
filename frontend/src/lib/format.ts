/** Formatage français, sans l'espace fine insécable (U+202F) que beaucoup
 *  de polices rendent comme un artefact. On la remplace par une espace
 *  insécable ordinaire (U+00A0), qui s'affiche partout correctement. */
const propre = (s: string) => s.replace(/ /g, " ");

export const eur = (n: number, decimales = 2) =>
  propre(
    n.toLocaleString("fr-FR", {
      style: "currency",
      currency: "EUR",
      minimumFractionDigits: decimales,
      maximumFractionDigits: decimales,
    }),
  );

export const nombre = (n: number, max = 2) =>
  propre(n.toLocaleString("fr-FR", { maximumFractionDigits: max }));

export const heures = (n: number) => `${nombre(n)} h`;

export const jourLong = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return propre(
    d.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  );
};
