import { ScanSearch, FileSearch, LogOut, User as UserIcon, Ghost } from "lucide-react";

export type NavPage = "audit";

interface NavBarProps {
  userName: string;
  isGuest: boolean;
  guestCredits: number | null;
  onSignOut: () => void;
  onExitGuest: () => void;
}

export function NavBar({ userName, isGuest, guestCredits, onSignOut, onExitGuest }: NavBarProps) {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-600 flex items-center justify-center shadow-sm">
              <FileSearch className="w-5 h-5 text-white" />
            </div>
            <span className="text-base font-bold text-slate-800">SEO Audit Pro</span>
          </div>

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
                  <span className="text-sm text-slate-600 font-medium max-w-[120px] truncate">{userName}</span>
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
    </header>
  );
}
