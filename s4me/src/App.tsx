import { useState, useEffect } from 'react';
import { useSchoolData, initStore, resetStore } from '@/store';
import { Onboarding } from '@/components/Onboarding';
import { DashboardLayout, type PageId } from '@/components/DashboardLayout';
import { DashboardPage } from '@/pages/DashboardPage';
import { SchoolPage } from '@/pages/SchoolPage';
import { ClassesPage } from '@/pages/ClassesPage';
import { SubjectsPage } from '@/pages/SubjectsPage';
import { StaffPage } from '@/pages/StaffPage';
import { TimetablePage } from '@/pages/TimetablePage';
import { StudentsPage } from '@/pages/StudentsPage';
import { AssessmentsPage } from '@/pages/AssessmentsPage';
import { ResultsPage } from '@/pages/ResultsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { LoginPage } from '@/pages/LoginPage';
import { useAuth } from '@/lib/auth';

function App() {
  const { user, loading } = useAuth();
  const data = useSchoolData();
  const [page, setPage] = useState<PageId>('dashboard');
  const [storeReady, setStoreReady] = useState(false);

  useEffect(() => {
    if (user) {
      initStore().then(() => setStoreReady(true));
    } else {
      resetStore();
      setStoreReady(false);
    }
  }, [user]);

  useEffect(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTop = 0;
  }, [page]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (!storeReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-sm text-slate-400">Loading your school data...</div>
      </div>
    );
  }

  if (!data.onboardingComplete || !data.profile) {
    return <Onboarding />;
  }

  return (
    <DashboardLayout currentPage={page} onNavigate={setPage}>
      {page === 'dashboard' && <DashboardPage onNavigate={setPage} />}
      {page === 'school' && <SchoolPage />}
      {page === 'classes' && <ClassesPage />}
      {page === 'subjects' && <SubjectsPage />}
      {page === 'staff' && <StaffPage />}
      {page === 'timetable' && <TimetablePage />}
      {page === 'students' && <StudentsPage />}
      {page === 'assessments' && <AssessmentsPage />}
      {page === 'results' && <ResultsPage />}
      {page === 'reports' && <ReportsPage />}
      {page === 'settings' && <SettingsPage />}
    </DashboardLayout>
  );
}

export default App;
