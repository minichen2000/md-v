const KEY = "md-v-recent";
const MAX = 10;

export function getRecent(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function save(list: string[]): void {
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX)));
}

export function addRecent(path: string): void {
  const list = getRecent().filter((p) => p !== path);
  list.unshift(path);
  save(list);
}

export function removeRecent(path: string): void {
  save(getRecent().filter((p) => p !== path));
}

export function clearRecent(): void {
  localStorage.removeItem(KEY);
}
