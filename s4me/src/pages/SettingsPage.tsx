import { useState } from 'react';
import { Settings as SettingsIcon, Clock, Save, Check, AlertTriangle, LogOut } from 'lucide-react';
import { useSchoolData, setData, resetData, defaultTiming } from '@/store';
import { useAuth } from '@/lib/auth';
import { Alert } from '@/components/Alert';
import { ConfirmDialog } from '@/components/Modal';
import type { SchoolTiming } from '@/types';

export function SettingsPage() {
  const data = useSchoolData();
  const { user, signOut } = useAuth();
  const [timing, setTiming] = useState<SchoolTiming>(data.timing || defaultTiming);
  const [saved, setSaved] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const saveTiming = () => {
    setData((draft) => { draft.timing = timing; });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy-900">Settings</h1>
        <p className="text-sm text-slate-500">School configuration and preferences</p>
      </div>

      {/* School timing */}
      <div className="mb-6 card p-5">
        <div className="mb-4 flex items-center gap-2">
          <Clock size={18} className="text-navy-600" />
          <h2 className="text-base font-semibold text-navy-900">School day timing</h2>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Start time</label>
            <input
              type="time"
              className="input-field"
              value={timing.startTime}
              onChange={(e) => setTiming({ ...timing, startTime: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">End time</label>
            <input
              type="time"
              className="input-field"
              value={timing.endTime}
              onChange={(e) => setTiming({ ...timing, endTime: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-600">Period duration (minutes)</label>
            <input
              type="number"
              className="input-field"
              value={timing.periodDuration}
              onChange={(e) => setTiming({ ...timing, periodDuration: parseInt(e.target.value) || 40 })}
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-navy-600 focus:ring-navy-500"
                checked={timing.hasBreaks}
                onChange={(e) => setTiming({ ...timing, hasBreaks: e.target.checked })}
              />
              Scheduled breaks
            </label>
          </div>
        </div>

        {timing.hasBreaks && (
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">First break time</label>
              <input
                type="time"
                className="input-field"
                value={timing.firstBreakTime}
                onChange={(e) => setTiming({ ...timing, firstBreakTime: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">First break duration (min)</label>
              <input
                type="number"
                className="input-field"
                value={timing.firstBreakDuration}
                onChange={(e) => setTiming({ ...timing, firstBreakDuration: parseInt(e.target.value) || 20 })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Lunch time</label>
              <input
                type="time"
                className="input-field"
                value={timing.lunchTime}
                onChange={(e) => setTiming({ ...timing, lunchTime: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-600">Lunch duration (min)</label>
              <input
                type="number"
                className="input-field"
                value={timing.lunchDuration}
                onChange={(e) => setTiming({ ...timing, lunchDuration: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          <button onClick={saveTiming} className="btn-primary">
            {saved ? <><Check size={16} /> Saved</> : <><Save size={16} /> Save changes</>}
          </button>
        </div>
      </div>

      {/* Access control info */}
      <div className="mb-6 card p-5">
        <div className="mb-4 flex items-center gap-2">
          <SettingsIcon size={18} className="text-navy-600" />
          <h2 className="text-base font-semibold text-navy-900">Access control</h2>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy-900">Administrator</p>
              <p className="text-xs text-slate-500">{user?.email} · Full access to all school data and settings</p>
            </div>
            <span className="rounded-full bg-navy-50 px-3 py-1 text-xs font-medium text-navy-700">Active</span>
          </div>
          <button onClick={() => signOut()} className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50">
            <LogOut size={16} />
            Sign out
          </button>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy-900">Teacher access</p>
              <p className="text-xs text-slate-500">Limited view of assigned classes and subjects</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Not configured</span>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-navy-900">Student access</p>
              <p className="text-xs text-slate-500">View-only access to personal results</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">Not configured</span>
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card border-error-200 p-5">
        <div className="mb-4 flex items-center gap-2">
          <AlertTriangle size={18} className="text-error-600" />
          <h2 className="text-base font-semibold text-error-700">Danger zone</h2>
        </div>
        <Alert variant="error">
          Resetting will permanently delete all school data including classes, staff, students, timetables, and assessment marks.
        </Alert>
        <button onClick={() => setShowReset(true)} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-700 transition-colors hover:bg-error-100">
          Reset all school data
        </button>
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

