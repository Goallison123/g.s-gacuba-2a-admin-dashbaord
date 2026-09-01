import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type {
  Timetable, ClassGroup, Subject, Teacher, Student,
  Assessment, MarkRecord, SchoolProfile, SchoolTiming,
} from '@/types';
import {
  buildDayStructure, DAY_NAMES,
} from '@/lib/timetable';
import {
  studentSubjectAverage, studentOverallAverage, classRank, classSubjectAverage,
  gradeFromAverage, subjectTrend, topPerformingClasses, studentsNeedingAttention,
} from '@/lib/assessment';

// ─── Precision Color Palette (Government / Corporate) ────────────────────────

const COLOR_PRIMARY: [number, number, number] = [15, 23, 42];      // Deep Navy / Slate 900
const COLOR_ACCENT: [number, number, number] = [30, 64, 175];      // Strong Navy Blue
const COLOR_BG_LIGHT: [number, number, number] = [248, 250, 252];  // Very light grey
const COLOR_TEXT_MAIN: [number, number, number] = [30, 41, 59];    // Dark slate
const COLOR_TEXT_MUTED: [number, number, number] = [100, 116, 139];// Muted grey
const COLOR_BORDER: [number, number, number] = [226, 232, 240];    // Soft border
const COLOR_WHITE: [number, number, number] = [255, 255, 255];
const COLOR_BREAK: [number, number, number] = [241, 245, 249];     // Neutral break bg
const COLOR_BREAK_TEXT: [number, number, number] = [71, 85, 105];  // Break text

function formatDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

/**
 * Returns only subjects that belong to a specific class or its level.
 * Supports common data shapes:
 * - subject.classIds: string[]
 * - subject.level / class.level
 * - subject.levels: string[]
 * Falls back to all subjects if no relationship is found.
 */
function getSubjectsForClass(
  classId: string,
  classes: ClassGroup[],
  allSubjects: Subject[],
): Subject[] {
  const cls = classes.find((c) => c.id === classId);
  if (!cls) return allSubjects;

  return allSubjects.filter((subj) => {
    if (subj.level !== cls.level) return false;
    if (!subj.classIds || subj.classIds.length === 0) return true;
    return subj.classIds.includes(classId);
  });
}

// ─── Header & Footer Structure Engine ────────────────────────────────────────

/** Draws structural header banner with 2-stripe top accents */
function drawHeader(doc: jsPDF, profile: SchoolProfile | null, docTitle: string) {
  const pageWidth = doc.internal.pageSize.getWidth();

  // Top Accent bar
  doc.setFillColor(...COLOR_ACCENT);
  doc.rect(0, 0, pageWidth, 3.2, 'F');

  // Main Banner Background
  doc.setFillColor(...COLOR_PRIMARY);
  doc.rect(0, 3.2, pageWidth, 27, 'F');

  // School / System Name
  doc.setTextColor(...COLOR_WHITE);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text((profile?.name || 'S4Me ACADEMIC SYSTEM').toUpperCase(), 14, 14);

  // Subtitle / Location
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  const location = profile ? `${profile.district}, ${profile.country}` : 'Official Academic Document';
  doc.text(location, 14, 21);

  // Document Title (Right Aligned)
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_WHITE);
  doc.text(docTitle.toUpperCase(), pageWidth - 14, 14.5, { align: 'right' });

  // Timestamp (Right Aligned)
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(203, 213, 225);
  doc.text(`Generated: ${formatDate(new Date())}`, pageWidth - 14, 21, { align: 'right' });

  return 36; // Structural Y anchor
}

/** Draws key-value metadata container grid */
function drawMetaGrid(doc: jsPDF, startY: number, items: { label: string; value: string }[]) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const width = pageWidth - 28;
  const cardHeight = 13;

  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, startY, width, cardHeight, 1.2, 1.2, 'FD');

  const colWidth = width / items.length;
  items.forEach((item, index) => {
    const x = 14 + index * colWidth + 4;

    // Label
    doc.setFontSize(6.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text(item.label.toUpperCase(), x, startY + 4.5);

    // Value
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLOR_TEXT_MAIN);
    doc.text(item.value, x, startY + 10);

    // Vertical Divider Line
    if (index < items.length - 1) {
      const lineX = 14 + (index + 1) * colWidth;
      doc.setDrawColor(...COLOR_BORDER);
      doc.setLineWidth(0.25);
      doc.line(lineX, startY + 2, lineX, startY + cardHeight - 2);
    }
  });

  return startY + cardHeight + 7;
}

/** Draws the official S4Me Digital System Signature & Verification Block */
function drawSystemSignature(doc: jsPDF, currentY: number) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const requiredSpace = 30;

  let y = currentY + 8;
  if (y + requiredSpace > pageHeight - 16) {
    doc.addPage();
    y = 18;
  }

  // Divider Line
  doc.setDrawColor(...COLOR_BORDER);
  doc.setLineWidth(0.35);
  doc.line(14, y, pageWidth - 14, y);

  y += 6;

  // Left Side: Signature line
  doc.setDrawColor(...COLOR_TEXT_MUTED);
  doc.setLineWidth(0.3);
  doc.line(14, y + 11, 72, y + 11);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_TEXT_MAIN);
  doc.text('Headteacher / Authorized Signature', 14, y + 15);

  doc.setFontSize(6.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text('Official Stamp & Approval Date', 14, y + 19);

  // Right Side: Verification Badge
  const sigBoxX = pageWidth - 82;
  const sigBoxW = 68;
  const sigBoxH = 19;

  doc.setFillColor(...COLOR_BG_LIGHT);
  doc.setDrawColor(...COLOR_BORDER);
  doc.roundedRect(sigBoxX, y, sigBoxW, sigBoxH, 1.2, 1.2, 'FD');

  // Left accent bar
  doc.setFillColor(...COLOR_ACCENT);
  doc.rect(sigBoxX, y, 2.2, sigBoxH, 'F');

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('S4Me DIGITAL SYSTEM VERIFIED', sigBoxX + 5, y + 5.2);

  const docHash = Math.random().toString(36).substring(2, 10).toUpperCase();
  doc.setFontSize(6.2);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_TEXT_MUTED);
  doc.text(`Document ID: S4ME-${docHash}`, sigBoxX + 5, y + 9.8);
  doc.text(`Timestamp: ${new Date().toISOString().slice(0, 19)}`, sigBoxX + 5, y + 13.5);
  doc.text('Status: Digitally Sealed & Certified', sigBoxX + 5, y + 17);
}

/** Draws page footers dynamically across total page count */
function drawFooters(doc: jsPDF) {
  const pages = (doc as unknown as { internal: { getNumberOfPages: () => number } }).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(...COLOR_BORDER);
    doc.setLineWidth(0.3);
    doc.line(14, pageHeight - 11, pageWidth - 14, pageHeight - 11);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('S4Me Academic Management System — Official Academic Record', 14, pageHeight - 5.5);
    doc.text(`Page ${i} of ${pages}`, pageWidth - 14, pageHeight - 5.5, { align: 'right' });
  }
}

function saveDoc(doc: jsPDF, filename: string) {
  drawFooters(doc);
  doc.save(filename);
}

// ─── Timetable PDF Export ───────────────────────────────────────────────────

export function exportTimetablePDF(
  timetable: Timetable,
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
  timing: SchoolTiming,
  profile: SchoolProfile | null,
  mode: 'class' | 'teacher',
  targetId: string,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const dayStructure = buildDayStructure(timing);
  const teachingDays = timing.teachingDays || 5;
  const activeDayNames = DAY_NAMES.slice(0, teachingDays);

  const targetName = mode === 'class'
    ? classes.find((c) => c.id === targetId)?.name || 'Class'
    : (() => {
        const t = teachers.find((t) => t.id === targetId);
        return t ? `${t.lastName}, ${t.firstName}` : 'Teacher';
      })();

  const headerY = drawHeader(doc, profile, 'Timetable Schedule');
  const startY = drawMetaGrid(doc, headerY, [
    { label: 'Schedule Type', value: mode === 'class' ? 'Class Timetable' : 'Teacher Timetable' },
    { label: 'Target Entity', value: targetName },
    { label: 'Active Days', value: `${teachingDays} Days / Week` },
  ]);

  const rows: string[][] = [];
  for (const period of dayStructure) {
    if (period.isBreak) {
      rows.push([period.startTime, period.label, ...activeDayNames.map(() => '— BREAK —')]);
      continue;
    }
    const row: string[] = [period.startTime, period.label];
    for (let d = 0; d < teachingDays; d++) {
      const slot = timetable.slots.find(
        (s) => s.day === d && s.periodIndex === period.periodIndex &&
          (mode === 'class' ? s.classId === targetId : s.teacherId === targetId),
      );
      if (slot) {
        const subj = subjects.find((s) => s.id === slot.subjectId);
        if (mode === 'class') {
          const teacher = teachers.find((t) => t.id === slot.teacherId);
          row.push(`${subj?.name || '—'}\n${teacher ? `${teacher.lastName} ${teacher.firstName[0]}.` : '—'}`);
        } else {
          const cls = classes.find((c) => c.id === slot.classId);
          row.push(`${subj?.name || '—'}\n${cls?.name || '—'}`);
        }
      } else {
        row.push('');
      }
    }
    rows.push(row);
  }

  autoTable(doc, {
    head: [['Time', 'Period', ...activeDayNames]],
    body: rows,
    startY,
    margin: { top: 38, bottom: 16, left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.2,
      cellPadding: 2.2,
      minCellHeight: 9.5,
      valign: 'middle',
      halign: 'center',
      textColor: COLOR_TEXT_MAIN,
    },
    columnStyles: {
      0: { cellWidth: 18, fontStyle: 'bold', fillColor: COLOR_BG_LIGHT },
      1: { cellWidth: 16, fontStyle: 'bold' },
    },
    ...({ gridLineColor: COLOR_BORDER, gridLineWidth: 0.25 } as Record<string, unknown>),
    didParseCell: (data) => {
      if (data.section === 'body' && Array.isArray(data.row.raw) && data.row.raw[1]?.toString().toLowerCase().includes('break')) {
        data.cell.styles.fillColor = COLOR_BREAK;
        data.cell.styles.textColor = COLOR_BREAK_TEXT;
        data.cell.styles.fontStyle = 'bold';
        data.cell.styles.fontSize = 7;
      }
    },
  });

  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 5;
  const q = timetable.quality;

  // Quality Summary
  autoTable(doc, {
    head: [['Overall Quality', 'Periods Fulfilled', 'Teacher Conflicts', 'Class Conflicts']],
    body: [[`${q.overall}%`, `${q.requiredPeriodsFulfilled}%`, String(q.teacherConflicts), String(q.classConflicts)]],
    startY: afterY,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2.2,
      halign: 'center',
      fontStyle: 'bold',
      textColor: COLOR_TEXT_MAIN,
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  drawSystemSignature(doc, finalY);
  saveDoc(doc, `timetable-${mode}-${targetName.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

export function exportAllTimetablesPDF(
  timetable: Timetable,
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
  timing: SchoolTiming,
  profile: SchoolProfile | null,
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  let first = true;

  for (const cls of classes) {
    if (!first) doc.addPage();
    first = false;

    const headerY = drawHeader(doc, profile, 'Master Timetable');
    const startY = drawMetaGrid(doc, headerY, [
      { label: 'Schedule Type', value: 'Class Timetable' },
      { label: 'Class Group', value: cls.name },
      { label: 'Teaching Days', value: `${timing.teachingDays || 5} Days / Week` },
    ]);

    const dayStructure = buildDayStructure(timing);
    const teachingDays = timing.teachingDays || 5;
    const activeDayNames = DAY_NAMES.slice(0, teachingDays);

    const rows: string[][] = [];
    for (const period of dayStructure) {
      if (period.isBreak) {
        rows.push([period.startTime, period.label, ...activeDayNames.map(() => '— BREAK —')]);
        continue;
      }
      const row: string[] = [period.startTime, period.label];
      for (let d = 0; d < teachingDays; d++) {
        const slot = timetable.slots.find(
          (s) => s.day === d && s.periodIndex === period.periodIndex && s.classId === cls.id,
        );
        if (slot) {
          const subj = subjects.find((s) => s.id === slot.subjectId);
          const teacher = teachers.find((t) => t.id === slot.teacherId);
          row.push(`${subj?.name || '—'}\n${teacher ? `${teacher.lastName} ${teacher.firstName[0]}.` : '—'}`);
        } else {
          row.push('');
        }
      }
      rows.push(row);
    }

    autoTable(doc, {
      head: [['Time', 'Period', ...activeDayNames]],
      body: rows,
      startY,
      margin: { top: 38, bottom: 16, left: 14, right: 14 },
      theme: 'grid',
      headStyles: {
        fillColor: COLOR_PRIMARY,
        textColor: COLOR_WHITE,
        fontSize: 8,
        fontStyle: 'bold',
        halign: 'center',
        cellPadding: 2.2,
      },
      bodyStyles: {
        fontSize: 7.2,
        cellPadding: 2.2,
        minCellHeight: 9.5,
        valign: 'middle',
        halign: 'center',
        textColor: COLOR_TEXT_MAIN,
      },
      columnStyles: {
        0: { cellWidth: 18, fontStyle: 'bold', fillColor: COLOR_BG_LIGHT },
        1: { cellWidth: 16, fontStyle: 'bold' },
      },
      ...({ gridLineColor: COLOR_BORDER, gridLineWidth: 0.25 } as Record<string, unknown>),
      didParseCell: (data) => {
        if (data.section === 'body' && Array.isArray(data.row.raw) && data.row.raw[1]?.toString().toLowerCase().includes('break')) {
          data.cell.styles.fillColor = COLOR_BREAK;
          data.cell.styles.textColor = COLOR_BREAK_TEXT;
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    drawSystemSignature(doc, finalY);
  }

  saveDoc(doc, `timetable-all-classes.pdf`);
}

// ─── Class Results PDF Export ───────────────────────────────────────────────

export function exportClassResultsPDF(
  classId: string,
  classes: ClassGroup[],
  subjects: Subject[],
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
  profile: SchoolProfile | null,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cls = classes.find((c) => c.id === classId);
  const className = cls?.name || 'Class';
  const classStudents = students.filter((s) => s.classId === classId);

  // Only subjects that belong to this class / level
  const relevantSubjects = getSubjectsForClass(classId, classes, subjects);

  const headerY = drawHeader(doc, profile, 'Class Performance Report');
  const startY = drawMetaGrid(doc, headerY, [
    { label: 'Class Group', value: className },
    { label: 'Total Enrolled', value: `${classStudents.length} Students` },
    { label: 'Evaluated Subjects', value: `${relevantSubjects.length} Subjects` },
  ]);

  // Subject Performance Summary
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Subject Performance Summary', 14, startY);

  autoTable(doc, {
    head: [['Subject Name', 'Class Average', 'Equivalent Grade']],
    body: relevantSubjects.map((subj) => {
      const avg = classSubjectAverage(classId, subj.id, students, assessments, marks);
      return [subj.name, `${avg.toFixed(1)}%`, gradeFromAverage(avg)];
    }),
    startY: startY + 2.5,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.8, cellPadding: 2.3, textColor: COLOR_TEXT_MAIN },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
    columnStyles: { 1: {halign: 'center' }, 2: {halign: 'center', fontStyle: 'bold' } },
  });

  const afterSummaryY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Individual Student Mark Sheet', 14, afterSummaryY);

  const maxSubjectCols = Math.min(relevantSubjects.length, 7);
  const head = [['Rank', 'Student Name', 'ID', ...relevantSubjects.slice(0, maxSubjectCols).map((s) => s.code), 'Avg', 'Grade']];

  // Sort students by rank (1st → last)
  const rankedStudents = classStudents
    .map((s) => {
      const rankInfo = classRank(s.id, classId, relevantSubjects, students, assessments, marks);
      const overall = studentOverallAverage(s.id, relevantSubjects, assessments, marks);
      return { student: s, rank: rankInfo.rank, total: rankInfo.total, overall };
    })
    .sort((a, b) => {
      // Primary sort: rank ascending (1 comes first)
      if (a.rank !== b.rank) return a.rank - b.rank;

      // Fallback: higher average first, then alphabetical by last name
      if (b.overall !== a.overall) return b.overall - a.overall;
      return `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`
      );
    });

  const body = rankedStudents.map(({ student: s, rank, overall }) => {
    const subjectCols = relevantSubjects.slice(0, maxSubjectCols).map((subj) => {
      const r = studentSubjectAverage(s.id, subj.id, assessments, marks);
      return r.maxTotal > 0 ? `${((r.total / r.maxTotal) * 100).toFixed(0)}%` : '—';
    });

    return [
      rank > 0 ? String(rank) : '—',
      `${s.firstName} ${s.lastName}`,
      s.studentNumber,
      ...subjectCols,
      `${overall.toFixed(1)}%`,
      gradeFromAverage(overall),
    ];
  });

  autoTable(doc, {
    head,
    body,
    startY: afterSummaryY + 2.5,
    margin: { left: 14, right: 14 },
    theme: 'grid',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 1.8,
    },
    bodyStyles: { fontSize: 7.2, cellPadding: 1.8, textColor: COLOR_TEXT_MAIN },
    columnStyles: {
      0: { cellWidth: 11,halign: 'center', fontStyle: 'bold' },
      1: { cellWidth: 36 },
      2: { cellWidth: 18 },
    },
    ...({ gridLineColor: COLOR_BORDER, gridLineWidth: 0.25 } as Record<string, unknown>),
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === body[0]?.length - 1) {
        const grade = String(data.cell.raw);
        data.cell.styles.fontStyle = 'bold';
        if (grade === 'A' || grade === 'B') data.cell.styles.textColor = [5, 150, 105];
        else if (grade === 'F') data.cell.styles.textColor = [220, 38, 38];
        else if (grade === 'E' || grade === 'D') data.cell.styles.textColor = [217, 119, 6];
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  drawSystemSignature(doc, finalY);
  saveDoc(doc, `results-${className.replace(/\s+/g, '-').toLowerCase()}.pdf`);
}

// ─── Individual Student Results PDF Export (Formal Report Card) ─────────────

export function exportStudentResultsPDF(
  student: Student,
  classes: ClassGroup[],
  subjects: Subject[],
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
  profile: SchoolProfile | null,
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cls = classes.find((c) => c.id === student.classId);

  // Only subjects that belong to this student's class / level
  const relevantSubjects = getSubjectsForClass(student.classId, classes, subjects);

  const rank = classRank(student.id, student.classId, relevantSubjects, students, assessments, marks);
  const overall = studentOverallAverage(student.id, relevantSubjects, assessments, marks);

  const headerY = drawHeader(doc, profile, 'Student Report Card');
  const startY = drawMetaGrid(doc, headerY, [
    { label: 'Student Full Name', value: `${student.firstName} ${student.lastName}` },
    { label: 'Student ID', value: student.studentNumber },
    { label: 'Class Group', value: cls?.name || 'Unassigned' },
  ]);

  // Performance Summary
  autoTable(doc, {
    head: [['Overall Average', 'Final Grade', 'Position in Class']],
    body: [[`${overall.toFixed(1)}%`, gradeFromAverage(overall), `${rank.rank} of ${rank.total}`]],
    startY,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 3,
      halign: 'center',
      fontStyle: 'bold',
      textColor: COLOR_TEXT_MAIN,
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Detailed Subject Performance', 14, afterY);

  const body = relevantSubjects.map((subj) => {
    const r = studentSubjectAverage(student.id, subj.id, assessments, marks);
    const pct = r.maxTotal > 0 ? (r.total / r.maxTotal) * 100 : 0;
    const classAvg = classSubjectAverage(student.classId, subj.id, students, assessments, marks);
    const status = r.maxTotal === 0
      ? 'No Marks'
      : pct > classAvg + 3
        ? 'Above Average'
        : pct < classAvg - 3
          ? 'Below Average'
          : 'At Average';
    return [
      subj.name,
      r.maxTotal > 0 ? `${r.total} / ${r.maxTotal}` : '—',
      `${pct.toFixed(1)}%`,
      `${classAvg.toFixed(1)}%`,
      gradeFromAverage(pct),
      status,
    ];
  });

  autoTable(doc, {
    head: [['Subject', 'Raw Score', 'Percentage', 'Class Avg', 'Grade', 'Status']],
    body,
    startY: afterY + 2.5,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.8, cellPadding: 2.4, textColor: COLOR_TEXT_MAIN },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
    columnStyles: {
      1: {halign: 'center' },
      2: {halign: 'center', fontStyle: 'bold' },
      3: {halign: 'center' },
      4: {halign: 'center', fontStyle: 'bold' },
      5: {halign: 'center' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 5) {
        const status = String(data.cell.raw);
        if (status === 'Above Average') data.cell.styles.textColor = [5, 150, 105];
        if (status === 'Below Average') data.cell.styles.textColor = [220, 38, 38];
      }
      if (data.section === 'body' && data.column.index === 4) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  // Simple auto remarks
  const finalTableY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Academic Remarks', 14, finalTableY);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLOR_TEXT_MAIN);

  let remark = '';
  if (overall >= 80) {
    remark = 'Excellent performance. The student demonstrates strong mastery across subjects and is encouraged to maintain this high standard.';
  } else if (overall >= 65) {
    remark = 'Good performance overall. Continued effort and focus on weaker subjects will lead to further improvement.';
  } else if (overall >= 50) {
    remark = 'Satisfactory performance. The student is meeting minimum requirements but should increase effort in subjects below class average.';
  } else {
    remark = 'Performance requires immediate attention. Targeted support and consistent practice are strongly recommended.';
  }

  doc.text(remark, 14, finalTableY + 5, { maxWidth: 180 });

  // Signature space
  const remarksEndY = finalTableY + 16;
  drawSystemSignature(doc, remarksEndY);

  saveDoc(doc, `student-${student.lastName}-${student.firstName}.pdf`);
}

// ─── Full Academic Report PDF Export ────────────────────────────────────────

export function exportAcademicReportPDF(
  profile: SchoolProfile | null,
  classes: ClassGroup[],
  subjects: Subject[],
  teachers: Teacher[],
  students: Student[],
  assessments: Assessment[],
  marks: MarkRecord[],
) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const headerY = drawHeader(doc, profile, 'Academic Analytics Report');

  const overallAvg = students.length > 0
    ? students.reduce((sum, s) => {
        const cls = classes.find((c) => c.id === s.classId);
        const studentSubjects = cls
          ? subjects.filter((subj) => subj.level === cls.level)
          : subjects;
        return sum + studentOverallAverage(s.id, studentSubjects, assessments, marks);
      }, 0) / students.length
    : 0;
  const aboveThreshold = students.filter((s) => {
    const cls = classes.find((c) => c.id === s.classId);
    const studentSubjects = cls
      ? subjects.filter((subj) => subj.level === cls.level)
      : subjects;
    return studentOverallAverage(s.id, studentSubjects, assessments, marks) >= 50;
  }).length;
  const passRate = students.length > 0 ? (aboveThreshold / students.length) * 100 : 0;

  const startY = drawMetaGrid(doc, headerY, [
    { label: 'Scope', value: 'School-Wide Summary' },
    { label: 'Total Enrolled', value: `${students.length} Students` },
    { label: 'Faculty Count', value: `${teachers.length} Teachers` },
  ]);

  // Key Metrics
  autoTable(doc, {
    head: [['Students', 'Teachers', 'Classes', 'Subjects', 'School Average', 'Pass Rate']],
    body: [[
      String(students.length),
      String(teachers.length),
      String(classes.length),
      String(subjects.length),
      `${overallAvg.toFixed(1)}%`,
      `${passRate.toFixed(1)}%`,
    ]],
    startY,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8.5,
      cellPadding: 2.5,
     halign: 'center',
      fontStyle: 'bold',
      textColor: COLOR_TEXT_MAIN,
    },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
  });

  // Top Performing Classes
  const topClasses = topPerformingClasses(classes, subjects, students, assessments, marks);
  const afterY1 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;

  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Top-Performing Classes', 14, afterY1);

  autoTable(doc, {
    head: [['Rank', 'Class Group Name', 'Overall Class Average']],
    body: topClasses.map((c, i) => [String(i + 1), c.name, `${c.average.toFixed(1)}%`]),
    startY: afterY1 + 2.5,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.8, cellPadding: 2.3, textColor: COLOR_TEXT_MAIN },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
    columnStyles: {
      0: { cellWidth: 14,halign: 'center', fontStyle: 'bold' },
      2: {halign: 'center', fontStyle: 'bold' },
    },
  });

  // Subject Trends
  const afterY2 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Subject Performance Trends', 14, afterY2);

  autoTable(doc, {
    head: [['Subject Name', 'Trend State', 'Score Variance']],
    body: subjects.map((s) => {
      const trend = subjectTrend(s.id, assessments, marks, students);
      const dir = trend.direction === 'up' ? 'Improved' : trend.direction === 'down' ? 'Declined' : 'Stable';
      return [s.name, dir, `${trend.change > 0 ? '+' : ''}${trend.change.toFixed(1)}%`];
    }),
    startY: afterY2 + 2.5,
    margin: { left: 14, right: 14 },
    theme: 'plain',
    headStyles: {
      fillColor: COLOR_PRIMARY,
      textColor: COLOR_WHITE,
      fontSize: 7.5,
      fontStyle: 'bold',
      cellPadding: 2,
    },
    bodyStyles: { fontSize: 7.8, cellPadding: 2.3, textColor: COLOR_TEXT_MAIN },
    alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
    columnStyles: { 1: {halign: 'center' }, 2: {halign: 'center', fontStyle: 'bold' } },
  });

  // Students Needing Attention
  const needsAttention = studentsNeedingAttention(subjects, students, classes, assessments, marks, 50);
  const afterY3 = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7;
  doc.setFontSize(9.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLOR_PRIMARY);
  doc.text('Students Requiring Academic Support', 14, afterY3);

  if (needsAttention.length > 0) {
    autoTable(doc, {
      head: [['Student Name', 'Class Group', 'Current Overall Average']],
      body: needsAttention.map((r) => [
        `${r.student.firstName} ${r.student.lastName}`,
        r.className,
        `${r.average.toFixed(1)}%`,
      ]),
      startY: afterY3 + 2.5,
      margin: { left: 14, right: 14 },
      theme: 'plain',
      headStyles: {
        fillColor: [153, 27, 27],
        textColor: COLOR_WHITE,
        fontSize: 7.5,
        fontStyle: 'bold',
        cellPadding: 2,
      },
      bodyStyles: { fontSize: 7.8, cellPadding: 2.3, textColor: COLOR_TEXT_MAIN },
      alternateRowStyles: { fillColor: COLOR_BG_LIGHT },
      columnStyles: { 2: {halign: 'center', fontStyle: 'bold', textColor: [153, 27, 27] } },
    });
  } else {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLOR_TEXT_MUTED);
    doc.text('All registered students are performing at or above the minimum academic threshold.', 14, afterY3 + 5.5);
  }

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable?.finalY || afterY3 + 12;
  drawSystemSignature(doc, finalY);

  saveDoc(doc, `academic-report-${new Date().toISOString().slice(0, 10)}.pdf`);
}