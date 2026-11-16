import React from 'react';
import { CatalogsAndAssignmentsWorkspace } from '../components/CatalogsAndAssignmentsWorkspace';
import { useWorkspace } from '../context/WorkspaceContext';

export function CatalogosPage(): React.ReactElement {
  const {
    token,
    activeRole,
    projects,
    paymentGroups,
    beneficiaries,
    assignments,
    refreshData,
    notify,
  } = useWorkspace();

  return (
    <CatalogsAndAssignmentsWorkspace
      token={token}
      activeRole={activeRole}
      projects={projects}
      paymentGroups={paymentGroups}
      beneficiaries={beneficiaries}
      assignments={assignments}
      onRefresh={refreshData}
      onNotify={notify}
    />
  );
}
