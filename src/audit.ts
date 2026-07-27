export type AuditEvent = {
  action: string;
  actor: string;
  outcome: 'allowed' | 'denied' | 'failed';
  requestId?: string;
  target?: string;
};

export type AuditSink = (event: AuditEvent) => void;

export const stderrAuditSink: AuditSink = event => {
  const record = {
    action: event.action,
    actor: event.actor,
    outcome: event.outcome,
    ...(event.requestId ? { requestId: event.requestId } : {}),
    ...(event.target ? { target: event.target } : {}),
    timestamp: new Date().toISOString(),
    type: 'security.audit'
  };
  process.stderr.write(`${JSON.stringify(record)}\n`);
};
