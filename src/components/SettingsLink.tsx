"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Glyph from "@/components/Glyph";

/**
 * Sidebar entry for Settings. A client component only so it can mark
 * itself active — everything else about it is a plain link.
 */
export default function SettingsLink({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = pathname === "/dashboard/settings";

  return (
    <Link
      href="/dashboard/settings"
      onClick={onNavigate}
      data-active={active}
      aria-current={active ? "page" : undefined}
      className="nav-item w-full text-xs"
    >
      <span className="flex w-4 shrink-0 justify-center" aria-hidden>
        <Glyph name="settings" size={14} />
      </span>
      Settings
    </Link>
  );
}
