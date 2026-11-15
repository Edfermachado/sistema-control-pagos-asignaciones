#!/usr/bin/env node
/**
 * Prueba de humo end-to-end contra el backend desplegado en Docker.
 *
 * Uso:
 *   node scripts/api-smoke-test.mjs
 *   API_URL=http://localhost:3000/api node scripts/api-smoke-test.mjs
 *
 * El script crea datos con un sufijo único (proyecto, grupo, beneficiario,
 * asignación, causación, solicitud, pago y caja chica) para no colisionar con
 * los datos de demostración. No borra registros: el sistema es inmutable.
 */

const API_URL = process.env.API_URL ?? 'http://localhost:3000/api';
const PASSWORD = 'PasswordUC2026!';
const stamp = Date.now().toString(36).toUpperCase();

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  OK   ${name}`);
    return;
  }
  failed += 1;
  failures.push(`${name}${detail ? ` -> ${detail}` : ''}`);
  console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();
  let payload = null;
  if (text.length > 0) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  return { status: response.status, ok: response.ok, payload };
}

async function login(email) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: { email, password: PASSWORD },
  });
  check(`login ${email}`, res.ok && Boolean(res.payload?.accessToken), `HTTP ${res.status}`);
  return res.payload?.accessToken;
}

async function main() {
  console.log(`\nAPI: ${API_URL}\n`);

  // 1. Salud
  const health = await request('/health');
  check('health responde 200 y DB conectada', health.ok && health.payload?.databaseConnected === true, JSON.stringify(health.payload));

  // 2. Autenticación y RBAC básico
  const adminToken = await login('admin@uc.edu.ve');
  const generadorToken = await login('coordinador@uc.edu.ve');
  const receptorToken = await login('gerente@uc.edu.ve');

  const sinToken = await request('/projects');
  check('endpoint protegido rechaza sin JWT (401)', sinToken.status === 401, `HTTP ${sinToken.status}`);

  const adminMoney = await request('/accruals', { token: adminToken });
  check('ADMIN no puede operar dinero (403)', adminMoney.status === 403, `HTTP ${adminMoney.status}`);

  const generadorApprove = await request('/payment-requests/00000000-0000-4000-8000-000000000000/review', {
    method: 'PATCH',
    token: generadorToken,
    body: { decision: 'APROBADA' },
  });
  check('GENERADOR no puede aprobar solicitudes (403)', generadorApprove.status === 403, `HTTP ${generadorApprove.status}`);

  // 3. Catálogos
  const projectRes = await request('/projects', {
    method: 'POST',
    token: generadorToken,
    body: {
      code: `SMK-${stamp}`,
      name: `Proyecto Smoke ${stamp}`,
      area: 'FISICA',
      scope: 'INTERNO',
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    },
  });
  check('crear proyecto como GENERADOR', projectRes.status === 201, `HTTP ${projectRes.status} ${JSON.stringify(projectRes.payload)}`);
  const project = projectRes.payload;

  const groupRes = await request('/payment-groups', {
    method: 'POST',
    token: adminToken,
    body: {
      name: `Grupo Smoke ${stamp}`,
      periodicity: 'QUINCENAL',
      cutoffRules: 'Corte días 15 y último del mes',
    },
  });
  check('crear grupo de pago como ADMIN', groupRes.status === 201, `HTTP ${groupRes.status} ${JSON.stringify(groupRes.payload)}`);
  const group = groupRes.payload;

  const beneficiaryRes = await request('/beneficiaries', {
    method: 'POST',
    token: generadorToken,
    body: {
      dni: `SMK-${stamp}`,
      fullName: `Beneficiario Smoke ${stamp}`,
      email: `smoke.${stamp.toLowerCase()}@uc.edu.ve`,
      bankInfo: 'Zelle / Cuenta Smoke',
    },
  });
  check('crear beneficiario sin usuario', beneficiaryRes.status === 201, `HTTP ${beneficiaryRes.status} ${JSON.stringify(beneficiaryRes.payload)}`);
  const beneficiary = beneficiaryRes.payload;

  const assignmentRes = await request('/assignments', {
    method: 'POST',
    token: generadorToken,
    body: {
      beneficiaryId: beneficiary.id,
      projectId: project.id,
      paymentGroupId: group.id,
      amountPerPeriod: '450.00',
      startDate: '2026-11-01',
      endDate: '2026-12-31',
    },
  });
  check('crear asignación', assignmentRes.status === 201, `HTTP ${assignmentRes.status} ${JSON.stringify(assignmentRes.payload)}`);

  const overlapRes = await request('/assignments', {
    method: 'POST',
    token: generadorToken,
    body: {
      beneficiaryId: beneficiary.id,
      projectId: project.id,
      paymentGroupId: group.id,
      amountPerPeriod: '100.00',
      startDate: '2026-11-05',
      endDate: '2026-11-30',
    },
  });
  check('rechaza asignación solapada en el mismo proyecto (RN-CAT-04)', overlapRes.status === 409 || overlapRes.status === 400, `HTTP ${overlapRes.status}`);

  // 4. Motor de causación
  const batchBody = {
    code: `LOTE-SMK-${stamp}`,
    projectId: project.id,
    paymentGroupId: group.id,
    periodStart: '2026-11-01',
    periodEnd: '2026-11-15',
  };

  const previewRes = await request('/accruals/batches/preview', {
    method: 'POST',
    token: generadorToken,
    body: batchBody,
  });
  check('previsualizar prorrateo', previewRes.status === 201 && previewRes.payload?.items?.length === 1, `HTTP ${previewRes.status} ${JSON.stringify(previewRes.payload)}`);
  check('prorrateo 15/15 = 450.00', previewRes.payload?.items?.[0]?.proratedAmount === '450.00', String(previewRes.payload?.items?.[0]?.proratedAmount));

  const batchRes = await request('/accruals/batches', {
    method: 'POST',
    token: generadorToken,
    body: batchBody,
  });
  check('generar lote de causación', batchRes.status === 201, `HTTP ${batchRes.status} ${JSON.stringify(batchRes.payload)}`);
  const accrual = batchRes.payload?.accruals?.[0];
  check('causación nace PENDIENTE con saldo 450.00', accrual?.status === 'PENDIENTE' && accrual?.balanceDue === '450', `${accrual?.status} / ${accrual?.balanceDue}`);

  const duplicateBatch = await request('/accruals/batches', {
    method: 'POST',
    token: generadorToken,
    body: { ...batchBody, code: `${batchBody.code}-DUP` },
  });
  check('rechaza doble causación del mismo período (RN-CAUS-04)', duplicateBatch.status === 409, `HTTP ${duplicateBatch.status}`);

  // 5. Solicitud y pago FIFO
  const requestRes = await request('/payment-requests', {
    method: 'POST',
    token: generadorToken,
    body: {
      code: `SOL-SMK-${stamp}`,
      projectId: project.id,
      accrualIds: [accrual.id],
    },
  });
  check('crear solicitud de pago con causación', requestRes.status === 201 && requestRes.payload?.totalAmount === '450', `HTTP ${requestRes.status} ${JSON.stringify(requestRes.payload)}`);
  const paymentRequest = requestRes.payload;

  const sendRes = await request(`/payment-requests/${paymentRequest.id}/send`, {
    method: 'PATCH',
    token: generadorToken,
  });
  check('enviar solicitud CREADA -> ENVIADA', sendRes.status === 200 && sendRes.payload?.status === 'ENVIADA', `HTTP ${sendRes.status}`);

  const approveRes = await request(`/payment-requests/${paymentRequest.id}/review`, {
    method: 'PATCH',
    token: receptorToken,
    body: { decision: 'APROBADA' },
  });
  check('aprobar solicitud como RECEPTOR', approveRes.status === 200 && approveRes.payload?.status === 'APROBADA', `HTTP ${approveRes.status} ${JSON.stringify(approveRes.payload)}`);

  const partialPayRes = await request('/payments', {
    method: 'POST',
    token: receptorToken,
    body: {
      receiptCode: `REC-SMK-${stamp}-A`,
      paymentRequestId: paymentRequest.id,
      beneficiaryId: beneficiary.id,
      amount: '150.00',
      paymentDate: '2026-11-10',
      reference: 'SMOKE-TEST',
    },
  });
  check('registrar pago parcial FIFO', partialPayRes.status === 201 && partialPayRes.payload?.payment?.amount === '150', `HTTP ${partialPayRes.status} ${JSON.stringify(partialPayRes.payload)}`);

  const accrualsAfterPartial = await request('/accruals', { token: receptorToken });
  const partialAccrual = accrualsAfterPartial.payload?.find((a) => a.id === accrual.id);
  check('pago parcial deja saldo 300.00 y estado PARCIAL', partialAccrual?.balanceDue === '300' && partialAccrual?.status === 'PARCIAL', `${partialAccrual?.balanceDue} / ${partialAccrual?.status}`);

  const closeTooEarly = await request(`/payment-requests/${paymentRequest.id}/close`, {
    method: 'PATCH',
    token: receptorToken,
  });
  check('no cierra solicitud con deuda pendiente', closeTooEarly.status === 400, `HTTP ${closeTooEarly.status}`);

  const overpayRes = await request('/payments', {
    method: 'POST',
    token: receptorToken,
    body: {
      receiptCode: `REC-SMK-${stamp}-OVER`,
      paymentRequestId: paymentRequest.id,
      beneficiaryId: beneficiary.id,
      amount: '9999.00',
      paymentDate: '2026-11-10',
    },
  });
  check('rechaza sobrepago (RN-PAG-02)', overpayRes.status === 400, `HTTP ${overpayRes.status}`);

  // Anulación del pago parcial y reversión FIFO
  const annulRes = await request(`/annulments/payments/${partialPayRes.payload.payment.id}`, {
    method: 'POST',
    token: receptorToken,
    body: { reason: 'Prueba automatizada de reversión FIFO con motivo válido' },
  });
  check('anular pago con motivo (RECEPTOR)', annulRes.status === 201, `HTTP ${annulRes.status} ${JSON.stringify(annulRes.payload)}`);

  const accrualsAfterAnnul = await request('/accruals', { token: receptorToken });
  const restoredAccrual = accrualsAfterAnnul.payload?.find((a) => a.id === accrual.id);
  check('anulación revierte saldo a 450.00 y estado PENDIENTE', restoredAccrual?.balanceDue === '450' && restoredAccrual?.status === 'PENDIENTE', `${restoredAccrual?.balanceDue} / ${restoredAccrual?.status}`);

  const fullPayRes = await request('/payments', {
    method: 'POST',
    token: receptorToken,
    body: {
      receiptCode: `REC-SMK-${stamp}-B`,
      paymentRequestId: paymentRequest.id,
      beneficiaryId: beneficiary.id,
      amount: '450.00',
      paymentDate: '2026-11-10',
      reference: 'SMOKE-TEST-FULL',
    },
  });
  check('registrar pago total', fullPayRes.status === 201 && fullPayRes.payload?.payment?.amount === '450', `HTTP ${fullPayRes.status}`);

  const closeRes = await request(`/payment-requests/${paymentRequest.id}/close`, {
    method: 'PATCH',
    token: receptorToken,
  });
  check('cerrar solicitud pagada al 100%', closeRes.status === 200 && closeRes.payload?.status === 'CERRADA', `HTTP ${closeRes.status}`);

  // 6. PDFs
  const receiptPdf = await fetch(`${API_URL}/reports/payments/${fullPayRes.payload.payment.id}/pdf`, {
    headers: { Authorization: `Bearer ${receptorToken}` },
  });
  const receiptBytes = Buffer.from(await receiptPdf.arrayBuffer());
  check('PDF de recibo individual', receiptPdf.ok && receiptBytes.subarray(0, 4).toString() === '%PDF', `HTTP ${receiptPdf.status}`);

  const requestPdf = await fetch(`${API_URL}/reports/payment-requests/${paymentRequest.id}/pdf`, {
    headers: { Authorization: `Bearer ${receptorToken}` },
  });
  const requestBytes = Buffer.from(await requestPdf.arrayBuffer());
  check('PDF de solicitud consolidada', requestPdf.ok && requestBytes.subarray(0, 4).toString() === '%PDF', `HTTP ${requestPdf.status}`);

  // 7. Caja chica
  const pettyCashRes = await request('/petty-cashes', {
    method: 'POST',
    token: generadorToken,
    body: {
      code: `CC-SMK-${stamp}`,
      name: `Caja Chica Smoke ${stamp}`,
      projectId: project.id,
      authorizedAmount: '200.00',
    },
  });
  check('crear caja chica', pettyCashRes.status === 201, `HTTP ${pettyCashRes.status} ${JSON.stringify(pettyCashRes.payload)}`);
  const pettyCash = pettyCashRes.payload;

  const periodRes = await request(`/petty-cashes/${pettyCash.id}/periods`, {
    method: 'POST',
    token: generadorToken,
    body: { yearMonth: '2026-11', initialReplenishment: '200.00' },
  });
  check('solicitar apertura mensual', periodRes.status === 201 && periodRes.payload?.availableBalance === '200', `HTTP ${periodRes.status} ${JSON.stringify(periodRes.payload)}`);
  const period = periodRes.payload;

  const approvePeriod = await request(`/petty-cashes/periods/${period.id}/approve`, {
    method: 'PATCH',
    token: receptorToken,
  });
  check('aprobar apertura como RECEPTOR', approvePeriod.status === 200 && approvePeriod.payload?.status === 'ABIERTO', `HTTP ${approvePeriod.status}`);

  const voucherRes = await request(`/petty-cashes/periods/${period.id}/vouchers`, {
    method: 'POST',
    token: generadorToken,
    body: {
      code: `VALE-SMK-${stamp}`,
      beneficiaryName: 'Responsable Smoke',
      concept: 'Compra de materiales de laboratorio',
      requestedAmount: '50.00',
    },
  });
  check('solicitar vale de caja chica', voucherRes.status === 201, `HTTP ${voucherRes.status} ${JSON.stringify(voucherRes.payload)}`);
  const voucher = voucherRes.payload;

  const disburseRes = await request(`/petty-cashes/vouchers/${voucher.id}/disburse`, {
    method: 'PATCH',
    token: receptorToken,
  });
  check('desembolsar vale y descontar saldo', disburseRes.ok && Number(disburseRes.payload?.newAvailableBalance) === 150, `HTTP ${disburseRes.status} ${JSON.stringify(disburseRes.payload)}`);

  const settleRes = await request(`/petty-cashes/vouchers/${voucher.id}/settle`, {
    method: 'PATCH',
    token: generadorToken,
    body: { settledAmount: '40.00', invoiceReference: `FACT-SMK-${stamp}` },
  });
  check('rendir vale con factura y vuelto de 10.00', settleRes.ok && Number(settleRes.payload?.newAvailableBalance) === 160, `HTTP ${settleRes.status} ${JSON.stringify(settleRes.payload)}`);

  const closePeriod = await request(`/petty-cashes/periods/${period.id}/close`, {
    method: 'PATCH',
    token: receptorToken,
  });
  check('cerrar período con saldo congelado 160.00', closePeriod.ok && Number(closePeriod.payload?.closingBalance) === 160, `HTTP ${closePeriod.status} ${JSON.stringify(closePeriod.payload)}`);

  // 8. Administración y auditoría
  const userRes = await request('/users', {
    method: 'POST',
    token: adminToken,
    body: {
      email: `smoke.${stamp.toLowerCase()}@uc.edu.ve`,
      fullName: `Usuario Smoke ${stamp}`,
      password: 'PasswordSmoke2026!',
      role: 'RECEPTOR',
    },
  });
  check('ADMIN crea usuario', userRes.status === 201, `HTTP ${userRes.status} ${JSON.stringify(userRes.payload)}`);

  const auditRes = await request('/audit-logs', { token: adminToken });
  check('audit_log registra operaciones', auditRes.ok && Array.isArray(auditRes.payload) && auditRes.payload.length > 0, `HTTP ${auditRes.status}`);

  const summaryRes = await request('/reports/summary', { token: receptorToken });
  check('consulta clave de totales y deudas', summaryRes.ok && typeof summaryRes.payload?.totalAccruedUsd === 'string' && Array.isArray(summaryRes.payload?.beneficiaryBalances), `HTTP ${summaryRes.status}`);

  // Resumen
  console.log(`\nResultado: ${passed} OK / ${failed} FAIL`);
  if (failures.length > 0) {
    console.log('\nFallos:');
    for (const failure of failures) {
      console.log(` - ${failure}`);
    }
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('\nError fatal en la prueba de humo:', error);
  process.exitCode = 1;
});
