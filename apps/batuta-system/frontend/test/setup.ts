import '@testing-library/jest-dom';

/**
 * `matchMedia` does not exist in jsdom, and MUI calls it (`useMediaQuery`, the responsive Drawer).
 * Without this stub every screen that renders the shell throws before the first assertion.
 */
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  }),
});

// jsdom has no localStorage in some environments and no way to inspect it in others. A real in-memory
// implementation lets the session tests assert what was stored instead of mocking the module.
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  writable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => [...store.keys()][index] ?? null,
    get length() {
      return store.size;
    },
  },
});

beforeEach(() => {
  window.localStorage.clear();
});
