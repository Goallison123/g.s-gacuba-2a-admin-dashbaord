import { useState } from 'react';
import { School as SchoolIcon, MapPin, Users, BookOpen, Clock, Pencil, Check, X } from 'lucide-react';
import { useSchoolData, setData } from '@/store';
import { Alert } from '@/components/Alert';
import { Badge } from '@/components/Badge';
import type { SchoolProfile } from '@/types';

export function SchoolPage() {
  const data = useSchoolData();
  const profile = data.profile;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<SchoolProfile | null>(profile);

  if (!profile) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-navy-900">School</h1>
          <p className="text-sm text-slate-500">School profile not found. Please complete onboarding.</p>
        </div>
      </div>
    );
  }

  const save = () => {
    setData((draft) => { draft.profile = form; });
    setEditing(false);
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">School</h1>
          <p className="text-sm text-slate-500">School profile and configuration</p>
        </div>
        {!editing ? (
          <button onClick={() => { setForm(profile); setEditing(true); }} className="btn-secondary">
            <Pencil size={16} />
            Edit profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="btn-ghost">
              <X size={16} /> Cancel
            </button>
            <button onClick={save} className="btn-primary">
              <Check size={16} /> Save
            </button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-slate-200 bg-navy-50/50 px-6 py-5">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-navy-800 text-white">
            <SchoolIcon size={28} />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-navy-900">{profile.name}</h2>
            <p className="text-sm text-slate-500">{profile.educationSystem} education system</p>
          </div>
        </div>

        {/* Details */}
        <div className="grid grid-cols-1 gap-px bg-slate-100 sm:grid-cols-2">
          <DetailField icon={MapPin} label="Country" value={profile.country} editing={editing} form={form} field="country" setForm={setForm} />
          <DetailField icon={MapPin} label="District" value={profile.district} editing={editing} form={form} field="district" setForm={setForm} />
          <DetailField icon={MapPin} label="Sector" value={profile.sector || '—'} editing={editing} form={form} field="sector" setForm={setForm} />
          <DetailField icon={Users} label="Referral source" value={profile.referralSource || '—'} editing={editing} form={form} field="referralSource" setForm={setForm} />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-px border-t border-slate-200 bg-slate-100">
          <StatBox label="Students" value={data.students.length || profile.studentCount} />
          <StatBox label="Teachers" value={data.teachers.length || profile.teachingStaffCount} />
          <StatBox label="Non-teaching staff" value={profile.nonTeachingStaffCount} />
        </div>

        {/* Levels */}
        <div className="border-t border-slate-200 px-6 py-5">
          <p className="mb-3 text-sm font-medium text-slate-500">Levels offered</p>
          <div className="flex flex-wrap gap-2">
            {profile.levels.map((l) => (
              <Badge key={l} variant="info">{l}</Badge>
            ))}
          </div>
        </div>

        {/* Timing */}
        {data.timing && (
          <div className="border-t border-slate-200 px-6 py-5">
            <p className="mb-3 text-sm font-medium text-slate-500">School day</p>
            <div className="flex flex-wrap items-center gap-4 text-sm text-navy-900">
              <span className="flex items-center gap-2">
                <Clock size={16} className="text-slate-400" />
                {data.timing.startTime} – {data.timing.endTime}
              </span>
              <Badge>{data.timing.periodDuration} min periods</Badge>
              {data.timing.hasBreaks && (
                <>
                  <Badge>Break: {data.timing.firstBreakTime}</Badge>
                  <Badge>Lunch: {data.timing.lunchTime}</Badge>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4">
        <Alert variant="info">
          Changes to your school profile are saved locally and take effect immediately.
        </Alert>
      </div>
    </div>
  );
}

function DetailField({
  icon: Icon,
  label,
  value,
  editing,
  form,
  field,
  setForm,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  editing: boolean;
  form: SchoolProfile | null;
  field: keyof SchoolProfile;
  setForm: React.Dispatch<React.SetStateAction<SchoolProfile | null>>;
}) {
  return (
    <div className="bg-white px-6 py-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-medium text-slate-400">
        <Icon size={14} />
        {label}
      </div>
      {editing ? (
        <input
          className="input-field"
          value={(form?.[field] as string) || ''}
          onChange={(e) => setForm(form ? { ...form, [field]: e.target.value } : null)}
        />
      ) : (
        <p className="text-sm font-medium text-navy-900">{value}</p>
      )}
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white px-6 py-4 text-center">
      <p className="text-2xl font-bold text-navy-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
