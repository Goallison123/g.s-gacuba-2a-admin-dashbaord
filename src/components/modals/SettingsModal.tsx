import React from 'react';
import { AlertTriangle, Check, X } from 'lucide-react';
import IconButton from '@/components/ui/IconButton';
import Button from '@/components/ui/Button';
import { SCHOOL_NAME } from '@/lib/constants';

export default function SettingsModal({ onClose, notify }: { onClose: () => void; notify: (message: string) => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal small-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2>Settings</h2>
          </div>
          <IconButton onClick={onClose}><X size={19} /></IconButton>
        </div>
        <div className="modal-body">
          <label>School name<input defaultValue={SCHOOL_NAME} /></label>
          <label>Administrator name<input defaultValue="Amaka Okoro" /></label>
          <label>Default notification channel<select><option>SMS</option><option>WhatsApp</option><option>Email</option></select></label>
          <div className="format-note"><AlertTriangle size={16} /><span>Settings changes will be saved to your workspace profile.</span></div>
        </div>
        <div className="modal-footer">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { onClose(); notify('Settings saved successfully.'); }}><Check size={16} /> Save settings</Button>
        </div>
      </div>
    </div>
  );
}
