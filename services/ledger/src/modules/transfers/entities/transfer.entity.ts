/**
 * Transfer Entity
 *
 * Represents a transfer intent record
 */
export class TransferEntity {
  id: string;
  type: string;
  asset: string;
  amount: number;
  chain: string;
  senderId: string;
  destinationUserId?: string;
  destinationAddress?: string;
  destinationChain: string;
  status: string;
  failureReason?: string;
  idempotencyKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Journal Entity
 *
 * Represents why money moved
 */
export class JournalEntity {
  id: string;
  type: string;
  asset: string;
  chain: string;
  userId: string;
  transferId: string;
  idempotencyKey?: string;
  createdAt: Date;
}

/**
 * Entry Entity
 *
 * Represents how money moved (debits & credits)
 */
export class EntryEntity {
  id: string;
  journalId: string;
  accountId: string;
  amount: number;
  createdAt: Date;
}

/**
 * Account Entity
 *
 * Represents a balance bucket
 */
export class AccountEntity {
  id: string;
  ownerType: string;
  ownerId?: string;
  purpose: string;
  asset: string;
  chain: string;
  createdAt: Date;
  updatedAt: Date;
}

