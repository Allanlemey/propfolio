"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Bell } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const NO_SHELL = ["/auth", "/onboarding", "/biens/", "/cgu", "/confidentialite", "/contact"];

export function Header() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  if (NO_SHELL.some((p) => pathname.startsWith(p))) return null;

  const alertesActive = pathname === "/alertes";

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 glass">
      {/* Logo */}
      <Link href="/dashboard" className="font-mono font-bold text-xl tracking-tight">
        <span style={{ color: "var(--accent)" }}>Prop</span>
        <span className="text-text">folio</span>
      </Link>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <Link
          href="/alertes"
          aria-label="Alertes"
          className={`p-2 rounded-lg transition-colors ${
            alertesActive
              ? "text-accent bg-accent/10"
              : "text-text-secondary hover:text-text hover:bg-bg"
          }`}
        >
          <Bell size={20} strokeWidth={alertesActive ? 2.2 : 1.8} />
        </Link>

        <button
          onClick={toggle}
          aria-label="Changer le thème"
          className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-bg transition-colors"
        >
          {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </div>
    </header>
  );
}
