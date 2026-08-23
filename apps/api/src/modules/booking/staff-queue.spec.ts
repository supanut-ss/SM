import { describe, expect, it } from "vitest";
import { joinQueue, moveToBack, moveToFront, reorderAfterJobCompleted, type QueueEntry } from "./staff-queue";

function positions(queue: QueueEntry[]): string[] {
  return [...queue].sort((a, b) => a.position - b.position).map((e) => e.staffId);
}

describe("joinQueue", () => {
  it("เพิ่มพนักงานคนแรกที่ตำแหน่ง 0 เมื่อคิวว่าง", () => {
    const result = joinQueue([], "A");
    expect(positions(result)).toEqual(["A"]);
  });

  it("เพิ่มพนักงานใหม่ต่อท้ายคิวที่มีอยู่แล้ว", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
    ];
    expect(positions(joinQueue(queue, "C"))).toEqual(["A", "B", "C"]);
  });

  it("ไม่ทำอะไรถ้าพนักงานอยู่ในคิวอยู่แล้ว (idempotent)", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
    ];
    const result = joinQueue(queue, "A");
    expect(positions(result)).toEqual(["A", "B"]);
    expect(result).toEqual(queue);
  });
});

describe("moveToBack", () => {
  it("ย้ายพนักงานจากหัวคิวไปท้ายคิว", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
      { staffId: "C", position: 2 },
    ];
    expect(positions(moveToBack(queue, "A"))).toEqual(["B", "C", "A"]);
  });

  it("ย้ายพนักงานจากตรงกลางไปท้ายคิว", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
      { staffId: "C", position: 2 },
    ];
    expect(positions(moveToBack(queue, "B"))).toEqual(["A", "C", "B"]);
  });

  it("เพิ่มเข้าคิวท้ายสุดถ้าพนักงานยังไม่เคยอยู่ในคิวเลย", () => {
    const queue: QueueEntry[] = [{ staffId: "A", position: 0 }];
    expect(positions(moveToBack(queue, "Z"))).toEqual(["A", "Z"]);
  });

  it("คิวมีคนเดียวก็ยังอยู่ตำแหน่งเดิม (ท้ายคิว = หัวคิวเมื่อมีคนเดียว)", () => {
    const queue: QueueEntry[] = [{ staffId: "A", position: 0 }];
    expect(positions(moveToBack(queue, "A"))).toEqual(["A"]);
  });
});

describe("moveToFront", () => {
  it("ย้ายพนักงานจากท้ายคิวไปหัวคิว", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
      { staffId: "C", position: 2 },
    ];
    expect(positions(moveToFront(queue, "C"))).toEqual(["C", "A", "B"]);
  });

  it("ย้ายพนักงานจากตรงกลางไปหัวคิว", () => {
    const queue: QueueEntry[] = [
      { staffId: "A", position: 0 },
      { staffId: "B", position: 1 },
      { staffId: "C", position: 2 },
    ];
    expect(positions(moveToFront(queue, "B"))).toEqual(["B", "A", "C"]);
  });

  it("เพิ่มเข้าคิวหัวสุดถ้าพนักงานยังไม่เคยอยู่ในคิวเลย", () => {
    const queue: QueueEntry[] = [{ staffId: "A", position: 0 }];
    expect(positions(moveToFront(queue, "Z"))).toEqual(["Z", "A"]);
  });

  it("คิวว่างเปล่าก็ยังเพิ่มพนักงานได้", () => {
    expect(positions(moveToFront([], "A"))).toEqual(["A"]);
  });
});

describe("reorderAfterJobCompleted", () => {
  const queue: QueueEntry[] = [
    { staffId: "A", position: 0 },
    { staffId: "B", position: 1 },
    { staffId: "C", position: 2 },
  ];

  it("งานคิวหมุน (ROTATION) เสียตำแหน่งเสมอ ไม่ว่าจะตั้งค่า customRequestKeepsQueuePosition อย่างไร", () => {
    expect(positions(reorderAfterJobCompleted(queue, "A", "ROTATION", false))).toEqual(["B", "C", "A"]);
    expect(positions(reorderAfterJobCompleted(queue, "A", "ROTATION", true))).toEqual(["B", "C", "A"]);
  });

  it("งานลูกค้าขอ (CUSTOMER_REQUEST) เสียตำแหน่งเมื่อ customRequestKeepsQueuePosition = false", () => {
    expect(positions(reorderAfterJobCompleted(queue, "A", "CUSTOMER_REQUEST", false))).toEqual(["B", "C", "A"]);
  });

  it("งานลูกค้าขอ (CUSTOMER_REQUEST) ไม่เสียตำแหน่งเมื่อ customRequestKeepsQueuePosition = true", () => {
    expect(positions(reorderAfterJobCompleted(queue, "A", "CUSTOMER_REQUEST", true))).toEqual(["A", "B", "C"]);
  });

  it("งานลูกค้าขอที่ไม่เสียตำแหน่ง คืนคิวเดิมทุกประการ (ไม่ renumber โดยไม่จำเป็น)", () => {
    const result = reorderAfterJobCompleted(queue, "B", "CUSTOMER_REQUEST", true);
    expect(result).toEqual(queue);
  });
});
