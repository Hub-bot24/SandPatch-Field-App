"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconTarget, IconList, IconBriefcase, IconDownload } from "@/components/icons";

const TABS = [
  { href: "/", label: "New Test", Icon: IconTarget },
  { href: "/records", label: "Records", Icon: IconList },
  { href: "/job", label: "Job", Icon: IconBriefcase },
  { href: "/export", label: "Export", Icon: IconDownload },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-navy">
      <ul className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                className={`flex flex-col items-center gap-1 py-2.5 text-xs font-semibold ${
                  active ? "text-brand" : "text-white/70"
                }`}
              >
                <Icon className="h-6 w-6" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
