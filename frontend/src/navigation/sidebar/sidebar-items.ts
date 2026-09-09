import { Banknote, FolderOpen, LayoutDashboard, type LucideIcon, Mail, ReceiptText, ShieldAlert, Users, Wallet } from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
}

export const sidebarItems: NavGroup[] = [
  {
    id: 1,
    label: "Cabinet Comptable",
    items: [
      {
        id: "dashboard",
        title: "Tableau de bord",
        url: "/dashboard/default",
        icon: LayoutDashboard,
      },
      {
        id: "boite",
        title: "Boîte de réception",
        url: "/dashboard/boite",
        icon: Mail,
      },
      {
        id: "pieces",
        title: "Tableau des pièces",
        url: "/dashboard/pieces",
        icon: ReceiptText,
      },
      {
        id: "facturation",
        title: "Facturation client",
        url: "/dashboard/facturation",
        icon: Wallet,
      },
      {
        id: "paie",
        title: "Paie — collecte",
        url: "/dashboard/paie",
        icon: Users,
      },
      {
        id: "sage",
        title: "Export vers Sage",
        url: "/dashboard/sage",
        icon: Banknote,
      },
    ],
  },
  {
    id: 2,
    label: "Gestion & Sécurité",
    items: [
      {
        id: "dossiers",
        title: "Dossiers clients",
        url: "/dashboard/dossiers",
        icon: FolderOpen,
      },
      {
        id: "quarantaine",
        title: "Quarantaine",
        url: "/dashboard/quarantaine",
        icon: ShieldAlert,
      },
    ],
  },
];
