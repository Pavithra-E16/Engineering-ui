import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  Building2,
  FileBarChart,
  GraduationCap,
  Settings as SettingsIcon,
  Sparkles,
  Users,
  CheckCheck,
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Menu,
  Moon,
  Sun,
  User as UserIcon,
  X,
} from 'lucide-react';
import { useAuth } from '../auth/AuthProvider';
import { useTheme } from '../theme';
import { useData } from '../data/store';
import { MODULES, canAccess, roleLabel } from '../lib/roles';
import { cn, fmtDateTime, initials } from '../lib/utils';
import { Alert, ICONS, Spinner, useConfirm } from '../components/ui';

const GROUPS = ['Main', 'Academic Management', 'Administration', 'Student Services', 'AI Features', 'Reports', 'Settings'];
const GROUP_ICONS = {
  'Academic Management': GraduationCap,
  Administration: Building2,
  'Student Services': Users,
  'AI Features': Sparkles,
  Reports: FileBarChart,
  Settings: SettingsIcon,
};

/** Shared sign-out flow: confirm → audit → terminate session → redirect. */
export function useSignOut() {
  const { signOut } = useAuth();
  const { audit } = useData();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return async () => {
    const ok = await confirm({
      title: 'Sign out',
      message: 'Are you sure you want to sign out?',
      confirmLabel: 'Sign Out',
      cancelLabel: 'Cancel',
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await audit('Signed out', 'Session');
    } catch {
      /* best effort */
    }
    await signOut('user');
    navigate('/login', { replace: true });
  };
}

function useOutside(ref, cb) {
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) cb();
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref, cb]);
}

function Sidebar({ collapsed, setCollapsed, mobileOpen, setMobileOpen }) {
  const { user } = useAuth();
  const { settings } = useData();
  const location = useLocation();
  useEffect(() => setMobileOpen(false), [location.pathname, setMobileOpen]);
  const visible = MODULES.filter((m) => canAccess(user?.role, m.id));
  const activeGroup = [...visible].sort((x, y) => y.path.length - x.path.length).find((m) => location.pathname.startsWith(m.path))?.group;
  // Accordion: only one main menu open at a time; the menu of the current page opens automatically.
  const [openGroup, setOpenGroup] = useState(activeGroup);
  useEffect(() => setOpenGroup(activeGroup), [activeGroup]);
  const toggleGroup = (g) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroup(g);
      return;
    }
    setOpenGroup((cur) => (cur === g ? null : g));
  };
  const link = (m, sub) => {
    const Icon = ICONS[m.icon];
    return (
      <NavLink
        key={m.id}
        to={m.path}
        end={m.path === '/settings'}
        title={collapsed ? m.label : undefined}
        className={({ isActive }) => cn(sub ? 'nav-sub' : 'nav-link', isActive && 'active')}
      >
        <Icon />
        <span className="label">{m.label}</span>
      </NavLink>
    );
  };

  return (
    <>
      {mobileOpen && <div className="backdrop" onClick={() => setMobileOpen(false)} />}
      <aside className={cn('sidebar', collapsed && 'collapsed', mobileOpen && 'open')}>
        <div className="sidebar-brand">
          <span className="brand-icon">
            <GraduationCap />
          </span>
          <div className="text" style={{ minWidth: 0 }}>
            <p className="name truncate">EduERP</p>
            <p className="sub truncate" title={settings.institutionName}>
              Engineering College
            </p>
          </div>
          <button className="icon-btn sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {GROUPS.map((g) => {
            const items = visible.filter((m) => m.group === g);
            if (!items.length) return null;
            // Dashboard and single-page sections are shown as top-level items.
            if (g === 'Main' || items.length === 1) return items.map((m) => link(m, false));
            const GroupIcon = GROUP_ICONS[g];
            const open = openGroup === g && !collapsed;
            const hasActive = activeGroup === g;
            return (
              <div key={g} className={cn('nav-group', open && 'open')}>
                <button
                  className={cn('nav-group-btn', (open || (collapsed && hasActive)) && 'expanded')}
                  onClick={() => toggleGroup(g)}
                  title={collapsed ? g : undefined}
                  aria-expanded={open}
                >
                  <GroupIcon />
                  <span className="label">{g.replace(' Management', '')}</span>
                  <ChevronDown className="chev" />
                </button>
                {open && <div className="nav-subs">{items.map((m) => link(m, true))}</div>}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <button
            className="collapse-btn"
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? (
              <ChevronsRight />
            ) : (
              <>
                <ChevronsLeft />
                <span className="label">Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';
  return (
    <button
      className="icon-btn theme-btn"
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}

function Notifications() {
  const { user } = useAuth();
  const { db, update } = useData();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const mine = useMemo(
    () =>
      db.notifications
        .filter((n) => n.active !== false && (n.userId ? n.userId === user?.id : n.role ? n.role === user?.role : true))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [db.notifications, user],
  );
  const isRead = (n) => n.readBy?.includes(user.id);
  const unread = mine.filter((n) => !isRead(n)).length;
  const markRead = (ids) =>
    ids.forEach((id) => {
      const n = mine.find((x) => x.id === id);
      if (!isRead(n)) update('notifications', id, { readBy: [...(n.readBy ?? []), user.id] }, { audit: false });
    });
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${unread} unread)`}>
        <Bell />
        {unread > 0 && <span className="badge-dot">{unread}</span>}
      </button>
      {open && (
        <div className="dropdown" style={{ width: 'min(92vw, 360px)' }}>
          <div className="dropdown-head">
            <span>Notifications</span>
            {unread > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={() => markRead(mine.map((n) => n.id))}>
                <CheckCheck />
                Mark all read
              </button>
            )}
          </div>
          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {mine.length === 0 && (
              <p className="muted text-center" style={{ padding: 24 }}>
                You're all caught up.
              </p>
            )}
            {mine.slice(0, 20).map((n) => (
              <button
                key={n.id}
                className={cn('dropdown-item', !isRead(n) && 'unread')}
                style={{ display: 'block' }}
                onClick={() => {
                  markRead([n.id]);
                  setOpen(false);
                  if (n.link) navigate(n.link);
                }}
              >
                <p className="strong">{n.title}</p>
                <p className="small muted">{n.message}</p>
                <p className="xs muted mt-8">{fmtDateTime(n.createdAt)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileMenu() {
  const { user, mode } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOutside(ref, () => setOpen(false));
  const doSignOut = useSignOut();
  if (!user) return null;
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="profile-btn" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}>
        <span className="avatar">{initials(user.name)}</span>
        <span className="who">
          <b>{user.name}</b>
          <span>{roleLabel(user.role)}</span>
        </span>
        <ChevronDown className="icon-16" />
      </button>
      {open && (
        <div role="menu" className="dropdown" style={{ width: 250 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line-2)' }}>
            <p className="strong truncate">{user.name}</p>
            <p className="small muted truncate">{user.email}</p>
            <span className="badge tone-blue mt-8">
              {roleLabel(user.role)}
              {mode === 'demo' ? ' · Demo' : ''}
            </span>
          </div>
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="dropdown-item"
            role="menuitem"
            style={{ justifyContent: 'flex-start' }}
          >
            <UserIcon />
            My Profile
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              doSignOut();
            }}
            className="dropdown-item danger"
            role="menuitem"
            style={{ justifyContent: 'flex-start', borderBottom: 0 }}
          >
            <LogOut />
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}

export function AppLayout() {
  const { db, ayId, setAyId, ready, error } = useData();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('kvce.user.sidebar') === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem('kvce.user.sidebar', collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);
  const mod = [...MODULES].sort((a, b) => b.path.length - a.path.length).find((m) => location.pathname.startsWith(m.path));
  const pageTitle = location.pathname.startsWith('/profile')
    ? 'My Profile'
    : location.pathname.startsWith('/students/')
      ? 'Student 360° Profile'
      : (mod?.label ?? 'Page');
  useEffect(() => {
    document.title = `${pageTitle} · EduERP`;
  }, [pageTitle]);

  return (
    <div className="app-shell">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      <div className={cn('main', collapsed && 'collapsed')}>
        <header className="topbar">
          <div className="topbar-inner">
            <button className="icon-btn menu-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
              <Menu />
            </button>
            <nav className="crumbs" aria-label="Breadcrumb">
              <Link to="/dashboard">Dashboard</Link>
              {mod && mod.group !== 'Main' && (
                <>
                  <span className="sep">/</span>
                  <span>{mod.group.replace(' Management', '')}</span>
                </>
              )}
              {pageTitle !== 'Dashboard' && (
                <>
                  <span className="sep">/</span>
                  <b>{pageTitle}</b>
                </>
              )}
            </nav>
            <div className="topbar-right">
              <select className="ay-select" value={ayId} onChange={(e) => setAyId(e.target.value)} aria-label="Academic year">
                {db.academicYears.map((a) => (
                  <option key={a.id} value={a.id}>
                    AY {a.name}
                    {a.current ? ' (current)' : ''}
                  </option>
                ))}
              </select>
              <ThemeToggle />
              <Notifications />
              <ProfileMenu />
            </div>
          </div>
        </header>
        <main className="content">
          {error && (
            <div className="mb-16">
              <Alert tone="error" title="Data error">
                {error}
              </Alert>
            </div>
          )}
          {ready ? (
            <Suspense fallback={<Spinner className="page" />}>
              <Outlet />
            </Suspense>
          ) : (
            <Spinner label="Loading institutional data…" className="page" />
          )}
        </main>
      </div>
    </div>
  );
}
