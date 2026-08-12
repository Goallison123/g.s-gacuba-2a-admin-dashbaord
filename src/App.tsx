import React, { ChangeEvent, useEffect, useRef, useState } from 'react';
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
import type { View, Contact, Campaign, Content, Inquiry } from '@/types';
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

const seedContacts: Contact[] = [
  { id: '1', parent_name: 'Mukamana Grace', student_name: 'Kwizera Grace', class_name: 'P6A', phone: '+250 788 451 289', email: 'grace.mukamana@email.com', preferred_channel: 'WhatsApp', status: 'Active', created_at: '2024-05-01' },
  { id: '2', parent_name: 'Habimana Daniel', student_name: 'Ishimwe Daniel', class_name: 'S3B', phone: '+250 788 923 440', email: 'daniel.habimana@email.com', preferred_channel: 'SMS', status: 'Active', created_at: '2024-05-01' },
  { id: '3', parent_name: 'Uwase Amina', student_name: 'Inshuti Amina', class_name: 'P5C', phone: '+250 788 110 568', email: 'amina.uwase@email.com', preferred_channel: 'Email', status: 'Active', created_at: '2024-05-02' },
  { id: '4', parent_name: 'Ndayishimiye Michael', student_name: 'Tuyisenge Michael', class_name: 'S6A', phone: '+250 788 774 903', email: 'michael.ndayishimiye@email.com', preferred_channel: 'WhatsApp', status: 'Active', created_at: '2024-05-03' },
];

const seedCampaigns: Campaign[] = [
  { id: '1', title: 'PTA General Meeting', message: 'Dear parent, our next PTA meeting is scheduled for Friday, 17 May at 4:00 PM in the school hall.', channels: ['SMS', 'WhatsApp'], recipient_count: 812, status: 'Sent', category: 'Parent notification', created_at: '2024-05-10' },
  { id: '2', title: 'Absentee alert - P6A', message: 'Your child was marked absent today. Please contact the school office if this is unexpected.', channels: ['SMS'], recipient_count: 38, status: 'Sent', category: 'Attendance alert', created_at: '2024-05-12' },
  { id: '3', title: 'Term 2 fees due', message: 'A friendly reminder that Term 2 school fees are due by 20 May. Please complete payment at your earliest convenience.', channels: ['SMS', 'Email'], recipient_count: 812, status: 'Scheduled', scheduled_for: '2024-05-17', category: 'Fee reminder', created_at: '2024-05-09' },
  { id: '4', title: 'S3 midterm results published', message: 'S3 midterm examination results are now available. Please check the parent portal or visit the school.', channels: ['Email'], recipient_count: 145, status: 'Draft', category: 'Examination result', created_at: '2024-05-08' },
  { id: '5', title: 'Emergency closure - heavy rain', message: 'Due to heavy rainfall and flooding risk, the school will be closed tomorrow. Please keep children safe at home.', channels: ['SMS', 'WhatsApp', 'Email'], recipient_count: 812, status: 'Sent', category: 'Emergency announcement', created_at: '2024-05-13' },
];

const seedContent: Content[] = [
  { id: '1', title: 'Term 2 Open Day', content_type: 'News', excerpt: 'Meet our teachers, tour the campus, and discover what makes G.S Gacuba 2A a place to thrive.', image_url: galleryImages[0], status: 'Published', published_at: '2024-05-12', created_at: '2024-05-12' },
  { id: '2', title: 'Congratulations to our debate finalists', content_type: 'Announcement', excerpt: 'Our senior debate team has qualified for the district inter-school finals.', image_url: galleryImages[1], status: 'Published', published_at: '2024-05-08', created_at: '2024-05-08' },
  { id: '3', title: 'A day in P6', content_type: 'Gallery', excerpt: 'A glimpse into a day of curious minds, collaboration, and discovery.', image_url: galleryImages[2], status: 'Draft', created_at: '2024-05-04' },
];

const seedInquiries: Inquiry[] = [
  { id: '1', visitor_name: 'Sarah Williams', email: 'sarah.williams@gmail.com', phone: '+250 789 123 778', topic: 'Admissions', message: 'I would like to learn more about admissions for P1 next term.', status: 'New', created_at: '2024-05-14' },
  { id: '2', visitor_name: 'Oluwaseun Adebayo', email: 'seun.adebayo@email.com', topic: 'General enquiry', message: 'Could you please send me the school fees structure for the next session?', status: 'In progress', created_at: '2024-05-13' },
  { id: '3', visitor_name: 'Mariam Yusuf', email: 'mariam.yusuf@email.com', topic: 'Visit request', message: 'I would like to arrange a campus tour for my family.', status: 'Resolved', created_at: '2024-05-11' },
];

function App() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem(AUTH_KEY) === 'true');
  const [view, setView] = useState<View>('overview');
  const [contacts, setContacts] = useState<Contact[]>(seedContacts);
  const [campaigns, setCampaigns] = useState<Campaign[]>(seedCampaigns);
  const [content, setContent] = useState<Content[]>(seedContent);
  const [inquiries, setInquiries] = useState<Inquiry[]>(seedInquiries);
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
      const [contactsResult, campaignsResult, contentResult, inquiriesResult] = await Promise.all([
        supabase.from('school_contacts').select('*').order('created_at', { ascending: false }).limit(100),
        supabase.from('notification_campaigns').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('school_content').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('school_inquiries').select('*').order('created_at', { ascending: false }).limit(20),
      ]);
      if (contactsResult.data?.length) setContacts(contactsResult.data as Contact[]);
      if (campaignsResult.data?.length) setCampaigns(campaignsResult.data as Campaign[]);
      if (contentResult.data?.length) setContent(contentResult.data as Content[]);
      if (inquiriesResult.data?.length) setInquiries(inquiriesResult.data as Inquiry[]);
    }
    void loadData();
  }, []);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(''), 2600);
  }

  async function saveCampaign(campaign: Omit<Campaign, 'id' | 'created_at'>) {
    const optimistic = { ...campaign, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setCampaigns((items) => [optimistic, ...items]);
    if (supabase) {
      const { data } = await supabase.from('notification_campaigns').insert(campaign).select().maybeSingle();
      if (data) setCampaigns((items) => items.map((item) => item.id === optimistic.id ? data as Campaign : item));
    }
    setShowNotification(false);
    notify(campaign.status === 'Scheduled' ? 'Notification scheduled successfully.' : 'Notification sent successfully.');
  }

  async function deleteCampaign(id: string) {
    setCampaigns((items) => items.filter((item) => item.id !== id));
    if (supabase) await supabase.from('notification_campaigns').delete().eq('id', id);
    notify('Notification deleted.');
  }

  async function saveContent(item: Omit<Content, 'id' | 'created_at'>) {
    const optimistic = { ...item, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setContent((items) => [optimistic, ...items]);
    if (supabase) {
      const { data } = await supabase.from('school_content').insert(item).select().maybeSingle();
      if (data) setContent((items) => items.map((entry) => entry.id === optimistic.id ? data as Content : entry));
    }
    setShowContentForm(false);
    notify('Content saved to your website workspace.');
  }

  async function deleteContent(id: string) {
    setContent((items) => items.filter((item) => item.id !== id));
    if (supabase) await supabase.from('school_content').delete().eq('id', id);
    notify('Content deleted.');
  }

  async function publishContent(id: string) {
    const item = content.find((c) => c.id === id);
    if (!item) return;
    const updated = { ...item, status: 'Published', published_at: new Date().toISOString() };
    setContent((items) => items.map((c) => c.id === id ? updated : c));
    if (supabase) await supabase.from('school_content').update({ status: 'Published', published_at: updated.published_at }).eq('id', id);
    notify('Content published to your website.');
  }

  async function addContact(contact: Omit<Contact, 'id' | 'created_at'>) {
    const optimistic = { ...contact, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    setContacts((items) => [optimistic, ...items]);
    if (supabase) {
      const { data } = await supabase.from('school_contacts').insert(contact).select().maybeSingle();
      if (data) setContacts((items) => items.map((c) => c.id === optimistic.id ? data as Contact : c));
    }
    setShowAddContact(false);
    notify('Contact added successfully.');
  }

  async function deleteContact(id: string) {
    setContacts((items) => items.filter((item) => item.id !== id));
    if (supabase) await supabase.from('school_contacts').delete().eq('id', id);
    notify('Contact removed.');
  }

  async function handleImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const rows = lines.slice(1).map((line, index) => {
      const values = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
      return { id: crypto.randomUUID(), parent_name: values[0] || `Imported parent ${index + 1}`, student_name: values[1] || '', class_name: values[2] || '', phone: values[3] || '', email: values[4] || '', preferred_channel: values[5] || 'SMS', status: 'Active', created_at: new Date().toISOString() };
    });
    if (rows.length) {
      setContacts((items) => [...rows, ...items]);
      if (supabase) await supabase.from('school_contacts').insert(rows.map((row) => { const { id: _removed, ...rest } = row; void _removed; return rest; }));
      notify(`${rows.length} parent contacts imported.`);
    } else {
      notify('No contacts found in the CSV file.');
    }
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

  const navItems: { id: View; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'campaigns', label: 'Notifications', icon: Megaphone },
    { id: 'contacts', label: 'Parent contacts', icon: Users },
    { id: 'content', label: 'Website content', icon: GalleryHorizontal },
    { id: 'inquiries', label: 'Visitor inquiries', icon: Inbox },
  ];

  function handleLogin(email: string, password: string): string | null {
    // local credential check (seed admin)
    if (email.trim().toLowerCase() === 'bessora@sybellasystems.co.rw' && password === 'Admin@123') {
      sessionStorage.setItem(AUTH_KEY, 'true');
      setAuthed(true);
      return null;
    }
    return 'Incorrect email or password. Please try again.';
  }

  function handleLogout() {
    sessionStorage.removeItem(AUTH_KEY);
    setAuthed(false);
    setView('overview');
  }

  if (!authed) return <LoginScreen onLogin={handleLogin} />;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Avatar variant="brand"><BookOpen size={20} strokeWidth={2.5} /></Avatar><div><strong>{SCHOOL_NAME}</strong><span>ADMIN PORTAL</span></div></div>
        <div className="school-switcher"><div className="school-avatar">{SCHOOL_NAME[0]}</div><div><strong>{SCHOOL_NAME}</strong><span>School workspace</span></div><ChevronDown size={15} /></div>
        <p className="nav-label">Workspace</p>
        <nav className="nav-list">{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={`nav-item ${view === id ? 'active' : ''}`} onClick={() => setView(id)}><Icon size={18} /><span>{label}</span>{id === 'inquiries' && inquiries.filter((i) => i.status === 'New').length > 0 && <b className="nav-badge">{inquiries.filter((i) => i.status === 'New').length}</b>}</button>)}</nav>
        <div className="sidebar-bottom"><button className="nav-item" onClick={() => setShowSettings(true)}><Settings size={18} /><span>Settings</span></button><button className="nav-item" onClick={() => setShowHelp(true)}><CircleHelp size={18} /><span>Help center</span></button><div className="user-card"><Avatar initials="AO" /><div><strong>Amaka Okoro</strong><span>Administrator</span></div><IconButton onClick={handleLogout} title="Sign out"><LogOut size={16} /></IconButton></div></div>
      </aside>
      <main className="main-content">
        <header className="topbar"><div className="breadcrumb"><span>{SCHOOL_NAME}</span><ChevronRight size={14} /><strong>{navItems.find((item) => item.id === view)?.label}</strong></div><div className="top-actions"><IconButton className="notification-button" onClick={() => setShowNotifications((open) => !open)}><Bell size={19} /><i /></IconButton>{showNotifications && <div className="notification-popover"><strong>Notifications</strong><p>Your PTA campaign was delivered to 812 parents.</p></div>}<div className="top-divider" /><Avatar initials="AO" variant="mini" /></div></header>
        <div className="page-wrap">
          {view === 'overview' && <Overview contacts={contacts} campaigns={campaigns} inquiries={inquiries} onNavigate={setView} onCompose={() => setShowNotification(true)} />}
          {view === 'campaigns' && <Campaigns campaigns={campaigns} onCompose={() => setShowNotification(true)} onDelete={deleteCampaign} notify={notify} />}
          {view === 'contacts' && <Contacts contacts={contacts} onImport={() => setShowContactImport(true)} onExport={exportContacts} onAdd={() => setShowAddContact(true)} onDelete={deleteContact} />}
          {view === 'content' && <ContentManager content={content} onAdd={() => setShowContentForm(true)} onDelete={deleteContent} onPublish={publishContent} />}
          {view === 'inquiries' && <Inquiries inquiries={inquiries} setInquiries={setInquiries} notify={notify} />}
        </div>
      </main>

      {showNotification && <NotificationModal onClose={() => setShowNotification(false)} onSave={saveCampaign} recipientCount={contacts.length || 812} />}
      {showContactImport && <ImportModal onClose={() => setShowContactImport(false)} onChoose={() => importRef.current?.click()} />}
      {showContentForm && <ContentModal onClose={() => setShowContentForm(false)} onSave={saveContent} />}
      {showAddContact && <AddContactModal onClose={() => setShowAddContact(false)} onSave={addContact} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} notify={notify} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <input ref={importRef} type="file" accept=".csv,text/csv" className="hidden-input" onChange={handleImport} />
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}





export default App;
