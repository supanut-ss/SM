// กติกาการเลือกโปรโมชั่น (T5.3) — pure function เท่านั้น ห้ามเรียก Date.now()/import Prisma ใด ๆ
// ดู docs/DOMAIN.md ข้อ 15: "โปรโมชั่นซ้อนกันไม่ได้เลย" — ใช้ได้โปรฯ เดียวต่อบิล ระบบเลือกโปรที่ลดมากที่สุด
// อัตโนมัติ (ไม่มีฟิลด์ stackable ในระบบนี้เลย — ปิดการซ้อนถาวรตามที่ DOMAIN.md ระบุ) เทียบ priority
// เฉพาะตอนส่วนลดเท่ากันเป๊ะเท่านั้น ดู docs/decisions.md ADR-027

import type {
  CartLine,
  EvaluatePromotionsInput,
  EvaluatePromotionsResult,
  PromotionApplication,
  PromotionRule,
  RejectedPromotion,
} from "./types.js";

export type {
  CartLine,
  EvaluatePromotionsInput,
  EvaluatePromotionsResult,
  LinePaymentMethod,
  PromotionApplication,
  PromotionConditions,
  PromotionRule,
  PromotionType,
  RejectedPromotion,
} from "./types.js";

interface EvaluationOutcome {
  applicable: boolean;
  discountSatang: number;
  bonusMinutes: number;
  reason: string;
}

const REJECTED_QUOTA = "โควตาโปรโมชั่นนี้หมดแล้ว";
const REJECTED_NO_ELIGIBLE_LINES = "ไม่มีรายการที่เข้าเงื่อนไขของโปรฯ นี้ (ตัดคอร์สใช้โปรฯ ไม่ได้ ดู docs/DOMAIN.md)";
const REJECTED_ZERO_DISCOUNT = "โปรฯ นี้ให้ส่วนลด/ของแถม 0 กับรายการในบิลนี้";

/** ห้ามใช้โปรฯ กับรายการที่ตัดคอร์ส (payment method = PACKAGE) เสมอ — บังคับตรงนี้จุดเดียว */
function isPromotable(line: CartLine): boolean {
  return line.paymentMethod !== "PACKAGE";
}

function lineTotal(line: CartLine): number {
  return line.priceSatang * (line.quantity ?? 1);
}

function matchesConditions(rule: PromotionRule, input: EvaluatePromotionsInput): string | null {
  const c = rule.conditions;
  if (c.branchIds && !c.branchIds.includes(input.branchId)) {
    return "โปรฯ นี้ใช้ไม่ได้ในสาขานี้";
  }
  if (c.daysOfWeek && !c.daysOfWeek.includes(input.dayOfWeek)) {
    return "โปรฯ นี้ใช้ไม่ได้ในวันนี้";
  }
  if (c.startMinuteOfDay !== undefined && c.endMinuteOfDay !== undefined) {
    if (input.minuteOfDay < c.startMinuteOfDay || input.minuteOfDay > c.endMinuteOfDay) {
      return "โปรฯ นี้ใช้ได้เฉพาะช่วงเวลาที่กำหนด";
    }
  }
  if (c.firstTimeCustomerOnly && !input.isFirstTimeCustomer) {
    return "โปรฯ นี้ใช้ได้เฉพาะลูกค้าใหม่ครั้งแรกเท่านั้น";
  }
  if (c.birthdayMonthOnly && input.memberBirthMonth !== input.currentMonth) {
    return "โปรฯ นี้ใช้ได้เฉพาะเดือนเกิดของสมาชิกเท่านั้น";
  }
  if (c.memberTiers && (!input.memberTier || !c.memberTiers.includes(input.memberTier))) {
    return "โปรฯ นี้ใช้ได้เฉพาะสมาชิกระดับที่กำหนดเท่านั้น";
  }
  const fullCartTotal = input.cart.reduce((sum, l) => sum + lineTotal(l), 0);
  if (c.minSpendSatang !== undefined && fullCartTotal < c.minSpendSatang) {
    return "ยอดบิลยังไม่ถึงขั้นต่ำของโปรฯ นี้";
  }
  return null;
}

function eligibleLines(rule: PromotionRule, cart: CartLine[]): CartLine[] {
  return cart.filter((line) => {
    if (!isPromotable(line)) return false;
    if (rule.conditions.serviceVariantIds && !rule.conditions.serviceVariantIds.includes(line.serviceVariantId)) {
      return false;
    }
    return true;
  });
}

function evaluatePercentOff(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  const percent = rule.percentOff ?? 0;
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountSatang = Math.round((subtotal * percent) / 100);
  return {
    applicable: discountSatang > 0,
    discountSatang,
    bonusMinutes: 0,
    reason: `ลด ${percent}% จากยอดที่เข้าเงื่อนไข ${subtotal.toLocaleString("th-TH")} สตางค์`,
  };
}

function evaluateAmountOff(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  const amountOff = rule.amountOffSatang ?? 0;
  const subtotal = lines.reduce((sum, l) => sum + lineTotal(l), 0);
  const discountSatang = Math.min(amountOff, subtotal);
  return {
    applicable: discountSatang > 0,
    discountSatang,
    bonusMinutes: 0,
    reason: `ลด ${amountOff.toLocaleString("th-TH")} สตางค์ (ไม่เกินยอดที่เข้าเงื่อนไข)`,
  };
}

function evaluateFixedPrice(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  const totalQty = lines.reduce((sum, l) => sum + (l.quantity ?? 1), 0);
  if (lines.length !== 1 || totalQty !== 1) {
    return {
      applicable: false,
      discountSatang: 0,
      bonusMinutes: 0,
      reason: "ราคาพิเศษ (FIXED_PRICE) ใช้ได้กับบริการเดียวเท่านั้น ไม่ใช่หลายรายการรวมกัน",
    };
  }
  const fixedPrice = rule.fixedPriceSatang ?? 0;
  const discountSatang = Math.max(0, lines[0]!.priceSatang - fixedPrice);
  return {
    applicable: discountSatang > 0,
    discountSatang,
    bonusMinutes: 0,
    reason: `ราคาพิเศษ ${fixedPrice.toLocaleString("th-TH")} สตางค์`,
  };
}

function evaluateBuyXGetY(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  const buyQuantity = rule.buyQuantity ?? 0;
  const getQuantity = rule.getQuantity ?? 0;
  if (buyQuantity <= 0 || getQuantity <= 0) {
    return { applicable: false, discountSatang: 0, bonusMinutes: 0, reason: "โปรฯ นี้ตั้งค่าไม่ถูกต้อง" };
  }
  const unitPrices: number[] = [];
  for (const line of lines) {
    for (let i = 0; i < (line.quantity ?? 1); i++) unitPrices.push(line.priceSatang);
  }
  const totalQty = unitPrices.length;
  const freeCount = Math.min(Math.floor(totalQty / buyQuantity) * getQuantity, totalQty);
  if (freeCount <= 0) {
    return {
      applicable: false,
      discountSatang: 0,
      bonusMinutes: 0,
      reason: `ต้องซื้อครบ ${buyQuantity} ชิ้นก่อนถึงจะแถม ${getQuantity} ชิ้น (ตอนนี้มี ${totalQty} ชิ้นที่เข้าเงื่อนไข)`,
    };
  }
  // แถมรายการที่ราคาถูกที่สุดก่อนเสมอ (ร้านเสียประโยชน์น้อยที่สุด) — เรียงจากถูกไปแพงแล้วหยิบ freeCount ตัวแรก
  const sorted = [...unitPrices].sort((a, b) => a - b);
  const discountSatang = sorted.slice(0, freeCount).reduce((sum, p) => sum + p, 0);
  return {
    applicable: discountSatang > 0,
    discountSatang,
    bonusMinutes: 0,
    reason: `ซื้อ ${buyQuantity} แถม ${getQuantity} — แถมฟรี ${freeCount} ชิ้น (เลือกรายการราคาถูกที่สุดให้ฟรี)`,
  };
}

function evaluateBonusMinutes(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  const bonusMinutes = rule.bonusMinutes ?? 0;
  return {
    applicable: lines.length > 0 && bonusMinutes > 0,
    discountSatang: 0,
    bonusMinutes,
    reason: `แถมเวลาบริการ ${bonusMinutes} นาที (ไม่ใช่ส่วนลดเป็นเงิน)`,
  };
}

function evaluateRule(rule: PromotionRule, lines: CartLine[]): EvaluationOutcome {
  switch (rule.type) {
    case "PERCENT_OFF":
      return evaluatePercentOff(rule, lines);
    case "AMOUNT_OFF":
      return evaluateAmountOff(rule, lines);
    case "FIXED_PRICE":
      return evaluateFixedPrice(rule, lines);
    case "BUY_X_GET_Y":
      return evaluateBuyXGetY(rule, lines);
    case "BONUS_MINUTES":
      return evaluateBonusMinutes(rule, lines);
  }
}

/**
 * เลือกโปรโมชั่นที่ดีที่สุด 1 ตัวสำหรับบิลนี้ (ดู docs/DOMAIN.md ข้อ 15 — ห้ามซ้อนโปรฯ เด็ดขาด) เลือกจาก
 * ส่วนลดเป็นเงินมากที่สุดก่อน (BONUS_MINUTES นับ discountSatang เป็น 0 เสมอจึงมักแพ้โปรฯ เงินสดถ้ามีตัวเลือก
 * อื่น) เท่ากันเป๊ะถึงเทียบ priority (มากกว่าชนะ) ทุกโปรฯ ที่ไม่ถูกเลือกจะอยู่ใน `rejected` พร้อมเหตุผล
 * เสมอ (ใช้แสดงในหน้าทดลองคำนวณ T5.4)
 */
export function evaluatePromotions(input: EvaluatePromotionsInput): EvaluatePromotionsResult {
  const candidates: PromotionApplication[] = [];
  const rejected: RejectedPromotion[] = [];

  for (const rule of input.promotions) {
    if (rule.quotaRemaining === 0) {
      rejected.push({ promotionId: rule.id, promotionName: rule.name, reason: REJECTED_QUOTA });
      continue;
    }

    const conditionFailure = matchesConditions(rule, input);
    if (conditionFailure) {
      rejected.push({ promotionId: rule.id, promotionName: rule.name, reason: conditionFailure });
      continue;
    }

    const lines = eligibleLines(rule, input.cart);
    if (lines.length === 0) {
      rejected.push({ promotionId: rule.id, promotionName: rule.name, reason: REJECTED_NO_ELIGIBLE_LINES });
      continue;
    }

    const outcome = evaluateRule(rule, lines);
    if (!outcome.applicable) {
      rejected.push({
        promotionId: rule.id,
        promotionName: rule.name,
        reason: outcome.reason || REJECTED_ZERO_DISCOUNT,
      });
      continue;
    }

    candidates.push({
      promotionId: rule.id,
      promotionName: rule.name,
      discountSatang: outcome.discountSatang,
      bonusMinutes: outcome.bonusMinutes,
      reason: outcome.reason,
    });
  }

  if (candidates.length === 0) {
    return { applied: null, rejected };
  }

  const sorted = [...candidates].sort((a, b) => {
    if (b.discountSatang !== a.discountSatang) return b.discountSatang - a.discountSatang;
    const ruleA = input.promotions.find((r) => r.id === a.promotionId)!;
    const ruleB = input.promotions.find((r) => r.id === b.promotionId)!;
    return ruleB.priority - ruleA.priority;
  });

  const [winner, ...losers] = sorted;
  for (const loser of losers) {
    rejected.push({
      promotionId: loser.promotionId,
      promotionName: loser.promotionName,
      reason: `ใช้ได้จริง แต่โปรฯ "${winner!.promotionName}" ให้ส่วนลดมากกว่า (ระบบเลือกให้อัตโนมัติ — ดู docs/DOMAIN.md ข้อ 15)`,
    });
  }

  return { applied: winner!, rejected };
}
