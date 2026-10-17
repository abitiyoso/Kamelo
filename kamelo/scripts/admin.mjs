import { PrismaClient } from "../generated/prisma/index.js";
const email = process.argv[2];
if (!email) {
  console.error("Usage: node scripts/admin.mjs verified-admin@example.com");
  process.exit(1);
}
const db = new PrismaClient();
try {
  const user = await db.user.findUniqueOrThrow({
    where: { email: email.toLowerCase() },
  });
  await db.user.update({
    where: { id: user.id },
    data: { platformAdmin: true },
  });
  await db.audit.create({
    data: {
      organizationId: user.organizationId,
      actorId: "local-operator",
      action: "PLATFORM_ADMIN_PROVISIONED",
      targetId: user.id,
      metadata: {},
    },
  });
  console.log(
    "Administrator provisioned. Verify operator identity before using this command.",
  );
} finally {
  await db.$disconnect();
}
