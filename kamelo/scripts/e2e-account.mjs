import { PrismaClient } from "../generated/prisma/index.js";
import { randomBytes, scryptSync } from "node:crypto";
const db = new PrismaClient();
const email = "e2e-local@example.test";
const salt = randomBytes(16).toString("hex");
const password =
  salt + ":" + scryptSync("Local-test-password-123", salt, 64).toString("hex");
try {
  const existing = await db.user.findUnique({ where: { email } });
  if (!existing) {
    const org = await db.organization.create({
      data: { name: "E2E local only" },
    });
    await db.user.create({
      data: {
        organizationId: org.id,
        name: "Pemilik Uji",
        email,
        phone: "081234567890",
        password,
      },
    });
  }
  console.log("Local synthetic browser test account ready: " + email);
} finally {
  await db.$disconnect();
}
