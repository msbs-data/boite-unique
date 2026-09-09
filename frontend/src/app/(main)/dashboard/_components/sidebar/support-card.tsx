import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SupportCard() {
  return (
    <Card
      size="sm"
      className="overflow-hidden shadow-none group-data-[collapsible=icon]:hidden bg-muted/40 border-dashed"
    >
      <CardHeader className="min-w-0 px-3 py-2.5">
        <CardTitle className="truncate text-xs font-semibold text-primary">Cabinet Loiseau Conseil</CardTitle>
        <CardDescription className="line-clamp-3 text-[11px]">
          Démonstrateur de réception automatisée Factur-X et intégration comptable Sage.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
