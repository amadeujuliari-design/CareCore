import Sidebar from '../Sidebar';
import { AppShell, MainShell, ScrollArea } from '../components/PremiumUI';

export default function FinanceProShell({ children }) {
  return (
    <AppShell>
      <Sidebar />
      <MainShell>
        <ScrollArea className="pb-24">
          <div className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-5 sm:py-6">
            {children}
          </div>
        </ScrollArea>
      </MainShell>
    </AppShell>
  );
}
