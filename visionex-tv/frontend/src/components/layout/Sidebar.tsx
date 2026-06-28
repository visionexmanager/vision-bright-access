"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Tv, Home, Search, Heart, List,
  Clock, Settings, LogOut, ChevronRight,
} from "lucide-react";
import { clsx } from "clsx";
import { useAuthStore } from "@/store/auth.store";

const NAV = [
  { href: "/tv",             icon: Home,   label: "Home" },
  { href: "/tv/search",      icon: Search, label: "Search" },
  { href: "/tv/favorites",   icon: Heart,  label: "Favorites" },
  { href: "/tv/history",     icon: Clock,  label: "History" },
  { href: "/tv/playlists",   icon: List,   label: "Playlists" },
  { href: "/tv/settings",    icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const pathname = usePathname();
  const logout   = useAuthStore(s => s.logout);

  return (
    <aside className="hidden lg:flex flex-col w-64 min-h-screen bg-vx-surface border-r border-vx-border p-4">
      {/* Logo */}
      <Link href="/tv" className="flex items-center gap-3 px-2 mb-8">
        <div className="w-9 h-9 bg-vx-accent rounded-lg flex items-center justify-center">
          <Tv className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-bold text-base leading-none">Visionex</p>
          <p className="text-vx-accent text-xs font-semibold">TV</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group relative",
                active
                  ? "bg-vx-accent text-white"
                  : "text-vx-muted hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {label}
              {active && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute right-3"
                >
                  <ChevronRight className="w-3 h-3" />
                </motion.div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-vx-muted hover:text-vx-accent hover:bg-vx-accent/10 transition-all"
      >
        <LogOut className="w-4 h-4" />
        Sign Out
      </button>
    </aside>
  );
}
