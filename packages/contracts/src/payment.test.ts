import { describe, expect, it } from "vitest";
import { PAYMENT_METHODS, PAYMENT_METHOD_LABEL } from "./payment.js";

describe("PAYMENT_METHODS", () => {
  it("has a Thai label for every payment method", () => {
    for (const method of PAYMENT_METHODS) {
      expect(PAYMENT_METHOD_LABEL[method]).toBeTruthy();
    }
  });

  it("matches docs/DOMAIN.md ข้อ 10 exactly (เงินสด/คอร์ส/วอยเชอร์/อภินันทนาการ)", () => {
    expect(PAYMENT_METHODS).toEqual(["CASH", "PACKAGE", "VOUCHER", "COMPLIMENTARY"]);
  });
});
