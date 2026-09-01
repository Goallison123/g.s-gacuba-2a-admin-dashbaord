import { useState } from 'react';
import {
  LayoutDashboard,
  School,
  Layers,
  BookOpen,
  Users,
  Clock,
  GraduationCap,
  ClipboardCheck,
  BarChart3,
  FileText,
  Settings,
  Menu,
  X,
  ChevronRight,
} from 'lucide-react';
import { useSchoolData, resetData } from '@/store';
import { ConfirmDialog } from '@/components/Modal';

export type PageId =
  | 'dashboard'
  | 'school'
  | 'classes'
  | 'subjects'
  | 'staff'
  | 'timetable'
  | 'students'
  | 'assessments'
  | 'results'
  | 'reports'
  | 'settings';

interface NavItem {
  id: PageId;
  label: string;
  icon: typeof LayoutDashboard;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'school', label: 'School', icon: School },
  { id: 'classes', label: 'Classes', icon: Layers },
  { id: 'subjects', label: 'Subjects', icon: BookOpen },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'timetable', label: 'Timetable', icon: Clock },
  { id: 'students', label: 'Students', icon: GraduationCap },
  { id: 'assessments', label: 'Assessments', icon: ClipboardCheck },
  { id: 'results', label: 'Results', icon: BarChart3 },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
];

interface DashboardLayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: React.ReactNode;
}

export function DashboardLayout({ currentPage, onNavigate, children }: DashboardLayoutProps) {
  const data = useSchoolData();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const schoolName = data.profile?.name || 'S4Me';
  const initials = schoolName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const currentNav = NAV_ITEMS.find((n) => n.id === currentPage);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 relative">
      {/* Sidebar - desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
        <SidebarContent
          schoolName={schoolName}
          initials={initials}
          currentPage={currentPage}
          onNavigate={onNavigate}
          onReset={() => setShowReset(true)}
        />
      </aside>

      {/* Sidebar - mobile */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-navy-950/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-64 border-r border-slate-200 bg-white">
            <SidebarContent
              schoolName={schoolName}
              initials={initials}
              currentPage={currentPage}
              onNavigate={(p) => {
                onNavigate(p);
                setMobileOpen(false);
              }}
              onReset={() => {
                setShowReset(true);
                setMobileOpen(false);
              }}
            />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 lg:hidden"
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <span className="hidden sm:inline">S4Me</span>
              <ChevronRight size={14} className="hidden sm:inline" />
              <span className="font-medium text-navy-900">{currentNav?.label}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-navy-900">Administrator</p>
              <p className="text-xs text-slate-400">School Admin</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-100 text-sm font-semibold text-navy-700">
              AD
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <ConfirmDialog
        open={showReset}
        onClose={() => setShowReset(false)}
        onConfirm={resetData}
        title="Reset all data?"
        message="This will permanently delete all school data, including classes, staff, students, and timetables. This cannot be undone."
        confirmLabel="Reset everything"
        danger
      />
    </div>
  );
}

function SidebarContent({
  schoolName,
  initials,
  currentPage,
  onNavigate,
  onReset,
}: {
  schoolName: string;
  initials: string;
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-navy-800 text-sm font-bold text-white">
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-navy-900">{schoolName}</p>
          <p className="text-xs text-slate-400">S4Me Platform</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto scrollbar-thin p-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`nav-item w-full ${active ? 'nav-item-active' : ''}`}
            >
              <Icon size={18} className={active ? 'text-navy-700' : 'text-slate-400'} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 p-3">
        <button onClick={onReset} className="nav-item w-full text-error-600 hover:bg-error-50 hover:text-error-700">
          <X size={18} />
          Reset school data
        </button>
      </div>
    </>
  );
}
