import React from 'react';
import { PettyCashAndReportsPanel } from '../components/PettyCashAndReportsPanel';
import { useWorkspace } from '../context/WorkspaceContext';

export function CajasPage(): React.ReactElement {
  const {
    token,
    activeRole,
    projects,
    pettyCashes,
    refreshData,
    notify,
  } = useWorkspace();

  return (
    <PettyCashAndReportsPanel
      token={token}
      activeRole={activeRole}
      projects={projects}
      pettyCashes={pettyCashes}
      onRefresh={refreshData}
      onNotify={notify}
    />
  );
}
