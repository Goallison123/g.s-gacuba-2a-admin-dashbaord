import type { Student } from '@/types';

export interface ImportResult {
  total: number;
  valid: number;
  duplicates: number;
  missingIds: number;
  students: Student[];
  errors: { row: number; reason: string; data: string }[];
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        current.push(field.trim());
        field = '';
      } else if (ch === '\n' || ch === '\r') {
        if (field || current.length > 0) {
          current.push(field.trim());
          rows.push(current);
          current = [];
          field = '';
        }
        if (ch === '\r' && text[i + 1] === '\n') i++;
      } else {
        field += ch;
      }
    }
  }
  if (field || current.length > 0) {
    current.push(field.trim());
    rows.push(current);
  }
  return rows.filter((r) => r.some((c) => c !== ''));
}

/**
 * Normalize a name: lowercase, trim, collapse spaces, remove dots/commas.
 * "John  Doe" and "doe, john" both become "john doe".
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Given a full-name string from a CSV (could be "John Doe", "Doe, John",
 * "Doe John", or even "john   doe"), try to match it against a list of
 * students. Returns the matched student, or null if no unique match.
 *
 * Matching strategy:
 * 1. Normalize the input and each student's "firstName lastName" and "lastName, firstName".
 * 2. Also try splitting the input into tokens and matching as a set —
 *    so "Doe John" matches "John Doe" (order-independent).
 */
export function findStudentByName(
  rawName: string,
  students: Student[],
): Student | null {
  const normalized = normalizeName(rawName);
  if (!normalized) return null;

  // Direct normalized match against "firstName lastName"
  let match: Student | null = null;
  let matchCount = 0;

  for (const s of students) {
    const fullNormal = normalizeName(`${s.firstName} ${s.lastName}`);
    const reversedNormal = normalizeName(`${s.lastName} ${s.firstName}`);
    if (normalized === fullNormal || normalized === reversedNormal) {
      match = s;
      matchCount++;
    }
  }

  if (matchCount === 1) return match;

  // Token-set matching: split into sorted token sets and compare
  const inputTokens = normalized.split(' ').sort().join(' ');
  match = null;
  matchCount = 0;

  for (const s of students) {
    const studentTokens = normalizeName(`${s.firstName} ${s.lastName}`)
      .split(' ')
      .sort()
      .join(' ');
    if (inputTokens === studentTokens) {
      match = s;
      matchCount++;
    }
  }

  return matchCount === 1 ? match : null;
}

/**
 * Try to match a row's student identifier (could be student_id OR a name)
 * against existing students. Returns the matched student or null.
 */
export function matchStudent(
  identifier: string,
  students: Student[],
): Student | null {
  if (!identifier.trim()) return null;

  // First try exact studentNumber match
  const byId = students.find(
    (s) => s.studentNumber.toLowerCase() === identifier.trim().toLowerCase(),
  );
  if (byId) return byId;

  // Then try name matching
  return findStudentByName(identifier, students);
}

export function validateStudents(
  rows: string[][],
  existingStudents: Student[],
  classIdMap: Record<string, string>,
): ImportResult {
  if (rows.length < 2) {
    return { total: 0, valid: 0, duplicates: 0, missingIds: 0, students: [], errors: [] };
  }

  const header = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, '_'));
  const idxStudentId = header.findIndex((h) => h.includes('student_id') || h === 'id');
  const idxFirst = header.findIndex((h) => h.includes('first') && h.includes('name'));
  const idxLast = header.findIndex((h) => h.includes('last') && h.includes('name'));
  const idxClass = header.findIndex((h) => h === 'class' || h.includes('class_name'));
  const idxGender = header.findIndex((h) => h.includes('gender'));

  // Also support a single "name" or "full_name" column
  const idxFullName = header.findIndex((h) => h === 'name' || h.includes('full_name'));
  const idxStudentName = header.findIndex((h) => h === 'student_name' || h === 'student');

  const dataRows = rows.slice(1);
  const students: Student[] = [];
  const errors: ImportResult['errors'] = [];
  let duplicates = 0;
  let missingIds = 0;
  const seenIds = new Set<string>();
  const existingIds = new Set(existingStudents.map((s) => s.studentNumber));
  const existingNames = new Set(existingStudents.map((s) => normalizeName(`${s.firstName} ${s.lastName}`)));

  let autoIdCounter = 1;

  dataRows.forEach((row, i) => {
    const rowNum = i + 2;
    let studentId = idxStudentId >= 0 ? row[idxStudentId] : '';
    let firstName = idxFirst >= 0 ? row[idxFirst] : '';
    let lastName = idxLast >= 0 ? row[idxLast] : '';
    const className = idxClass >= 0 ? row[idxClass] : '';
    const gender = idxGender >= 0 ? row[idxGender] : '';

    // If no separate first/last columns, try full name column
    if (!firstName && !lastName) {
      const fullName = (idxFullName >= 0 ? row[idxFullName] : '') || (idxStudentName >= 0 ? row[idxStudentName] : '');
      if (fullName) {
        const parts = fullName.trim().split(/\s+/);
        if (parts.length >= 2) {
          firstName = parts[0];
          lastName = parts.slice(1).join(' ');
        } else {
          firstName = parts[0] || '';
          lastName = '';
        }
      }
    }

    // Auto-generate student ID if missing
    if (!studentId) {
      studentId = `AUTO-${String(autoIdCounter++).padStart(4, '0')}`;
    }

    // Check for duplicate ID
    if (seenIds.has(studentId) || existingIds.has(studentId)) {
      duplicates++;
      errors.push({ row: rowNum, reason: 'Duplicate student ID', data: studentId });
      return;
    }

    if (!firstName || !lastName) {
      errors.push({ row: rowNum, reason: 'Missing name', data: studentId });
      return;
    }

    // Check for duplicate name
    const normalizedName = normalizeName(`${firstName} ${lastName}`);
    if (existingNames.has(normalizedName)) {
      duplicates++;
      errors.push({ row: rowNum, reason: 'Duplicate student name', data: `${firstName} ${lastName}` });
      return;
    }

    const classId = classIdMap[className] || '';
    if (!classId) {
      errors.push({ row: rowNum, reason: 'Class not found', data: className });
      return;
    }
    seenIds.add(studentId);
    existingNames.add(normalizedName);
    students.push({
      id: `stu_${studentId}`,
      studentNumber: studentId,
      firstName,
      lastName,
      classId,
      gender: gender === 'M' ? 'M' : gender === 'F' ? 'F' : undefined,
    });
  });

  return {
    total: dataRows.length,
    valid: students.length,
    duplicates,
    missingIds,
    students,
    errors,
  };
}
