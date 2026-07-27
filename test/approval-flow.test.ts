import { describe, expect, it } from 'vitest';

import { ApprovalError, InMemoryApprovalStore } from '../src/stores/approval-store.js';
import { InMemoryNoteStore } from '../src/stores/note-store.js';

describe('independent approval flow', () => {
  it('requires approval before consuming a proposal', () => {
    const approvals = new InMemoryApprovalStore(60_000);
    const proposal = approvals.propose('Title', 'Content', 'reader', 1_000);

    expect(() => approvals.consumeApproved(proposal.id, 2_000)).toThrow(ApprovalError);

    const approved = approvals.approve(proposal.id, 2_000);
    expect(approved.status).toBe('approved');

    const consumed = approvals.consumeApproved(proposal.id, 3_000);
    expect(consumed.status).toBe('applied');
    expect(() => approvals.consumeApproved(proposal.id, 4_000)).toThrow(ApprovalError);
  });

  it('expires stale proposals', () => {
    const approvals = new InMemoryApprovalStore(30_000);
    const proposal = approvals.propose('Title', 'Content', 'reader', 1_000);

    expect(approvals.get(proposal.id, 31_001)?.status).toBe('expired');
    expect(() => approvals.approve(proposal.id, 31_001)).toThrow('Proposal expired');
    expect(approvals.get('missing')).toBeUndefined();
  });

  it('prevents repeated approval', () => {
    const approvals = new InMemoryApprovalStore(60_000);
    const proposal = approvals.propose('Title', 'Content', 'reader', 1_000);
    approvals.approve(proposal.id, 2_000);

    expect(() => approvals.approve(proposal.id, 3_000)).toThrow('cannot be approved from status');
  });

  it('creates immutable copies of notes', () => {
    const notes = new InMemoryNoteStore();
    const created = notes.create('Title', 'Content');
    created.title = 'Changed outside the store';

    expect(notes.list()[0]?.title).toBe('Title');
  });
});
