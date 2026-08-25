import { hashPassword } from "../src/lib/backend/data-store.js";

const [, , email, password] = process.argv;

if (!email || !password) {
  console.error("Usage: node scripts/hash-admin-password.mjs <email> <password>");
  process.exit(1);
}

const escapedEmail = email.replaceAll("'", "''");
const escapedHash = hashPassword(password).replaceAll("'", "''");

console.log(`update bootcamp_tracker.users
set email = '${escapedEmail}',
    password_hash = '${escapedHash}'
where id = 'admin';`);
