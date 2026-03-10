"use client";

import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

const NO_SHELL = ["/auth", "/onboarding", "/biens/", "/cgu", "/confidentialite", "/contact"];

export function Header() {
  const { theme, toggle } = useTheme();
  const pathname = usePathname();

  if (NO_SHELL.some((p) => pathname.startsWith(p))) return null;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between px-5 py-4 bg-card border-b border-border">
      {/* Logo */}
      <span className="font-mono font-bold text-xl tracking-tight">
        <span style={{ color: "var(--accent)" }}>Prop</span>
        <span className="text-text">folio</span>
      </span>

      {/* Theme toggle */}
      <button
        onClick={toggle}
        aria-label="Changer le thème"
        className="p-2 rounded-lg text-text-secondary hover:text-text hover:bg-bg transition-colors"
      >
        {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
      </button>
    </header>
  );
}
