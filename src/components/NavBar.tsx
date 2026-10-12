import {
  FileSearch,
  LogOut,
  Ghost,
  ShieldCheck,
  History,
  GitCompare,
  Settings,
} from "lucide-react";

export type NavPage = "audit" | "history" | "compare" | "settings";

interface NavBarProps {
  userName: string;
  isGuest: boolean;
  isAdmin?: boolean;
  guestCredits: number | null;
  activeNav: NavPage;
  onNavChange: (page: NavPage) => void;
  onSignOut: () => void;
  onExitGuest: () => void;
}

const NAV_ITEMS: { key: NavPage; label: string; icon: typeof FileSearch }[] = [
  { key: "audit", label: "Audit Studio", icon: FileSearch },
  { key: "history", label: "History & Reports", icon: History },
  { key: "compare", label: "Compare & Diff", icon: GitCompare },
  { key: "settings", label: "Settings", icon: Settings },
];

export function NavBar({
  userName,
  isGuest,
  isAdmin,
  guestCredits,
  activeNav,
  onNavChange,
  onSignOut,
  onExitGuest,
}: NavBarProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-200/70 shadow-[0_2px_16px_-4px_rgba(15,23,42,0.04)] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div
            onClick={() => onNavChange("audit")}
            className="flex items-center gap-3 group cursor-pointer select-none"
          >
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 via-teal-500 to-emerald-500 flex items-center justify-center shadow-md shadow-teal-500/25 group-hover:scale-105 transition-all duration-300">
                <FileSearch className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-900 via-slate-800 to-slate-700 bg-clip-text text-transparent">
                  SEO Audit Pro
                </span>
                <span className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-700 border border-teal-200/60 uppercase tracking-wider">
                  Live
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">Deep Technical & On-Page Intelligence</p>
            </div>
          </div>

          {/* Center Navigation Links (Desktop) */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/60">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavChange(item.key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-white text-slate-900 shadow-xs shadow-slate-200"
                      : "text-slate-500 hover:text-slate-900 hover:bg-white/50"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User controls */}
          <div className="flex items-center gap-2.5">
            {isGuest && guestCredits !== null && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-teal-50/80 border border-teal-200/80 text-teal-700 shadow-xs animate-fade-in">
                <Ghost className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                <div className="flex items-baseline gap-1">
                  <span className="text-xs font-bold">{guestCredits}</span>
                  <span className="text-[11px] text-teal-600 font-medium">credits</span>
                </div>
              </div>
            )}

            {isGuest ? (
              <button
                onClick={onExitGuest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-600 hover:text-teal-700 hover:bg-teal-50 border border-slate-200 hover:border-teal-200 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Exit Guest</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                {/* User Pill */}
                <div
                  onClick={() => onNavChange("settings")}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100/80 border border-slate-200/80 shadow-xs cursor-pointer hover:bg-slate-200/60 transition-all"
                >
                  <div className="w-6 h-6 rounded-lg bg-teal-600 text-white flex items-center justify-center text-xs font-bold shadow-xs">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-xs font-semibold text-slate-700 max-w-[110px] truncate hidden sm:inline">
                    {userName}
                  </span>

                  {isAdmin && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-amber-500/15 to-orange-500/15 text-amber-800 border border-amber-300/60 shadow-xs">
                      <ShieldCheck className="w-3 h-3 text-amber-600" />
                      <span>Admin • 200/day</span>
                    </span>
                  )}
                </div>

                {/* Sign Out Button */}
                <button
                  onClick={onSignOut}
                  title="Sign Out"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-100 transition-all text-xs font-semibold active:scale-95 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">Sign Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-2 py-2 bg-white/95 backdrop-blur-md">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavChange(item.key)}
              className={`inline-flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
                isActive
                  ? "text-teal-700 font-extrabold"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
