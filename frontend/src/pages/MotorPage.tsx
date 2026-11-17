import React from 'react';
import { FinancialEnginePanel } from '../components/FinancialEnginePanel';
import { useWorkspace } from '../context/WorkspaceContext';

export function MotorPage(): React.ReactElement {
  const {
    token,
    activeRole,
    projects,
    paymentGroups,
    beneficiaries,
    assignments,
    accruals,
    accrualBatches,
    paymentRequests,
    payments,
    refreshData,
    notify,
  } = useWorkspace();

  return (
    <FinancialEnginePanel
      token={token}
      activeRole={activeRole}
      projects={projects}
      paymentGroups={paymentGroups}
      beneficiaries={beneficiaries}
      assignments={assignments}
      accruals={accruals}
      accrualBatches={accrualBatches}
      paymentRequests={paymentRequests}
      payments={payments}
      onRefresh={refreshData}
      onNotify={notify}
    />
  );
}
