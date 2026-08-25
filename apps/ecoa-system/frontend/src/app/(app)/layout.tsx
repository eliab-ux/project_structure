import { DashboardShell } from 'src/components/DashboardShell/DashboardShell';

export default function AppGroupLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
