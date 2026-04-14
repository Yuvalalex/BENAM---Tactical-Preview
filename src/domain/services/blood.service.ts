/**
 * Blood Type Compatibility Service.
 *
 * Provides donor/recipient matching logic for field blood transfusions.
 * Extracted from legacy blood screen functions in app.js.
 */

import { type Casualty, type ForceMember, BloodType } from '../../core/types';
import { ALL_BLOOD_TYPES, BLOOD_COMPATIBILITY } from '../../core/constants';

export interface BloodMatch {
  readonly donor: { name: string; bloodType: BloodType };
  readonly recipient: { name: string; bloodType: BloodType };
  readonly compatible: boolean;
}

export class BloodService {
  /**
   * Check if a donor blood type is compatible with a recipient.
   */
  isCompatible(donorType: BloodType, recipientType: BloodType): boolean {
    const recipients = BLOOD_COMPATIBILITY[donorType];
    return recipients ? recipients.includes(recipientType) : false;
  }

  /**
   * Find all compatible donors from force members for a given recipient.
   */
  findDonors(
    recipientBloodType: BloodType,
    forceMembers: readonly ForceMember[],
  ): ForceMember[] {
    return forceMembers.filter((member) => {
      const memberType = member.blood as BloodType;
      return this.isCompatible(memberType, recipientBloodType);
    });
  }

  /**
   * Find all compatible recipients for a given donor blood type.
   */
  findRecipients(
    donorBloodType: BloodType,
    casualties: readonly Casualty[],
  ): Casualty[] {
    const compatibleTypes = BLOOD_COMPATIBILITY[donorBloodType];
    if (!compatibleTypes) return [];

    return casualties.filter((cas) =>
      compatibleTypes.includes(cas.blood as BloodType),
    );
  }

  /**
   * Generate a full compatibility matrix (all donors × all recipients).
   */
  buildCompatibilityMatrix(
    donors: readonly ForceMember[],
    recipients: readonly Casualty[],
  ): BloodMatch[] {
    const matches: BloodMatch[] = [];

    for (const donor of donors) {
      for (const recipient of recipients) {
        matches.push({
          donor: { name: donor.name, bloodType: donor.blood as BloodType },
          recipient: { name: recipient.name, bloodType: recipient.blood as BloodType },
          compatible: this.isCompatible(
            donor.blood as BloodType,
            recipient.blood as BloodType,
          ),
        });
      }
    }

    return matches;
  }

  /**
   * Get all blood types in standard order.
   */
  getAllBloodTypes(): readonly BloodType[] {
    return ALL_BLOOD_TYPES;
  }

  /**
   * Get universal donor type.
   */
  getUniversalDonor(): BloodType {
    return BloodType.O_NEG;
  }

  /**
   * Get universal recipient type.
   */
  getUniversalRecipient(): BloodType {
    return BloodType.AB_POS;
  }
}
