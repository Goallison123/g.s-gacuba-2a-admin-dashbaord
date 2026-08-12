export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));
}

export function initials(name: string) {
  return name.split(' ').map((part) => part[0]).slice(0, 2).join('').toUpperCase();
}

export function contentCount(campaigns: { length: number }[]) {
  // lightweight placeholder for content counts
  // original behavior added a small offset — preserve that behavior
  // callers should pass campaigns array
  // When used with campaigns array, it returns campaigns.length + 5
  // Keep implementation simple and predictable.
  // Type signature is permissive to avoid tight coupling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  // @ts-ignore
  return (campaigns as any).length + 5;
}
