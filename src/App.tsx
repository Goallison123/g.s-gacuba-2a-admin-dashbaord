import React, { Suspense, useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink } from 'react-router-dom';
import JSZip from 'jszip';
import {
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CircleHelp,
  GalleryHorizontal,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Settings,
  Users,
  UserCog,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { View, Contact, Campaign, Content, Inquiry, WorkspaceSettings } from '@/types';
import { SCHOOL_NAME, AUTH_KEY } from '@/lib/constants';
import { downloadBlob } from '@/utils/helpers';
import Campaigns from '@/pages/Campaigns';
import Contacts from '@/pages/Contacts';
import ContentManager from '@/pages/ContentManager';
import Inquiries from '@/pages/Inquiries';
import Students from '@/pages/Students';
import TeacherStudentRegister from '@/pages/TeacherStudentRegister';
import HeadmasterOverview from '@/pages/HeadmasterOverview';
import UserManagement from '@/pages/UserManagement';
import NotificationModal from '@/components/modals/NotificationModal';
import ContentModal from '@/components/modals/ContentModal';
import SettingsModal from '@/components/modals/SettingsModal';
import HelpModal from '@/components/modals/HelpModal';
import LoginScreen from '@/components/LoginScreen';
import Avatar from '@/components/ui/Avatar';
import IconButton from '@/components/ui/IconButton';

const MidTermEngine = React.lazy(() => import('@/pages/MidTermEngine'));

function mapStudentToParentContact(row: Record<string, unknown>): Contact {
  return {
    id: String(row.id),
    parent_name: String(row.parent_name ?? ''),
    student_name: String(row.full_name ?? ''),
    class_name: String(row.class_name ?? ''),
    phone: String(row.phone ?? ''),
    email: String(row.email ?? ''),
    preferred_channel: 'SMS',
    status: 'Active',
    created_at: String(row.created_at ?? ''),
  };
}

type SchoolRole = 'dean_of_studies' | 'headteacher' | 'teacher' | 'it' | 'unknown';

function parseSchoolRole(value: unknown): SchoolRole {
  if (typeof value !== 'string') return 'unknown';
  const role = value.trim().toLowerCase().replace(/[ -]+/g, '_');
  return role === 'dean_of_studies' ? 'dean_of_studies'
    : role === 'headteacher' ? 'headteacher'
      : role === 'teacher' ? 'teacher'
        : role === 'it' ? 'it' : 'unknown';
}

// initial data is loaded from Supabase at runtime; remove hard-coded seeds so the
// application uses the canonical database source of truth

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true');
  const [user, setUser] = useState<{ id?: string; email?: string | null; full_name?: string | null; role?: string | null } | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [content, setContent] = useState<Content[]>([]);
  const [editingContent, setEditingContent] = useState<Content | null>(null);
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNotification, setShowNotification] = useState(false);
  const [showContentForm, setShowContentForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => {
    async function loadData() {
      if (!authed || !user?.role) return;
      if (!supabase) {
        setLoading(false);
        return;
      }
      const deanRole = ['dean_of_studies', 'it'].includes(user.role);
      const headteacherRole = user.role === 'headteacher';
      setLoading(true);
      setContacts([]);
      const [studentsResult, campaignsResult, galleryResult, newsResult, inquiriesResult, settingsResult] = await Promise.all([
        deanRole || headteacherRole
          ? supabase.from('school_students').select('id, parent_name, full_name, class_name, phone, email, created_at').order('created_at', { ascending: false }).limit(5000)
          : supabase.from('school_students').select('id, full_name, class_name').order('class_name').limit(5000),
        deanRole || headteacherRole ? supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        deanRole ? supabase.from('gallery_items').select('*').order('updated_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        deanRole ? supabase.from('news_items').select('*').order('published_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        deanRole ? supabase.from('school_inquiries').select('*').order('created_at', { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
        deanRole ? supabase.from('workspace_settings').select('*').limit(1) : Promise.resolve({ data: [] }),
      ]).catch((err) => {
        console.error('Failed to load initial data', err);
        return [ { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] } ];
      });
      if (deanRole || headteacherRole) setContacts((studentsResult?.data ?? []).map((row) => mapStudentToParentContact(row as unknown as Record<string, unknown>)));
      if (campaignsResult?.data) setCampaigns(campaignsResult.data as Campaign[]);
      if (galleryResult?.data && newsResult?.data) setContent([...(galleryResult.data as Content[]), ...(newsResult.data as Content[])]);
      if (inquiriesResult?.data) setInquiries(inquiriesResult.data as Inquiry[]);
      if (settingsResult?.data?.length) setSettings(settingsResult.data[0] as WorkspaceSettings);
      setLoading(false);
    }
    void loadData();
  }, [authed, user?.role]);

  useEffect(() => {
    if (!supabase || !['dean_of_studies', 'it'].includes(user?.role ?? '')) return;
    const client = supabase;
    const channel = client
      .channel('student-registry-parent-contacts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'school_students' }, async () => {
        const { data, error } = await client
          .from('school_students')
          .select('id, parent_name, full_name, class_name, phone, email, created_at')
          .order('created_at', { ascending: false })
          .limit(5000);
        if (error) {
          console.error('Failed to refresh parent contacts from student registry', error);
          return;
        }
        setContacts((data ?? []).map((row) => mapStudentToParentContact(row as unknown as Record<string, unknown>)));
      })
      .subscribe();
    return () => { void client.removeChannel(channel); };
  }, [user?.role]);

  useEffect(() => {
    if (!supabase || !['dean_of_studies', 'headteacher', 'it'].includes(user?.role ?? '') || !['/contacts', '/campaigns'].includes(location.pathname)) return;
    let cancelled = false;
    async function refreshRegistryContacts() {
      const { data, error } = await supabase!
        .from('school_students')
        .select('id, parent_name, full_name, class_name, phone, email, created_at')
        .order('created_at', { ascending: false })
        .limit(5000);
      if (cancelled) return;
      if (error) {
        console.error('Failed to refresh contacts from the student registry', error);
        return;
      }
      setContacts((data ?? []).map((row) => mapStudentToParentContact(row as unknown as Record<string, unknown>)));
    }
    void refreshRegistryContacts();
    return () => { cancelled = true; };
  }, [location.pathname, user?.role]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  function LoadingScreen() {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p className="loading-label">Loading workspace...</p>
      </div>
    );
  }

  async function saveCampaign(campaign: Omit<Campaign, 'id' | 'created_at'>, dispatch: { fingerprint: string; recipientIds: string[] }) {
    if (!supabase) {
      notify('Unable to save: database is not configured.');
      return;
    }
    if (!(isDean || role === 'headteacher')) {
      notify('Your role cannot create SMS campaigns.');
      return;
    }
    const { data: ledger, error: ledgerError } = await supabase.from('sms_campaign_dispatches')
      .insert({ fingerprint: dispatch.fingerprint, recipient_ids: dispatch.recipientIds, created_by: user?.id ?? null })
      .select('id').maybeSingle();
    if (ledgerError || !ledger) {
      notify(ledgerError?.code === '23505' ? 'This message has already been queued for the same recipients.' : `Could not validate SMS dispatch: ${ledgerError?.message ?? 'Unknown error.'}`);
      return;
    }
    const { data, error } = await supabase.from('notification_campaigns').insert(campaign).select().maybeSingle();
    if (error || !data) {
      console.error('Failed to save campaign', error);
      await supabase.from('sms_campaign_dispatches').delete().eq('id', ledger.id);
      notify('Failed to save notification.');
      return;
    }
    await supabase.from('sms_campaign_dispatches').update({ campaign_id: data.id }).eq('id', ledger.id);
    setCampaigns((items) => [data as Campaign, ...items]);
    setShowNotification(false);
    notify(campaign.status === 'Scheduled' ? 'Campaign scheduled successfully.' : 'Campaign saved as a draft. Connect a delivery provider to send it.');
  }

  async function deleteCampaign(id: string) {
    if (!supabase) {
      notify('Unable to delete: database is not configured.');
      return;
    }
    const { error } = await supabase.from('notification_campaigns').delete().eq('id', id).throwOnError();
    if (error) {
      console.error('Failed to delete campaign', error);
      notify('Failed to delete notification.');
      return;
    }
    setCampaigns((items) => items.filter((item) => item.id !== id));
    notify('Notification deleted.');
  }

  async function saveContent(item: Omit<Content, 'id' | 'created_at'> & Partial<Pick<Content, 'id'>>) {
    if (!supabase) {
      notify('Unable to save: database is not configured.');
      return;
    }

    const adminName = settings?.admin_name || user?.full_name || user?.email || 'Administrator';
    const payload = {
      ...item,
      author: item.author || adminName,
      image_url: item.image_url || item.image,
      src: item.src || item.image_url || item.image,
      status: item.status ?? 'Draft',
      published_at: item.published_at,
      updated_at: new Date().toISOString(),
    };

    const targetTable = item.content_type === 'Gallery' ? 'gallery_items' : 'news_items';
    const dbData = item.id
      ? {
          title: payload.title,
          category: payload.category,
          description: payload.description,
          status: payload.status,
          src: payload.src,
          image_url: payload.image_url,
          date: payload.date,
          summary: payload.summary,
          content: payload.content || [],
          author: payload.author,
          read_time: payload.read_time,
          published_at: payload.published_at,
          updated_at: payload.updated_at,
        }
      : item.content_type === 'Gallery'
        ? {
            src: payload.src,
            title: payload.title,
            category: payload.category,
            description: payload.description,
            status: payload.status,
            order: 0,
          }
        : {
            title: payload.title,
            date: payload.date,
            category: payload.category,
            summary: payload.summary,
            content: payload.content || [],
            author: payload.author,
            read_time: payload.read_time,
            image_url: payload.image_url,
            status: payload.status,
            published_at: payload.published_at,
          };

    const response = item.id
      ? await supabase.from(targetTable).update(dbData).eq('id', item.id).select().maybeSingle()
      : await supabase.from(targetTable).insert(dbData).select().maybeSingle();

    const { data, error } = response;
    if (error || !data) {
      console.error('Failed to save content', error);
      notify('Failed to save content.');
      return;
    }

    setContent((items) => item.id
      ? items.map((existing) => existing.id === item.id ? data as Content : existing)
      : [data as Content, ...items]);
    setEditingContent(null);
    setShowContentForm(false);
    notify(item.id ? 'Content updated successfully.' : 'Content saved to your website workspace.');
  }

  async function saveSettings(values: { admin_name: string; default_notification_channel: string }) {
    if (!supabase) {
      notify('Unable to save settings: database is not configured.');
      return;
    }

    const payload = {
      id: '00000000-0000-0000-0000-000000000001',
      admin_name: values.admin_name,
      default_notification_channel: values.default_notification_channel,
    };
    const { data, error } = await supabase.from('workspace_settings').upsert(payload, { onConflict: 'id' }).select().maybeSingle();
    if (error || !data) {
      console.error('Failed to save settings', error);
      notify('Failed to save settings.');
      return;
    }
    setSettings(data as WorkspaceSettings);
    notify('Settings saved successfully.');
  }

  async function deleteContent(id: string) {
    if (!supabase) {
      notify('Unable to delete content: database is not configured.');
      return;
    }

    const galleryDelete = await supabase.from('gallery_items').delete().eq('id', id);
    const newsDelete = await supabase.from('news_items').delete().eq('id', id);
    const error = galleryDelete.error || newsDelete.error;

    if (error) {
      console.error('Failed to delete content', error);
      notify('Failed to delete content.');
      return;
    }
    setContent((items) => items.filter((item) => item.id !== id));
    notify('Content deleted.');
  }

  async function publishContent(id: string) {
    if (!supabase) {
      notify('Unable to publish: database is not configured.');
      return;
    }
    const published_at = new Date().toISOString();

    const galleryUpdate = await supabase.from('gallery_items').update({ status: 'Published', updated_at: published_at }).eq('id', id).select().maybeSingle();
    const newsUpdate = await supabase.from('news_items').update({ status: 'Published', published_at }).eq('id', id).select().maybeSingle();
    const data = galleryUpdate.data || newsUpdate.data;
    const error = galleryUpdate.error || newsUpdate.error;

    if (error || !data) {
      console.error('Failed to publish content', error);
      notify('Failed to publish content.');
      return;
    }
    setContent((items) => items.map((c) => c.id === id ? data as Content : c));
    notify('Content published to your website.');
  }

  async function exportContacts(format: 'xls' | 'ods') {
    const headers = ['Parent name', 'Student name', 'Class', 'Phone', 'Email'];
    const rows = contacts.map((contact) => [contact.parent_name, contact.student_name, contact.class_name, contact.phone, contact.email]);
    if (format === 'xls') {
      const table = `<table><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr>${rows.map((row) => `<tr>${row.map((value) => `<td>${value}</td>`).join('')}</tr>`).join('')}</table>`;
      downloadBlob(new Blob([`<html><meta charset="utf-8"><body>${table}</body></html>`], { type: 'application/vnd.ms-excel' }), 'gacuba-contacts.xls');
    } else {
      const zip = new JSZip();
      zip.file('mimetype', 'application/vnd.oasis.opendocument.spreadsheet');
      zip.file('content.xml', `<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:spreadsheet><table:table table:name="Contacts"><table:table-row>${headers.map((header) => `<table:table-cell office:value-type="string"><text:p>${header}</text:p></table:table-cell>`).join('')}</table:table-row>${rows.map((row) => `<table:table-row>${row.map((value) => `<table:table-cell office:value-type="string"><text:p>${value}</text:p></table:table-cell>`).join('')}</table:table-row>`).join('')}</table:table></office:spreadsheet></office:body></office:document-content>`);
      zip.file('styles.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-styles xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:styles/></office:document-styles>');
      zip.file('meta.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>');
      zip.file('settings.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-settings xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>');
      zip.file('META-INF/manifest.xml', '<?xml version="1.0" encoding="UTF-8"?><manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"><manifest:file-entry manifest:media-type="application/vnd.oasis.opendocument.spreadsheet" manifest:full-path="/"/><manifest:file-entry manifest:media-type="text/xml" manifest:full-path="content.xml"/></manifest:manifest>');
      downloadBlob(await zip.generateAsync({ type: 'blob' }), 'gacuba-contacts.ods');
    }
    notify(`Contacts exported as ${format.toUpperCase()}.`);
  }

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard; path: string }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/overview' },
    { id: 'students', label: 'Students Registry', icon: GraduationCap, path: '/students' },
    { id: 'midterm', label: 'Mid-Term Engine', icon: ClipboardList, path: '/midterm' },
    { id: 'users', label: 'Users & Roles', icon: UserCog, path: '/users' },
    { id: 'campaigns', label: 'Notifications', icon: Megaphone, path: '/campaigns' },
    { id: 'contacts', label: 'Parent contacts', icon: Users, path: '/contacts' },
    { id: 'content', label: 'Website content', icon: GalleryHorizontal, path: '/content' },
    { id: 'inquiries', label: 'Visitor inquiries', icon: Inbox, path: '/inquiries' },
  ];

  const role = parseSchoolRole(user?.role);
  const isDean = ['dean_of_studies', 'it'].includes(role);
  const allowedPaths = role === 'teacher'
    ? ['/midterm', '/students']
    : role === 'headteacher'
      ? ['/overview', '/midterm', '/campaigns']
      : isDean
        ? navItems.map((item) => item.path)
        : [];
  const visibleNavItems = navItems.filter((item) => allowedPaths.includes(item.path));
  if (role === 'it' && !visibleNavItems.some((item) => item.path === '/users')) {
    visibleNavItems.push(navItems.find((item) => item.path === '/users')!);
  }
  const restrictedPage = <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access this page.</p>;

  const overviewElement = <HeadmasterOverview
    contacts={contacts}
    campaigns={campaigns}
    content={content}
    inquiries={inquiries}
    adminName={user?.full_name || settings?.admin_name || user?.email || 'Administrator'}
    adminRole={user?.role || 'Administrator'}
    onNavigate={(view) => navigate(navItems.find((item) => item.id === view)?.path ?? '/overview')}
  />;
  const roleAwareOverview = allowedPaths.includes('/overview') ? overviewElement : restrictedPage;

  async function handleLogin(email: string, password: string): Promise<string | null> {
    if (!supabase) return 'Authentication is not configured.';
    try {
      const resp = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
      if (resp.error || !resp.data?.user) {
        console.error('Login failed', resp.error);
        return resp.error?.message ?? 'Incorrect email or password. Please try again.';
      }
      sessionStorage.setItem(AUTH_KEY, 'true');
      setAuthed(true);
      const userInfo = resp.data.user;
      const { data: profile, error: profileError } = await supabase.from('users').select('role, full_name').eq('id', userInfo.id).maybeSingle();
      if (profileError || !profile) {
        await supabase.auth.signOut();
        sessionStorage.removeItem(AUTH_KEY);
        setAuthed(false);
        return 'Your account has no school role profile. Ask IT to provision it.';
      }
      const role = parseSchoolRole(profile.role);
      setUser({
        id: userInfo.id,
        email: userInfo.email ?? undefined,
        full_name: profile.full_name || (typeof userInfo.user_metadata?.full_name === 'string' ? userInfo.user_metadata.full_name : undefined),
        role,
      });
      navigate(role === 'teacher' ? '/midterm' : '/overview');
      return null;
    } catch (err) {
      console.error('Login error', err);
      return 'Authentication failed. Please try again.';
    }
  }

  function handleLogout() {
    if (supabase) {
      void supabase.auth.signOut().catch((e) => console.warn('Sign out error', e));
    }
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setUser(null);
    navigate('/overview');
  }

  useEffect(() => {
    // if we have an auth session stored, try to restore user info from Supabase
    async function restoreUser() {
      if (!supabase) return;
      try {
        const { data } = await supabase.auth.getUser();
        if (data?.user) {
          const { data: profile } = await supabase.from('users').select('role, full_name').eq('id', data.user.id).maybeSingle();
          if (!profile) {
            sessionStorage.removeItem(AUTH_KEY);
            setAuthed(false);
            return;
          }
          setUser({
            id: data.user.id,
            email: data.user.email ?? undefined,
            full_name: profile.full_name || (typeof data.user.user_metadata?.full_name === 'string' ? data.user.user_metadata.full_name : undefined),
            role: parseSchoolRole(profile.role),
          });
        } else {
          sessionStorage.removeItem(AUTH_KEY);
          setAuthed(false);
        }
      } catch {
        sessionStorage.removeItem(AUTH_KEY);
        setAuthed(false);
      }
    }
    if (sessionStorage.getItem(AUTH_KEY) === 'true') {
      void restoreUser();
    }
  }, []);

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Avatar variant="brand"><BookOpen size={20} strokeWidth={2.5} /></Avatar><div><strong>{SCHOOL_NAME}</strong><span>ADMIN PORTAL</span></div></div>
        <div className="school-switcher"><div className="school-avatar">{SCHOOL_NAME[0]}</div><div><strong>{SCHOOL_NAME}</strong><span>School workspace</span></div><ChevronDown size={15} /></div>
        <p className="nav-label">Workspace</p>
        <nav className="nav-list">{visibleNavItems.map(({ id, label, icon: Icon, path }) => (
          <NavLink key={id} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'inquiries' && inquiries.filter((i) => i.status === 'New').length > 0 && <b className="nav-badge">{inquiries.filter((i) => i.status === 'New').length}</b>}
          </NavLink>
        ))}</nav>
        <div className="sidebar-bottom">{isDean && <button className="nav-item" onClick={() => setShowSettings(true)}><Settings size={18} /><span>Settings</span></button>}<button className="nav-item" onClick={() => setShowHelp(true)}><CircleHelp size={18} /><span>Help center</span></button><div className="user-card"><Avatar initials={(user?.full_name || user?.email || 'A').split(' ').map((n) => n[0]).slice(0,2).join('') ?? 'A'} /><div><strong>{user?.full_name ?? user?.email ?? 'Administrator'}</strong><span>{role}</span></div><IconButton onClick={handleLogout} title="Sign out"><LogOut size={16} /></IconButton></div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>{SCHOOL_NAME}</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.path === (location.pathname === '/' ? '/overview' : location.pathname))?.label}</strong></div><div className="top-actions"><IconButton className="notification-button" onClick={() => setShowNotifications((open) => !open)}><Bell size={19} /><i /></IconButton>{showNotifications && <div className="notification-popover"><strong>Notifications</strong><p>Your PTA campaign was delivered to {contacts.length} parents.</p></div>}<div className="top-divider" /><Avatar initials={(user?.full_name || user?.email || SCHOOL_NAME).split(' ').map((n) => n[0]).slice(0,2).join('')} variant="mini" /></div></header>
        <div className="page-wrap">
          <Routes>
            <Route path="/" element={roleAwareOverview} />
            <Route path="/overview" element={roleAwareOverview} />
            <Route path="/students" element={role === 'teacher' ? <TeacherStudentRegister /> : isDean ? <Students /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access the student registry.</p>} />
            <Route path="/midterm" element={allowedPaths.includes('/midterm') ? <Suspense fallback={<LoadingScreen />}><MidTermEngine role={role} userId={user?.id} notify={notify} /></Suspense> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access mid-term reports.</p>} />
            <Route path="/users" element={role === 'it' ? <UserManagement /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Only IT can manage user roles.</p>} />
            <Route path="/campaigns" element={allowedPaths.includes('/campaigns') ? <Campaigns campaigns={campaigns} onCompose={() => setShowNotification(true)} onDelete={isDean ? deleteCampaign : () => notify('Headteachers can create meeting and fees campaigns but cannot delete campaign history.')} notify={notify} /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access notifications.</p>} />
            <Route path="/contacts" element={isDean ? <Contacts contacts={contacts} onExport={exportContacts} /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access parent contacts.</p>} />
            <Route path="/content" element={isDean ? <ContentManager content={content} onAdd={() => { setEditingContent(null); setShowContentForm(true); }} onEdit={(item) => { setEditingContent(item); setShowContentForm(true); }} onDelete={deleteContent} onPublish={publishContent} /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot manage website content.</p>} />
            <Route path="/inquiries" element={isDean ? <Inquiries inquiries={inquiries} setInquiries={setInquiries} notify={notify} /> : <p role="alert" className="rounded-xl bg-amber-50 p-5 text-sm text-amber-900">Your role cannot access visitor inquiries.</p>} />
          </Routes>
        </div>
      </main>

      {showNotification && (role === 'headteacher' || isDean) && <NotificationModal onClose={() => setShowNotification(false)} onSave={saveCampaign} contacts={contacts} allowReports={isDean} />}
      {showContentForm && <ContentModal initialContent={editingContent ?? undefined} onClose={() => { setShowContentForm(false); setEditingContent(null); }} onSave={saveContent} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} notify={notify} adminName={settings?.admin_name ?? user?.full_name} defaultChannel={settings?.default_notification_channel} onSave={saveSettings} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}





export default App;
