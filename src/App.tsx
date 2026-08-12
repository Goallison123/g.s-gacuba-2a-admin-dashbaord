import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, NavLink } from 'react-router-dom';
import JSZip from 'jszip';
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  FileSpreadsheet,
  GalleryHorizontal,
  Inbox,
  LayoutDashboard,
  LogOut,
  Mail,
  Megaphone,
  MoreHorizontal,
  Paperclip,
  PenLine,
  Phone,
  Plus,
  Search,
  Send,
  Settings,
  Smartphone,
  Sparkles,
  Users,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { View, Contact, Campaign, Content, Inquiry, WorkspaceSettings } from '@/types';
import { SCHOOL_NAME, AUTH_KEY, galleryImages, CATEGORIES, categoryMeta } from '@/lib/constants';
import { formatDate, initials, downloadBlob, contentCount } from '@/utils/helpers';
import Overview from '@/pages/Overview';
import Campaigns from '@/pages/Campaigns';
import Contacts from '@/pages/Contacts';
import ContentManager from '@/pages/ContentManager';
import Inquiries from '@/pages/Inquiries';
import NotificationModal from '@/components/modals/NotificationModal';
import ImportModal from '@/components/modals/ImportModal';
import ContentModal from '@/components/modals/ContentModal';
import AddContactModal from '@/components/modals/AddContactModal';
import SettingsModal from '@/components/modals/SettingsModal';
import HelpModal from '@/components/modals/HelpModal';
import LoginScreen from '@/components/LoginScreen';
import Avatar from '@/components/ui/Avatar';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';

// initial data is loaded from Supabase at runtime; remove hard-coded seeds so the
// application uses the canonical database source of truth

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true');
  const [user, setUser] = useState<{ email?: string | null; full_name?: string | null } | null>(null);
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
  const [showContactImport, setShowContactImport] = useState(false);
  const [showContentForm, setShowContentForm] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadData() {
      if (!supabase) return;
      setLoading(true);
      const [contactsResult, campaignsResult, galleryResult, newsResult, inquiriesResult, settingsResult] = await Promise.all([
        supabase.from('school_contacts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('gallery_items').select('*').order('updated_at', { ascending: false }).limit(50),
        supabase.from('news_items').select('*').order('published_at', { ascending: false }).limit(50),
        supabase.from('school_inquiries').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('workspace_settings').select('*').limit(1),
      ]).catch((err) => {
        console.error('Failed to load initial data', err);
        return [ { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] }, { data: [] } ];
      });
      if (contactsResult?.data) setContacts(contactsResult.data as Contact[]);
      if (campaignsResult?.data) setCampaigns(campaignsResult.data as Campaign[]);
      if (galleryResult?.data && newsResult?.data) setContent([...(galleryResult.data as Content[]), ...(newsResult.data as Content[])]);
      if (inquiriesResult?.data) setInquiries(inquiriesResult.data as Inquiry[]);
      if (settingsResult?.data?.length) setSettings(settingsResult.data[0] as WorkspaceSettings);
      setLoading(false);
    }
    void loadData();
  }, []);

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

  async function saveCampaign(campaign: Omit<Campaign, 'id' | 'created_at'>) {
    if (!supabase) {
      notify('Unable to save: database is not configured.');
      return;
    }
    const { data, error } = await supabase.from('notification_campaigns').insert(campaign).select().maybeSingle();
    if (error || !data) {
      console.error('Failed to save campaign', error);
      notify('Failed to save notification.');
      return;
    }
    setCampaigns((items) => [data as Campaign, ...items]);
    setShowNotification(false);
    notify(campaign.status === 'Scheduled' ? 'Notification scheduled successfully.' : 'Notification sent successfully.');
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
    } as any;

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

  async function addContact(contact: Omit<Contact, 'id' | 'created_at'>) {
    if (!supabase) {
      notify('Unable to add contact: database is not configured.');
      return;
    }
    const { data, error } = await supabase.from('school_contacts').insert(contact).select().maybeSingle();
    if (error || !data) {
      console.error('Failed to add contact', error);
      notify('Failed to add contact.');
      return;
    }
    setContacts((items) => [data as Contact, ...items]);
    setShowAddContact(false);
    notify('Contact added successfully.');
  }

  async function deleteContact(id: string) {
    if (!supabase) {
      notify('Unable to delete contact: database is not configured.');
      return;
    }
    const { error } = await supabase.from('school_contacts').delete().eq('id', id).throwOnError();
    if (error) {
      console.error('Failed to delete contact', error);
      notify('Failed to delete contact.');
      return;
    }
    setContacts((items) => items.filter((item) => item.id !== id));
    notify('Contact removed.');
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
      return { parent_name: values[0] || `Imported parent ${index + 1}`, student_name: values[1] || '', class_name: values[2] || '', phone: values[3] || '', email: values[4] || '', preferred_channel: values[5] || 'SMS', status: 'Active' };
    });
    if (!rows.length) {
      notify('No contacts found in the CSV file.');
      setShowContactImport(false);
      event.target.value = '';
      return;
    }
    if (!supabase) {
      notify('Unable to import: database is not configured.');
      setShowContactImport(false);
      event.target.value = '';
      return;
    }
    const { data, error } = await supabase.from('school_contacts').insert(rows).select();
    if (error || !data) {
      console.error('Failed to import contacts', error);
      notify('Failed to import contacts.');
      setShowContactImport(false);
      event.target.value = '';
      return;
    }
    setContacts((items) => [...(data as Contact[]), ...items]);
    notify(`${data.length} parent contacts imported.`);
    setShowContactImport(false);
    event.target.value = '';
  }

  async function exportContacts(format: 'xls' | 'ods') {
    const headers = ['Parent name', 'Student name', 'Class', 'Phone', 'Email', 'Preferred channel', 'Status'];
    const rows = contacts.map((contact) => [contact.parent_name, contact.student_name, contact.class_name, contact.phone, contact.email, contact.preferred_channel, contact.status]);
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
    { id: 'campaigns', label: 'Notifications', icon: Megaphone, path: '/campaigns' },
    { id: 'contacts', label: 'Parent contacts', icon: Users, path: '/contacts' },
    { id: 'content', label: 'Website content', icon: GalleryHorizontal, path: '/content' },
    { id: 'inquiries', label: 'Visitor inquiries', icon: Inbox, path: '/inquiries' },
  ];

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
      setUser({ email: userInfo.email ?? undefined, full_name: (userInfo.user_metadata as any)?.full_name ?? undefined });
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
          setUser({ email: data.user.email ?? undefined, full_name: (data.user.user_metadata as any)?.full_name ?? undefined });
        }
      } catch (err) {
        // ignore
      }
    }
    if (sessionStorage.getItem(AUTH_KEY) === 'true') {
      void restoreUser();
    }
  }, []);

  if (!authed) return <LoginScreen onLogin={async (email, password) => { const res = await handleLogin(email, password); if (!res) navigate('/overview'); return res; }} />;

  if (loading) return <LoadingScreen />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Avatar variant="brand"><BookOpen size={20} strokeWidth={2.5} /></Avatar><div><strong>{SCHOOL_NAME}</strong><span>ADMIN PORTAL</span></div></div>
        <div className="school-switcher"><div className="school-avatar">{SCHOOL_NAME[0]}</div><div><strong>{SCHOOL_NAME}</strong><span>School workspace</span></div><ChevronDown size={15} /></div>
        <p className="nav-label">Workspace</p>
        <nav className="nav-list">{navItems.map(({ id, label, icon: Icon, path }) => (
          <NavLink key={id} to={path} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
            {id === 'inquiries' && inquiries.filter((i) => i.status === 'New').length > 0 && <b className="nav-badge">{inquiries.filter((i) => i.status === 'New').length}</b>}
          </NavLink>
        ))}</nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowSettings(true)}><Settings size={18} /><span>Settings</span></button><button className="nav-item" onClick={() => setShowHelp(true)}><CircleHelp size={18} /><span>Help center</span></button><div className="user-card"><Avatar initials={(user?.full_name || user?.email || 'A').split(' ').map((n) => n[0]).slice(0,2).join('') ?? 'A'} /><div><strong>{user?.full_name ?? user?.email ?? 'Administrator'}</strong><span>Administrator</span></div><IconButton onClick={handleLogout} title="Sign out"><LogOut size={16} /></IconButton></div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>{SCHOOL_NAME}</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.path === (location.pathname === '/' ? '/overview' : location.pathname))?.label}</strong></div><div className="top-actions"><IconButton className="notification-button" onClick={() => setShowNotifications((open) => !open)}><Bell size={19} /><i /></IconButton>{showNotifications && <div className="notification-popover"><strong>Notifications</strong><p>Your PTA campaign was delivered to {contacts.length} parents.</p></div>}<div className="top-divider" /><Avatar initials={(user?.full_name || user?.email || SCHOOL_NAME).split(' ').map((n) => n[0]).slice(0,2).join('')} variant="mini" /></div></header>
        <div className="page-wrap">
          <Routes>
            <Route path="/" element={<Overview contacts={contacts} campaigns={campaigns} content={content} inquiries={inquiries} onNavigate={(v: View) => navigate(navItems.find((n) => n.id === v)?.path ?? '/overview')} onCompose={() => setShowNotification(true)} />} />
            <Route path="/overview" element={<Overview contacts={contacts} campaigns={campaigns} content={content} inquiries={inquiries} onNavigate={(v: View) => navigate(navItems.find((n) => n.id === v)?.path ?? '/overview')} onCompose={() => setShowNotification(true)} />} />
            <Route path="/campaigns" element={<Campaigns campaigns={campaigns} onCompose={() => setShowNotification(true)} onDelete={deleteCampaign} notify={notify} />} />
            <Route path="/contacts" element={<Contacts contacts={contacts} onImport={() => setShowContactImport(true)} onExport={exportContacts} onAdd={() => setShowAddContact(true)} onDelete={deleteContact} />} />
            <Route path="/content" element={<ContentManager content={content} onAdd={() => setShowContentForm(true)} onDelete={deleteContent} onPublish={publishContent} />} />
            <Route path="/inquiries" element={<Inquiries inquiries={inquiries} setInquiries={setInquiries} notify={notify} />} />
          </Routes>
        </div>
      </main>

      {showNotification && <NotificationModal onClose={() => setShowNotification(false)} onSave={saveCampaign} recipientCount={contacts.length} />}
      {showContactImport && <ImportModal onClose={() => setShowContactImport(false)} onChoose={() => importRef.current?.click()} />}
      {showContentForm && <ContentModal onClose={() => setShowContentForm(false)} onSave={saveContent} />}
      {showAddContact && <AddContactModal onClose={() => setShowAddContact(false)} onSave={addContact} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} notify={notify} adminName={settings?.admin_name ?? user?.full_name} defaultChannel={settings?.default_notification_channel} onSave={saveSettings} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden-input" onChange={handleImport} />
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}





export default App;
