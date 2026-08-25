import { AppShell } from 'src/components/AppShell/AppShell';

/**
 * Every authenticated screen renders inside the shell.
 *
 * A route group `(app)` rather than a path segment: the URLs stay `/dashboard`, `/inbox` and so on, which
 * is what the navigation and any bookmark expect, while the layout applies to all of them at once.
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
