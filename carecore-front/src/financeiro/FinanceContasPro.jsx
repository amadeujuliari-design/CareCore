import FinanceProShell from './FinanceProShell';
import { Accounts } from './pro/pages/Accounts';

export default function FinanceContasPro() {
  return (
    <FinanceProShell>
      <Accounts />
    </FinanceProShell>
  );
}
