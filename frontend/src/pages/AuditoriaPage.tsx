import React from 'react';
import { UsersAndAuditWorkspace } from '../components/UsersAndAuditWorkspace';
import { useWorkspace } from '../context/WorkspaceContext';

export function AuditoriaPage(): React.ReactElement {
  const {
    token,
    activeRole,
    users,
    parameters,
    auditLogs,
    refreshData,
    notify,
  } = useWorkspace();

  return (
    <UsersAndAuditWorkspace
      token={token}
      activeRole={activeRole}
      users={users}
      parameters={parameters}
      auditLogs={auditLogs}
      onRefresh={refreshData}
      onNotify={notify}
    />
  );
}
