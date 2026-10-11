import { FileSearch, LogOut, User as UserIcon, Ghost, PenLine, ShieldCheck, Mail } from "lucide-react";

export type NavPage = "audit" | "content" | "plagiarism" | "contact";

interface NavBarProps {
  userName: string;
  isGuest: boolean;
  guestCredits: number | null;
  activeNav: NavPage;
  onNavChange: (page: NavPage) => void;
  onSignOut: () => void;
  onExitGuest: () => void;
}

const NAV_ITEMS: { key: NavPage; label: string; icon: typeof FileSearch }[] = [
  { key: "audit", label: "SEO Audit", icon: FileSearch },
  { key: "content", label: "Content Generator", icon: PenLine },
  { key: "plagiarism", label: "Plagiarism", icon: ShieldCheck },
  { key: "contact", label: "Contact Us", icon: Mail },
];

export function NavBar({
  userName,
  isGuest,
  guestCredits,
  activeNav,
  onNavChange,
  onSignOut,
  onExitGuest,
}: NavBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-2.5 cursor-pointer"
            onClick={() => onNavChange("audit")}
          >
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
              <FileSearch className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold text-slate-800">SEO Audit Pro</span>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onNavChange(item.key)}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-medium transition-all ${
                    isActive
                      ? "bg-teal-50 text-teal-700 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "text-teal-600" : "text-slate-400"}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* User controls */}
          <div className="flex items-center gap-3">
            {isGuest && guestCredits !== null && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200">
                <Ghost className="w-3.5 h-3.5 text-teal-600" />
                <span className="text-xs text-teal-700 font-medium">{guestCredits} credits</span>
              </div>
            )}
            {isGuest ? (
              <button
                onClick={onExitGuest}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-teal-600 hover:bg-teal-50 transition-all text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Exit Guest</span>
              </button>
            ) : (
              <>
                <div className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-100">
                  <UserIcon className="w-4 h-4 text-slate-400" />
                  <span className="text-sm text-slate-600 font-medium max-w-[120px] truncate">
                    {userName}
                  </span>
                </div>
                <button
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-all text-sm font-medium"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile nav bar */}
      <div className="md:hidden flex items-center justify-around border-t border-slate-100 px-2 py-1.5 bg-white">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onNavChange(item.key)}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
