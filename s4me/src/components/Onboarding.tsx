import { useState, useMemo } from 'react';
import { ArrowLeft, ArrowRight, Check, School as SchoolIcon, MapPin, Users, BookOpen, Clock, GraduationCap, Layers, ChevronRight } from 'lucide-react';
import { setData, uid } from '@/store';
import type { SchoolProfile, SchoolTiming, ClassGroup, Subject, Level, EducationSystem } from '@/types';

const RWANDA_DISTRICTS = ['Nyarugenge', 'Gasabo', 'Kicukiro', 'Musanze', 'Rubavu', 'Rwamagana', 'Muhanga', 'Huye', 'Nyagatare', 'Rusizi'];
const RWANDA_SECTORS: Record<string, string[]> = {
  Nyarugenge: ['Nyarugenge', 'Gitega', 'Kanyinya', 'Gisozi', 'Kimisagara', 'Mageragere', 'Muhima', 'Nyakabanda', 'Nyamirambo', 'Rwezamenyo', 'Shyorongi'],
  Gasabo: ['Ndera', 'Gisozi', 'Gatsata', 'Jali', 'Jabana', 'Kagugu', 'Kimihurura', 'Kimironko', 'Nduba', 'Remera', 'Rusororo', 'Rutunga', 'Zindiro'],
  Kicukiro: ['Gahanga', 'Kagarama', 'Kanombe', 'Kicukiro', 'Kigarama', 'Masaka', 'Niboyi', 'Nyarugunga', 'Santo'],
  Musanze: ['Kimonyi', 'Cyuve', 'Gataraga', 'Kimbo', 'Kinigi', 'Muko', 'Musanze', 'Muhoza', 'Nyange', 'Shingiro'],
  Rubavu: ['Gisenyi', 'Bagira', 'Busasamana', 'Cyanzarwe', 'Gisa', 'Gisenyi', 'Kanzenze', 'Mudende', 'Nyakiriba', 'Nyundo', 'Rubavu'],
};
const DEFAULT_SECTORS = ['Sector 1', 'Sector 2', 'Sector 3'];

const RWANDA_SUBJECTS: Record<Level, { name: string; code: string; periods: number }[]> = {
  Primary: [
    { name: 'Mathematics', code: 'MATH', periods: 7 },
    { name: 'English', code: 'ENG', periods: 6 },
    { name: 'Kinyarwanda', code: 'KIN', periods: 5 },
    { name: 'Science', code: 'SCI', periods: 5 },
    { name: 'Social Studies', code: 'SST', periods: 4 },
    { name: 'French', code: 'FRE', periods: 3 },
    { name: 'Religion', code: 'REL', periods: 2 },
  ],
  'O Level': [
    { name: 'Mathematics', code: 'MATH', periods: 7 },
    { name: 'English', code: 'ENG', periods: 6 },
    { name: 'Kinyarwanda', code: 'KIN', periods: 4 },
    { name: 'Biology', code: 'BIO', periods: 5 },
    { name: 'Chemistry', code: 'CHE', periods: 5 },
    { name: 'Physics', code: 'PHY', periods: 5 },
    { name: 'History', code: 'HIS', periods: 4 },
    { name: 'Geography', code: 'GEO', periods: 4 },
    { name: 'French', code: 'FRE', periods: 3 },
    { name: 'Entrepreneurship', code: 'ENT', periods: 3 },
    { name: 'Computer Science', code: 'CSC', periods: 3 },
  ],
  'A Level': [
    { name: 'Mathematics', code: 'MATH', periods: 6 },
    { name: 'English', code: 'ENG', periods: 4 },
    { name: 'Biology', code: 'BIO', periods: 6 },
    { name: 'Chemistry', code: 'CHE', periods: 6 },
    { name: 'Physics', code: 'PHY', periods: 6 },
    { name: 'Economics', code: 'ECO', periods: 5 },
    { name: 'History', code: 'HIS', periods: 5 },
    { name: 'Geography', code: 'GEO', periods: 5 },
    { name: 'Computer Science', code: 'CSC', periods: 4 },
  ],
  TVET: [
    { name: 'Mathematics', code: 'MATH', periods: 4 },
    { name: 'English', code: 'ENG', periods: 4 },
    { name: 'Entrepreneurship', code: 'ENT', periods: 4 },
    { name: 'ICT', code: 'ICT', periods: 5 },
    { name: 'Technical Drawing', code: 'TD', periods: 5 },
    { name: 'Workshop Practice', code: 'WSP', periods: 8 },
  ],
};

const LEVEL_CLASSES: Record<Level, { label: string; count: number }[]> = {
  Primary: [{ label: 'P1', count: 1 }, { label: 'P2', count: 1 }, { label: 'P3', count: 1 }, { label: 'P4', count: 1 }, { label: 'P5', count: 1 }, { label: 'P6', count: 1 }],
  'O Level': [{ label: 'S1', count: 1 }, { label: 'S2', count: 1 }, { label: 'S3', count: 1 }],
  'A Level': [{ label: 'S4', count: 1 }, { label: 'S5', count: 1 }, { label: 'S6', count: 1 }],
  TVET: [{ label: 'TVET 1', count: 1 }, { label: 'TVET 2', count: 1 }, { label: 'TVET 3', count: 1 }],
};

interface OnboardingData {
  name: string;
  country: string;
  district: string;
  sector: string;
  referralSource: string;
  studentCount: number;
  teachingStaffCount: number;
  nonTeachingStaffCount: number;
  educationSystem: EducationSystem;
  levels: Level[];
  classes: ClassGroup[];
  subjects: Subject[];
  timing: SchoolTiming;
}

const initialTiming: SchoolTiming = {
  startTime: '08:00',
  endTime: '17:00',
  periodDuration: 40,
  hasBreaks: true,
  firstBreakTime: '10:00',
  firstBreakDuration: 20,
  lunchTime: '12:30',
  lunchDuration: 60,
  breaks: [],
  teachingDays: 5,
  maxDailyTeacherPeriods: 8,
  maxConsecutivePeriods: 2,
};

const defaultData: OnboardingData = {
  name: '',
  country: 'Rwanda',
  district: '',
  sector: '',
  referralSource: '',
  studentCount: 0,
  teachingStaffCount: 0,
  nonTeachingStaffCount: 0,
  educationSystem: 'Rwanda',
  levels: [],
  classes: [],
  subjects: [],
  timing: initialTiming,
};

type StepId =
  | 'welcome'
  | 'schoolName'
  | 'location'
  | 'referral'
  | 'studentCount'
  | 'teachingStaff'
  | 'nonTeachingStaff'
  | 'educationSystem'
  | 'levels'
  | 'classes'
  | 'subjects'
  | 'timingStart'
  | 'timingEnd'
  | 'periodDuration'
  | 'breaks'
  | 'breakTime'
  | 'lunchTime'
  | 'schedulePreview'
  | 'summary';

const STEP_ORDER: StepId[] = [
  'welcome', 'schoolName', 'location', 'referral', 'studentCount', 'teachingStaff', 'nonTeachingStaff',
  'educationSystem', 'levels', 'classes', 'subjects', 'timingStart', 'timingEnd', 'periodDuration',
  'breaks', 'breakTime', 'lunchTime', 'schedulePreview', 'summary',
];

export function Onboarding() {
  const [stepIndex, setStepIndex] = useState(0);
  const [data, setDataState] = useState<OnboardingData>(defaultData);
  const [classConfig, setClassConfig] = useState<Record<string, { count: number; naming: 'letters' | 'numbers' | 'custom' }>>({});
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [subjectSearch, setSubjectSearch] = useState('');

  const step = STEP_ORDER[stepIndex];
  const progress = Math.round((stepIndex / (STEP_ORDER.length - 1)) * 100);

  const next = () => setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  const canContinue = useMemo(() => {
    switch (step) {
      case 'schoolName': return data.name.trim().length > 0;
      case 'location': return data.district.length > 0;
      case 'referral': return data.referralSource.length > 0;
      case 'studentCount': return data.studentCount > 0;
      case 'teachingStaff': return data.teachingStaffCount > 0;
      case 'nonTeachingStaff': return data.nonTeachingStaffCount >= 0;
      case 'educationSystem': return data.educationSystem.length > 0;
      case 'levels': return data.levels.length > 0;
      case 'classes': return data.classes.length > 0;
      case 'subjects': return data.subjects.length > 0;
      case 'timingStart': return data.timing.startTime.length > 0;
      case 'timingEnd': return data.timing.endTime.length > 0;
      case 'periodDuration': return data.timing.periodDuration > 0;
      case 'breaks': return true;
      case 'breakTime': return !data.timing.hasBreaks || (data.timing.firstBreakTime.length > 0 && data.timing.lunchTime.length > 0);
      case 'lunchTime': return true;
      case 'schedulePreview': return true;
      default: return true;
    }
  }, [step, data]);

  const generateClasses = (level: Level, label: string, count: number, naming: 'letters' | 'numbers' | 'custom') => {
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const newClasses: ClassGroup[] = [];
    for (let i = 0; i < count; i++) {
      const suffix = naming === 'letters' ? letters[i] : naming === 'numbers' ? String(i + 1) : letters[i];
      newClasses.push({
        id: uid('cls'),
        level,
        name: `${label} ${suffix}`,
        capacity: 40,
      });
    }
    return newClasses;
  };

  const finalizeClasses = () => {
    const allClasses: ClassGroup[] = [];
    for (const level of data.levels) {
      const config = LEVEL_CLASSES[level];
      for (const c of config) {
        const cfg = classConfig[c.label] || { count: 1, naming: 'letters' as const };
        allClasses.push(...generateClasses(level, c.label, cfg.count, cfg.naming));
      }
    }
    setDataState({ ...data, classes: allClasses });
  };

  const finalizeSubjects = () => {
    const allSubjects: Subject[] = [];
    for (const level of data.levels) {
      const defaults = RWANDA_SUBJECTS[level] || [];
      for (const s of defaults) {
        if (selectedSubjects.has(`${level}-${s.name}`)) {
          allSubjects.push({
            id: uid('subj'),
            name: s.name,
            code: s.code,
            level,
            periodsPerWeek: s.periods,
            maxConsecutive: 2,
            classIds: [],
          });
        }
      }
    }
    setDataState({ ...data, subjects: allSubjects });
  };

  const completeSetup = () => {
    finalizeClasses();
    finalizeSubjects();
    const profile: SchoolProfile = {
      name: data.name,
      country: data.country,
      district: data.district,
      sector: data.sector,
      referralSource: data.referralSource,
      studentCount: data.studentCount,
      teachingStaffCount: data.teachingStaffCount,
      nonTeachingStaffCount: data.nonTeachingStaffCount,
      educationSystem: data.educationSystem,
      levels: data.levels,
    };
    const allClasses: ClassGroup[] = [];
    for (const level of data.levels) {
      const config = LEVEL_CLASSES[level];
      for (const c of config) {
        const cfg = classConfig[c.label] || { count: 1, naming: 'letters' as const };
        allClasses.push(...generateClasses(level, c.label, cfg.count, cfg.naming));
      }
    }
    const allSubjects: Subject[] = [];
    for (const level of data.levels) {
      const defaults = RWANDA_SUBJECTS[level] || [];
      for (const s of defaults) {
        if (selectedSubjects.has(`${level}-${s.name}`)) {
          allSubjects.push({
            id: uid('subj'),
            name: s.name,
            code: s.code,
            level,
            periodsPerWeek: s.periods,
            maxConsecutive: 2,
            classIds: [],
          });
        }
      }
    }
    setData((draft) => {
      draft.profile = profile;
      draft.timing = data.timing;
      draft.classes = allClasses;
      draft.subjects = allSubjects;
      draft.terms = [{ id: uid('term'), name: 'Term 1', startDate: '', endDate: '', current: true }];
      draft.onboardingComplete = true;
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Progress bar */}
      {step !== 'welcome' && (
        <div className="fixed top-0 left-0 right-0 z-30 h-1 bg-slate-200">
          <div
            className="h-full bg-navy-700 transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl">
          {step === 'welcome' && <WelcomeStep onStart={next} />}

          {step === 'schoolName' && (
            <StepLayout
              icon={<SchoolIcon size={28} />}
              title="Let's set up your school."
              question="What is the name of your school?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <input
                className="input-field text-lg"
                placeholder="e.g. GS Example Academy"
                value={data.name}
                autoFocus
                onChange={(e) => setDataState({ ...data, name: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && canContinue && next()}
              />
            </StepLayout>
          )}

          {step === 'location' && (
            <StepLayout
              icon={<MapPin size={28} />}
              title="Where is your school located?"
              question="Select your district and sector."
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Country</label>
                  <select
                    className="input-field"
                    value={data.country}
                    onChange={(e) => setDataState({ ...data, country: e.target.value, district: '', sector: '' })}
                  >
                    <option value="Rwanda">Rwanda</option>
                    <option value="Uganda">Uganda</option>
                    <option value="Kenya">Kenya</option>
                    <option value="Tanzania">Tanzania</option>
                    <option value="Burundi">Burundi</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">District</label>
                  <select
                    className="input-field"
                    value={data.district}
                    onChange={(e) => setDataState({ ...data, district: e.target.value, sector: '' })}
                  >
                    <option value="">Select district...</option>
                    {(data.country === 'Rwanda' ? RWANDA_DISTRICTS : ['District 1', 'District 2']).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                {data.district && (
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-slate-600">Sector</label>
                    <select
                      className="input-field"
                      value={data.sector}
                      onChange={(e) => setDataState({ ...data, sector: e.target.value })}
                    >
                      <option value="">Select sector...</option>
                      {(RWANDA_SECTORS[data.district] || DEFAULT_SECTORS).map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </StepLayout>
          )}

          {step === 'referral' && (
            <StepLayout
              icon={<Users size={28} />}
              title="How did you hear about S4Me?"
              question="This helps us improve our outreach."
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {['Referral', 'Google/Search', 'Social media', 'School recommendation', 'S4Me representative', 'Other'].map((src) => (
                  <button
                    key={src}
                    onClick={() => setDataState({ ...data, referralSource: src })}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      data.referralSource === src
                        ? 'border-navy-600 bg-navy-50 text-navy-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                      data.referralSource === src ? 'border-navy-600 bg-navy-600' : 'border-slate-300'
                    }`}>
                      {data.referralSource === src && <Check size={12} className="text-white" />}
                    </div>
                    {src}
                  </button>
                ))}
              </div>
            </StepLayout>
          )}

          {step === 'studentCount' && (
            <StepLayout
              icon={<Users size={28} />}
              title="School size"
              question="Approximately how many students are enrolled?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <NumberInput
                value={data.studentCount}
                onChange={(v) => setDataState({ ...data, studentCount: v })}
                placeholder="e.g. 500"
                autoFocus
              />
            </StepLayout>
          )}

          {step === 'teachingStaff' && (
            <StepLayout
              icon={<GraduationCap size={28} />}
              title="School size"
              question="How many teaching staff members do you have?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <NumberInput
                value={data.teachingStaffCount}
                onChange={(v) => setDataState({ ...data, teachingStaffCount: v })}
                placeholder="e.g. 32"
                autoFocus
              />
            </StepLayout>
          )}

          {step === 'nonTeachingStaff' && (
            <StepLayout
              icon={<Users size={28} />}
              title="School size"
              question="How many non-teaching staff members do you have?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
              skipLabel="Skip for now"
              onSkip={() => { setDataState({ ...data, nonTeachingStaffCount: 0 }); next(); }}
            >
              <NumberInput
                value={data.nonTeachingStaffCount}
                onChange={(v) => setDataState({ ...data, nonTeachingStaffCount: v })}
                placeholder="e.g. 8"
                autoFocus
              />
            </StepLayout>
          )}

          {step === 'educationSystem' && (
            <StepLayout
              icon={<BookOpen size={28} />}
              title="Education system"
              question="Which education system does your school use?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(['Rwanda', 'International', 'Other'] as EducationSystem[]).map((sys) => (
                  <button
                    key={sys}
                    onClick={() => setDataState({ ...data, educationSystem: sys, levels: [] })}
                    className={`rounded-lg border px-4 py-4 text-sm font-medium transition-colors ${
                      data.educationSystem === sys
                        ? 'border-navy-600 bg-navy-50 text-navy-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {sys}
                  </button>
                ))}
              </div>
            </StepLayout>
          )}

          {step === 'levels' && (
            <StepLayout
              icon={<Layers size={28} />}
              title="Education levels"
              question="Which levels does your school offer?"
              onBack={back}
              onContinue={() => { next(); }}
              canContinue={data.levels.length > 0}
            >
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(['Primary', 'O Level', 'A Level', 'TVET'] as Level[]).map((lvl) => {
                  const selected = data.levels.includes(lvl);
                  return (
                    <button
                      key={lvl}
                      onClick={() => {
                        setDataState({
                          ...data,
                          levels: selected
                            ? data.levels.filter((l) => l !== lvl)
                            : [...data.levels, lvl],
                        });
                      }}
                      className={`flex flex-col items-center gap-2 rounded-lg border px-4 py-5 text-sm font-medium transition-colors ${
                        selected
                          ? 'border-navy-600 bg-navy-50 text-navy-900'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`flex h-6 w-6 items-center justify-center rounded-md border-2 ${
                        selected ? 'border-navy-600 bg-navy-600' : 'border-slate-300'
                      }`}>
                        {selected && <Check size={14} className="text-white" />}
                      </div>
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </StepLayout>
          )}

          {step === 'classes' && (
            <ClassesStep
              data={data}
              classConfig={classConfig}
              setClassConfig={setClassConfig}
              onBack={back}
              onContinue={() => { finalizeClasses(); next(); }}
            />
          )}

          {step === 'subjects' && (
            <SubjectsStep
              data={data}
              selectedSubjects={selectedSubjects}
              setSelectedSubjects={setSelectedSubjects}
              subjectSearch={subjectSearch}
              setSubjectSearch={setSubjectSearch}
              onBack={back}
              onContinue={() => { finalizeSubjects(); next(); }}
            />
          )}

          {step === 'timingStart' && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="What time does the school day begin?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <input
                type="time"
                className="input-field text-lg"
                value={data.timing.startTime}
                onChange={(e) => setDataState({ ...data, timing: { ...data.timing, startTime: e.target.value } })}
                autoFocus
              />
            </StepLayout>
          )}

          {step === 'timingEnd' && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="What time does the school day end?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <input
                type="time"
                className="input-field text-lg"
                value={data.timing.endTime}
                onChange={(e) => setDataState({ ...data, timing: { ...data.timing, endTime: e.target.value } })}
                autoFocus
              />
            </StepLayout>
          )}

          {step === 'periodDuration' && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="How long is one lesson period?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="flex items-center gap-3">
                <NumberInput
                  value={data.timing.periodDuration}
                  onChange={(v) => setDataState({ ...data, timing: { ...data.timing, periodDuration: v } })}
                  placeholder="40"
                  autoFocus
                />
                <span className="text-sm font-medium text-slate-500">minutes</span>
              </div>
              <div className="mt-4 flex gap-2">
                {[30, 40, 45, 50, 60].map((d) => (
                  <button
                    key={d}
                    onClick={() => setDataState({ ...data, timing: { ...data.timing, periodDuration: d } })}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                      data.timing.periodDuration === d
                        ? 'border-navy-600 bg-navy-50 text-navy-900'
                        : 'border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </StepLayout>
          )}

          {step === 'breaks' && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="Does your school have scheduled breaks?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setDataState({ ...data, timing: { ...data.timing, hasBreaks: true } })}
                  className={`rounded-lg border px-4 py-4 text-sm font-medium transition-colors ${
                    data.timing.hasBreaks
                      ? 'border-navy-600 bg-navy-50 text-navy-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  Yes, we have breaks
                </button>
                <button
                  onClick={() => { setDataState({ ...data, timing: { ...data.timing, hasBreaks: false } }); }}
                  className={`rounded-lg border px-4 py-4 text-sm font-medium transition-colors ${
                    !data.timing.hasBreaks
                      ? 'border-navy-600 bg-navy-50 text-navy-900'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  No breaks
                </button>
              </div>
            </StepLayout>
          )}

          {step === 'breakTime' && data.timing.hasBreaks && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="When is the first break?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Break start time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={data.timing.firstBreakTime}
                    onChange={(e) => setDataState({ ...data, timing: { ...data.timing, firstBreakTime: e.target.value } })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Break duration (minutes)</label>
                  <NumberInput
                    value={data.timing.firstBreakDuration}
                    onChange={(v) => setDataState({ ...data, timing: { ...data.timing, firstBreakDuration: v } })}
                    placeholder="20"
                  />
                </div>
              </div>
            </StepLayout>
          )}

          {step === 'breakTime' && !data.timing.hasBreaks && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="Review your school day timing."
              onBack={back}
              onContinue={next}
              canContinue={true}
            >
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
                <p className="font-medium text-navy-900">{data.timing.startTime} — {data.timing.endTime}</p>
                <p className="text-slate-500">{data.timing.periodDuration} minute periods, no scheduled breaks</p>
              </div>
            </StepLayout>
          )}

          {step === 'lunchTime' && data.timing.hasBreaks && (
            <StepLayout
              icon={<Clock size={28} />}
              title="School timing"
              question="When is lunch?"
              onBack={back}
              onContinue={next}
              canContinue={canContinue}
            >
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Lunch start time</label>
                  <input
                    type="time"
                    className="input-field"
                    value={data.timing.lunchTime}
                    onChange={(e) => setDataState({ ...data, timing: { ...data.timing, lunchTime: e.target.value } })}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-600">Lunch duration (minutes)</label>
                  <NumberInput
                    value={data.timing.lunchDuration}
                    onChange={(v) => setDataState({ ...data, timing: { ...data.timing, lunchDuration: v } })}
                    placeholder="60"
                  />
                </div>
              </div>
            </StepLayout>
          )}

          {step === 'lunchTime' && !data.timing.hasBreaks && (
            <SchedulePreview data={data} onBack={back} onContinue={next} />
          )}

          {step === 'schedulePreview' && (
            <SchedulePreview data={data} onBack={back} onContinue={next} />
          )}

          {step === 'summary' && (
            <SummaryStep data={data} onBack={back} onComplete={completeSetup} />
          )}
        </div>
      </div>
    </div>
  );
}

function WelcomeStep({ onStart }: { onStart: () => void }) {
  return (
    <div className="text-center">
      <div className="mb-6 flex justify-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-navy-800 text-white shadow-elevated">
          <SchoolIcon size={40} />
        </div>
      </div>
      <h1 className="mb-3 text-3xl font-bold tracking-tight text-navy-900">Welcome to S4Me</h1>
      <p className="mb-8 text-base text-slate-500">
        Let's set up your school in a few simple steps. We'll ask one question at a time.
      </p>
      <button onClick={onStart} className="btn-primary text-base">
        Start setup
        <ArrowRight size={18} />
      </button>
    </div>
  );
}

interface StepLayoutProps {
  icon: React.ReactNode;
  title: string;
  question: string;
  children: React.ReactNode;
  onBack: () => void;
  onContinue: () => void;
  canContinue: boolean;
  skipLabel?: string;
  onSkip?: () => void;
}

function StepLayout({ icon, title, question, children, onBack, onContinue, canContinue, skipLabel, onSkip }: StepLayoutProps) {
  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          {icon}
        </div>
        <h2 className="mb-1 text-xl font-semibold text-navy-900">{title}</h2>
        <p className="text-sm text-slate-500">{question}</p>
      </div>
      <div className="mb-8">{children}</div>
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="flex items-center gap-3">
          {skipLabel && onSkip && (
            <button onClick={onSkip} className="btn-ghost text-slate-500">
              {skipLabel}
            </button>
          )}
          <button onClick={onContinue} disabled={!canContinue} className="btn-primary">
            Continue
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NumberInput({ value, onChange, placeholder, autoFocus }: { value: number; onChange: (v: number) => void; placeholder?: string; autoFocus?: boolean }) {
  return (
    <input
      type="number"
      className="input-field text-lg"
      placeholder={placeholder}
      value={value || ''}
      autoFocus={autoFocus}
      onChange={(e) => onChange(parseInt(e.target.value) || 0)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function ClassesStep({
  data,
  classConfig,
  setClassConfig,
  onBack,
  onContinue,
}: {
  data: OnboardingData;
  classConfig: Record<string, { count: number; naming: 'letters' | 'numbers' | 'custom' }>;
  setClassConfig: React.Dispatch<React.SetStateAction<Record<string, { count: number; naming: 'letters' | 'numbers' | 'custom' }>>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const levels = data.levels;
  const currentLevel = levels[currentLevelIdx];
  const levelConfig = currentLevel ? LEVEL_CLASSES[currentLevel] : [];

  const [gradeIdx, setGradeIdx] = useState(0);
  const currentGrade = levelConfig[gradeIdx];
  const cfg = currentGrade ? (classConfig[currentGrade.label] || { count: 1, naming: 'letters' as const }) : null;

  if (!currentLevel || !currentGrade || !cfg) {
    if (currentLevelIdx < levels.length - 1) {
      return null;
    }
    return (
      <StepLayout
        icon={<Layers size={28} />}
        title="Classes"
        question="All levels configured."
        onBack={onBack}
        onContinue={onContinue}
        canContinue={true}
      >
        <p className="text-sm text-slate-500">All classes have been configured. Continue to the next step.</p>
      </StepLayout>
    );
  }

  const isLastGrade = gradeIdx === levelConfig.length - 1;
  const isLastLevel = currentLevelIdx === levels.length - 1;

  const handleContinue = () => {
    if (isLastGrade && isLastLevel) {
      onContinue();
    } else if (isLastGrade) {
      setCurrentLevelIdx(currentLevelIdx + 1);
      setGradeIdx(0);
    } else {
      setGradeIdx(gradeIdx + 1);
    }
  };

  const totalClasses = Object.values(classConfig).reduce((sum, c) => sum + c.count, 0);

  return (
    <div>
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <Layers size={28} />
        </div>
        <h2 className="mb-1 text-xl font-semibold text-navy-900">Set up classes for {currentLevel}</h2>
        <p className="text-sm text-slate-500">
          Grade {gradeIdx + 1} of {levelConfig.length} for {currentLevel} · {totalClasses} classes configured so far
        </p>
      </div>

      <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-medium text-navy-900">How many classes does {currentGrade.label} have?</p>
      </div>

      <div className="mb-6">
        <NumberInput
          value={cfg.count}
          onChange={(v) => setClassConfig({ ...classConfig, [currentGrade.label]: { ...cfg, count: Math.max(1, v) } })}
          placeholder="1"
          autoFocus
        />
      </div>

      {cfg.count > 1 && (
        <div className="mb-6">
          <p className="mb-3 text-sm font-medium text-navy-900">How would you like to name them?</p>
          <div className="grid grid-cols-3 gap-2">
            {([
              { key: 'letters' as const, label: `${currentGrade.label} A, B, C` },
              { key: 'numbers' as const, label: `${currentGrade.label} 1, 2, 3` },
              { key: 'custom' as const, label: 'Custom' },
            ]).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setClassConfig({ ...classConfig, [currentGrade.label]: { ...cfg, naming: opt.key } })}
                className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                  cfg.naming === opt.key
                    ? 'border-navy-600 bg-navy-50 text-navy-900'
                    : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Preview of generated class names */}
      {cfg.count > 0 && (
        <div className="mb-8 flex flex-wrap gap-2">
          {Array.from({ length: cfg.count }).map((_, i) => {
            const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            const suffix = cfg.naming === 'numbers' ? String(i + 1) : letters[i];
            return (
              <span key={i} className="rounded-md bg-navy-50 px-2.5 py-1 text-xs font-medium text-navy-700">
                {currentGrade.label} {suffix}
              </span>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (gradeIdx > 0) setGradeIdx(gradeIdx - 1);
            else if (currentLevelIdx > 0) {
              setCurrentLevelIdx(currentLevelIdx - 1);
              setGradeIdx(LEVEL_CLASSES[levels[currentLevelIdx - 1]].length - 1);
            } else onBack();
          }}
          className="btn-ghost"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button onClick={handleContinue} className="btn-primary">
          {isLastGrade && isLastLevel ? 'Continue' : 'Next'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SubjectsStep({
  data,
  selectedSubjects,
  setSelectedSubjects,
  subjectSearch,
  setSubjectSearch,
  onBack,
  onContinue,
}: {
  data: OnboardingData;
  selectedSubjects: Set<string>;
  setSelectedSubjects: React.Dispatch<React.SetStateAction<Set<string>>>;
  subjectSearch: string;
  setSubjectSearch: React.Dispatch<React.SetStateAction<string>>;
  onBack: () => void;
  onContinue: () => void;
}) {
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const levels = data.levels;
  const currentLevel = levels[currentLevelIdx];
  const availableSubjects = currentLevel ? (RWANDA_SUBJECTS[currentLevel] || []) : [];
  const filtered = availableSubjects.filter((s) =>
    s.name.toLowerCase().includes(subjectSearch.toLowerCase()),
  );

  if (!currentLevel) {
    return (
      <StepLayout
        icon={<BookOpen size={28} />}
        title="Subjects"
        question="All levels configured."
        onBack={onBack}
        onContinue={onContinue}
        canContinue={selectedSubjects.size > 0}
      >
        <p className="text-sm text-slate-500">Continue to the next step.</p>
      </StepLayout>
    );
  }

  const isLastLevel = currentLevelIdx === levels.length - 1;

  const toggle = (subjectName: string) => {
    const key = `${currentLevel}-${subjectName}`;
    const next = new Set(selectedSubjects);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSubjects(next);
  };

  const selectAll = () => {
    const next = new Set(selectedSubjects);
    availableSubjects.forEach((s) => next.add(`${currentLevel}-${s.name}`));
    setSelectedSubjects(next);
  };

  const levelSelectedCount = availableSubjects.filter((s) => selectedSubjects.has(`${currentLevel}-${s.name}`)).length;

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <BookOpen size={28} />
        </div>
        <h2 className="mb-1 text-xl font-semibold text-navy-900">Subjects for {currentLevel}</h2>
        <p className="text-sm text-slate-500">
          Level {currentLevelIdx + 1} of {levels.length} · {levelSelectedCount} of {availableSubjects.length} selected
        </p>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <input
          className="input-field"
          placeholder="Search subjects..."
          value={subjectSearch}
          onChange={(e) => setSubjectSearch(e.target.value)}
        />
        <button onClick={selectAll} className="btn-secondary whitespace-nowrap">
          Select all
        </button>
      </div>

      <div className="mb-8 max-h-64 space-y-2 overflow-y-auto scrollbar-thin">
        {filtered.map((s) => {
          const key = `${currentLevel}-${s.name}`;
          const selected = selectedSubjects.has(key);
          return (
            <button
              key={key}
              onClick={() => toggle(s.name)}
              className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                selected
                  ? 'border-navy-600 bg-navy-50'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-5 w-5 items-center justify-center rounded border-2 ${
                  selected ? 'border-navy-600 bg-navy-600' : 'border-slate-300'
                }`}>
                  {selected && <Check size={12} className="text-white" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-navy-900">{s.name}</p>
                  <p className="text-xs text-slate-400">{s.code} · default {s.periods} periods/week</p>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => {
            if (currentLevelIdx > 0) {
              setCurrentLevelIdx(currentLevelIdx - 1);
              setSubjectSearch('');
            } else onBack();
          }}
          className="btn-ghost"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <button
          onClick={() => {
            if (isLastLevel) onContinue();
            else { setCurrentLevelIdx(currentLevelIdx + 1); setSubjectSearch(''); }
          }}
          disabled={levelSelectedCount === 0}
          className="btn-primary"
        >
          {isLastLevel ? 'Continue' : 'Next level'}
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function SchedulePreview({ data, onBack, onContinue }: { data: OnboardingData; onBack: () => void; onContinue: () => void }) {
  const periods = useMemo(() => {
    const result: { label: string; time: string; isBreak: boolean }[] = [];
    const [sh, sm] = data.timing.startTime.split(':').map(Number);
    const [eh, em] = data.timing.endTime.split(':').map(Number);
    let cursor = sh * 60 + sm;
    const end = eh * 60 + em;
    const dur = data.timing.periodDuration;
    let idx = 0;

    const breaks: { time: number; duration: number; label: string }[] = [];
    if (data.timing.hasBreaks) {
      breaks.push({ time: toMin(data.timing.firstBreakTime), duration: data.timing.firstBreakDuration, label: 'Break' });
      breaks.push({ time: toMin(data.timing.lunchTime), duration: data.timing.lunchDuration, label: 'Lunch' });
    }
    breaks.sort((a, b) => a.time - b.time);

    while (cursor + dur <= end) {
      while (breaks.length > 0 && breaks[0].time <= cursor) {
        const b = breaks.shift()!;
        result.push({ label: b.label, time: toTime(b.time), isBreak: true });
        cursor = b.time + b.duration;
      }
      if (cursor + dur > end) break;
      result.push({ label: `Period ${idx + 1}`, time: toTime(cursor), isBreak: false });
      cursor += dur;
      idx++;
    }
    return result;
  }, [data.timing]);

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-50 text-navy-700">
          <Clock size={28} />
        </div>
        <h2 className="mb-1 text-xl font-semibold text-navy-900">Your school day</h2>
        <p className="text-sm text-slate-500">Here's how the daily schedule will look. You can adjust this later.</p>
      </div>

      <div className="mb-8 overflow-hidden rounded-lg border border-slate-200">
        {periods.map((p, i) => (
          <div
            key={i}
            className={`flex items-center justify-between border-b border-slate-100 px-4 py-2.5 last:border-b-0 ${
              p.isBreak ? 'bg-warning-50/50' : 'bg-white'
            }`}
          >
            <span className={`text-sm ${p.isBreak ? 'font-medium text-warning-700' : 'font-medium text-navy-900'}`}>
              {p.label}
            </span>
            <span className="text-sm text-slate-500">{p.time}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={16} />
          Back
        </button>
        <button onClick={onContinue} className="btn-primary">
          Continue
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}

function toMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTime(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

function SummaryStep({ data, onBack, onComplete }: { data: OnboardingData; onBack: () => void; onComplete: () => void }) {
  const totalClasses = Object.values(classConfigSummary(data)).reduce((s, c) => s + c, 0);

  return (
    <div>
      <div className="mb-6">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-50 text-accent-600">
          <Check size={28} />
        </div>
        <h2 className="mb-1 text-xl font-semibold text-navy-900">Your school setup</h2>
        <p className="text-sm text-slate-500">Please review before completing.</p>
      </div>

      <div className="mb-8 space-y-3">
        <SummaryRow label="School" value={data.name} />
        <SummaryRow label="Location" value={`${data.district}${data.sector ? ', ' + data.sector : ''}, ${data.country}`} />
        <SummaryRow label="Students" value={String(data.studentCount)} />
        <SummaryRow label="Teachers" value={String(data.teachingStaffCount)} />
        <SummaryRow label="Non-teaching staff" value={String(data.nonTeachingStaffCount)} />
        <SummaryRow label="Education system" value={data.educationSystem} />
        <SummaryRow label="Levels" value={data.levels.join(', ')} />
        <SummaryRow label="Classes" value={`${totalClasses} classes`} />
        <SummaryRow label="School day" value={`${data.timing.startTime}–${data.timing.endTime}`} />
        <SummaryRow label="Period duration" value={`${data.timing.periodDuration} minutes`} />
      </div>

      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn-ghost">
          <ArrowLeft size={16} />
          Back
        </button>
        <button onClick={onComplete} className="btn-primary text-base">
          <Check size={18} />
          Complete setup
        </button>
      </div>
    </div>
  );
}

function classConfigSummary(data: OnboardingData): Record<string, number> {
  const result: Record<string, number> = {};
  for (const level of data.levels) {
    const config = LEVEL_CLASSES[level];
    for (const c of config) {
      result[c.label] = 1;
    }
  }
  return result;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 py-2.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-navy-900">{value}</span>
    </div>
  );
}
