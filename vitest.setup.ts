function createInMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

const storage = createInMemoryStorage();
if (!window.localStorage) {
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
}
if (!globalThis.localStorage) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true });
}