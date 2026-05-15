// ─── Coupon Service ───────────────────────────────────────────
// Validates coupons and calculates discounted prices.

import { couponRepository } from '../repositories/coupon.repository.js';
import { subscriptionRepository } from '../repositories/subscription.repository.js';
import type { CouponValidationResult, BillingCycle } from '@kd/shared';

class CouponService {
  // ─── Validate a coupon code for a given plan/cycle/price ─
  async validate(
    code: string,
    userId: string,
    planId: string,
    billingCycle: BillingCycle,
    pricePaise: number,
  ): Promise<CouponValidationResult> {
    const coupon = await couponRepository.findByCode(code);

    if (!coupon) {
      return this.invalid('Coupon not found or inactive');
    }

    const now = new Date();

    // Time validity
    if (new Date(coupon.validFrom) > now) {
      return this.invalid('Coupon is not yet active');
    }
    if (coupon.validUntil && new Date(coupon.validUntil) < now) {
      return this.invalid('Coupon has expired');
    }

    // Usage limits
    if (coupon.maxUses !== null && coupon.currentUses >= coupon.maxUses) {
      return this.invalid('Coupon usage limit reached');
    }

    // Per-user limit + first-time check — run in parallel (FIX P16)
    const [userRedemptions, hasPrior] = await Promise.all([
      couponRepository.countRedemptionsByUser(coupon.id, userId),
      coupon.firstTimeOnly
        ? subscriptionRepository.hasAnyPriorSubscription(userId)
        : Promise.resolve(false),
    ]);

    if (userRedemptions >= coupon.maxUsesPerUser) {
      return this.invalid('You have already used this coupon');
    }

    // Plan restriction
    if (coupon.applicablePlans.length > 0 && !coupon.applicablePlans.includes(planId)) {
      return this.invalid('Coupon is not valid for this plan');
    }

    // Billing cycle restriction
    if (coupon.applicableCycles.length > 0 && !coupon.applicableCycles.includes(billingCycle)) {
      return this.invalid(`Coupon is only valid for ${coupon.applicableCycles.join('/')} billing`);
    }

    // Minimum order
    if (pricePaise < coupon.minOrderPaise) {
      const minAmount = (coupon.minOrderPaise / 100).toFixed(0);
      return this.invalid(`Minimum order of ₹${minAmount} required for this coupon`);
    }

    // First-time user restriction
    if (coupon.firstTimeOnly && hasPrior) {
      return this.invalid('Coupon is only valid for new subscribers');
    }

    // Calculate discount
    let discountPaise: number;
    if (coupon.discountType === 'percentage') {
      discountPaise = Math.floor(pricePaise * coupon.discountValue / 100);
      if (coupon.maxDiscountPaise !== null) {
        discountPaise = Math.min(discountPaise, coupon.maxDiscountPaise);
      }
    } else {
      discountPaise = Math.min(coupon.discountValue, pricePaise);
    }

    const finalPricePaise = Math.max(0, pricePaise - discountPaise);

    return {
      valid: true,
      discountPaise,
      finalPricePaise,
      couponId: coupon.id,
    };
  }

  private invalid(reason: string): CouponValidationResult {
    return { valid: false, discountPaise: 0, finalPricePaise: 0, couponId: '', failureReason: reason };
  }
}

export const couponService = new CouponService();
