import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// seed ต้อง idempotent — รันซ้ำได้จากศูนย์เสมอ (ดู docs/PLAN.md เกณฑ์ผ่าน T0.3)
async function main() {
  const branch = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {},
    create: {
      name: "สาขาหลัก",
      code: "MAIN",
    },
  });

  console.log(`seed: ready — branch ${branch.name} (${branch.code})`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
