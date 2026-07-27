import { randomUUID } from 'node:crypto';

export type NoteProposal = {
  approvedAt?: string;
  content: string;
  createdAt: string;
  expiresAt: string;
  id: string;
  requestedBy: string;
  status: 'pending' | 'approved' | 'applied' | 'expired';
  title: string;
};

export class ApprovalError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = 'ApprovalError';
  }
}

export class InMemoryApprovalStore {
  readonly #proposals = new Map<string, NoteProposal>();

  public constructor(private readonly ttlMs: number) {}

  public propose(
    title: string,
    content: string,
    requestedBy: string,
    now = Date.now()
  ): NoteProposal {
    const proposal: NoteProposal = {
      content,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      id: randomUUID(),
      requestedBy,
      status: 'pending',
      title
    };
    this.#proposals.set(proposal.id, proposal);
    return structuredClone(proposal);
  }

  public approve(id: string, now = Date.now()): NoteProposal {
    const proposal = this.requireCurrent(id, now);
    if (proposal.status !== 'pending') {
      throw new ApprovalError(`Proposal cannot be approved from status: ${proposal.status}`);
    }
    proposal.status = 'approved';
    proposal.approvedAt = new Date(now).toISOString();
    return structuredClone(proposal);
  }

  public consumeApproved(id: string, now = Date.now()): NoteProposal {
    const proposal = this.requireCurrent(id, now);
    if (proposal.status !== 'approved') {
      throw new ApprovalError('Proposal requires independent human approval');
    }
    proposal.status = 'applied';
    return structuredClone(proposal);
  }

  public get(id: string, now = Date.now()): NoteProposal | undefined {
    const proposal = this.#proposals.get(id);
    if (!proposal) {
      return undefined;
    }
    this.expireIfNeeded(proposal, now);
    return structuredClone(proposal);
  }

  private requireCurrent(id: string, now: number): NoteProposal {
    const proposal = this.#proposals.get(id);
    if (!proposal) {
      throw new ApprovalError('Proposal not found');
    }
    this.expireIfNeeded(proposal, now);
    if (proposal.status === 'expired') {
      throw new ApprovalError('Proposal expired');
    }
    return proposal;
  }

  private expireIfNeeded(proposal: NoteProposal, now: number): void {
    if (
      proposal.status !== 'applied' &&
      proposal.status !== 'expired' &&
      Date.parse(proposal.expiresAt) <= now
    ) {
      proposal.status = 'expired';
    }
  }
}
