import { db } from "../src/lib/db";
import { users } from "../src/lib/db/schema";

async function main() {
  const allUsers = await db.select().from(users).limit(10);
  console.log("Users in DB:", allUsers);
}

main().catch(console.error);
