"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  Calculator,
  Bell,
  CircleUser,
} from "lucide-react";

const TABS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Mes biens", href: "/biens", icon: Building2 },
  { label: "Simuler", href: "/simulation", icon: Calculator },
  { label: "Alertes", href: "/alertes", icon: Bell },
  { label: "Profil", href: "/profil", icon: CircleUser },
];

const NO_SHELL = ["/auth", "/onboarding", "/biens/nouveau", "/cgu", "/confidentialite", "/contact"];

export function BottomNav() {
  const pathname = usePathname();

  if (NO_SHELL.some((p) => pathname.startsWith(p))) return null;

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 bg-card border-t border-border">
      <ul className="flex items-stretch h-16">
        {TABS.map(({ label, href, icon: Icon }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center justify-center gap-1 h-full w-full text-[10px] font-medium transition-colors ${
                  active
                    ? "text-accent"
                    : "text-text-secondary hover:text-text"
                }`}
              >
                <Icon
                  size={22}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
