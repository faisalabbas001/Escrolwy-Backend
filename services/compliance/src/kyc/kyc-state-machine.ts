import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { KycStatus } from './dto';

/**
 * KYC State Machine
 * 
 * Enforces strict KYC status transitions to prevent invalid states.
 * 
 * Valid Transitions:
 * NOT_STARTED → STARTED
 * STARTED → APPROVED | REJECTED | REVIEW_REQUIRED
 * REVIEW_REQUIRED → APPROVED | REJECTED
 * 
 * APPROVED and REJECTED are terminal states (except admin reset).
 */
@Injectable()
export class KycStateMachine {
    private readonly logger = new Logger(KycStateMachine.name);

    /**
     * Transition map: defines valid next states for each current state
     */
    private readonly validTransitions: Record<string, string[]> = {
        [KycStatus.NOT_STARTED]: [KycStatus.STARTED],
        [KycStatus.STARTED]: [
            KycStatus.APPROVED,
            KycStatus.REJECTED,
            KycStatus.REVIEW_REQUIRED,
        ],
        [KycStatus.REVIEW_REQUIRED]: [
            KycStatus.APPROVED,
            KycStatus.REJECTED,
        ],
        // Terminal states - no automatic transitions allowed
        [KycStatus.APPROVED]: [],
        [KycStatus.REJECTED]: [],
    };

    /**
     * Check if a transition is valid
     */
    canTransition(from: string, to: string): boolean {
        const allowedStates = this.validTransitions[from] || [];
        return allowedStates.includes(to);
    }

    /**
     * Validate and execute a transition
     * Throws BadRequestException if transition is invalid
     */
    validateTransition(from: string, to: string, userId: string): void {
        if (!this.canTransition(from, to)) {
            this.logger.warn(
                `❌ Invalid KYC transition for user ${userId}: ${from} → ${to}`,
            );
            throw new BadRequestException(
                `Invalid KYC state transition: ${from} → ${to}`,
            );
        }

        this.logger.debug(`✅ Valid KYC transition for user ${userId}: ${from} → ${to}`);
    }

    /**
     * Check if a state is terminal (no further automatic transitions)
     */
    isTerminalState(state: string): boolean {
        return state === KycStatus.APPROVED || state === KycStatus.REJECTED;
    }

    /**
     * Admin can force transitions (bypass state machine for reset)
     */
    canAdminTransition(from: string, to: string): boolean {
        // Admin can reset to NOT_STARTED from any state
        if (to === KycStatus.NOT_STARTED) {
            return true;
        }
        // Admin can approve/reject from REVIEW_REQUIRED
        if (from === KycStatus.REVIEW_REQUIRED) {
            return to === KycStatus.APPROVED || to === KycStatus.REJECTED;
        }
        return false;
    }
}
