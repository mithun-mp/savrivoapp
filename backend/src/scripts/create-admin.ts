import dotenv from 'dotenv';
dotenv.config();

import readline from 'readline';
import { Writable } from 'stream';
import { z } from 'zod';
import { connectDatabase, disconnectDatabase } from '../database/connection';
import { sanitizeErrorMessage } from '../utils/sanitize';
import { hashPassword } from '../services/auth.service';
import { AdminUser } from '../models/AdminUser.model';

/**
 * Creates a readline interface with mutable stdout output for hidden password entry.
 * When muted is true, keystrokes are swallowed and not echoed to terminal output.
 */
function createPrompt() {
  let muted = false;
  const mutableStdout = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) {
        process.stdout.write(chunk, encoding);
      }
      callback();
    },
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: mutableStdout,
    terminal: true,
  });

  const onSigInt = () => {
    muted = false;
    rl.close();
    process.exit(130);
  };
  rl.on('SIGINT', onSigInt);

  return {
    ask(query: string): Promise<string> {
      return new Promise((resolve) => {
        muted = false;
        rl.question(query, (ans) => {
          resolve(ans.trim());
        });
      });
    },
    askHidden(query: string): Promise<string> {
      return new Promise((resolve) => {
        process.stdout.write(query);
        muted = true;
        rl.question('', (ans) => {
          muted = false;
          process.stdout.write('\n');
          // Strip only line terminators, preserving all leading and trailing whitespace
          resolve(ans.replace(/[\r\n]+$/, ''));
        });
      });
    },
    close() {
      muted = false;
      rl.removeListener('SIGINT', onSigInt);
      rl.close();
    },
  };
}

const emailSchema = z.string().email('Invalid email address format.');

async function run(): Promise<void> {
  console.log('\n==========================================');
  console.log('   SAVRIVO — Administrator Provisioning   ');
  console.log('==========================================\n');

  // Verify interactive TTY is available before attempting password prompt or database operations
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    console.error('[Admin] Error: Interactive terminal (TTY) is required for administrator provisioning.');
    console.error('[Admin] Both stdin and stdout must be attached to an interactive terminal session (e.g. Render Shell).');
    process.exitCode = 1;
    return;
  }

  const prompt = createPrompt();

  try {
    let email = process.env.ADMIN_EMAIL?.trim();
    if (!email) {
      email = await prompt.ask('Enter administrator email: ');
    } else {
      console.log(`Using email from ADMIN_EMAIL environment variable: ${email}`);
    }

    email = email.trim().toLowerCase();
    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      console.error(`\n[Admin] Validation error: ${emailResult.error.errors[0]?.message ?? 'Invalid email'}`);
      process.exitCode = 1;
      return;
    }

    // Prompt for password interactively; never read passwords from environment variables
    // Preserve exact password as entered without trimming leading or trailing whitespace
    const password = await prompt.askHidden('Enter administrator password (min 8 characters): ');
    if (password.length < 8) {
      console.error('\n[Admin] Error: Password must be at least 8 characters long.');
      process.exitCode = 1;
      return;
    }

    const confirmPassword = await prompt.askHidden('Confirm administrator password: ');
    if (password !== confirmPassword) {
      console.error('\n[Admin] Error: Passwords do not match.');
      process.exitCode = 1;
      return;
    }

    // Prompt reading is done, close the terminal interface
    prompt.close();

    console.log('\n[Admin] Connecting to database...');
    await connectDatabase();

    // Check if account already exists
    const existing = await AdminUser.findOne({ email });
    if (existing) {
      console.log(`\n[Admin] User "${email}" already exists with role "${existing.role}" (active: ${existing.active}).`);
      console.log('[Admin] Security notice: Existing account details, role, and password were not modified.');
      return;
    }

    console.log('[Admin] Hashing credentials with bcrypt (cost factor 12)...');
    const passwordHash = await hashPassword(password);

    await AdminUser.create({
      email,
      passwordHash,
      role: 'superadmin',
      active: true,
    });

    console.log(`\n✅ Administrator account successfully created!`);
    console.log(`   Email: ${email}`);
    console.log(`   Role:  superadmin`);
    console.log(`   State: active`);
    console.log(`\nYou may now sign in at /admin/login.`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\n[Admin] Fatal error during admin provisioning:', sanitizeErrorMessage(message));
    process.exitCode = 1;
  } finally {
    prompt.close();
    await disconnectDatabase();
  }
}

run().catch((err: unknown) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error('[Admin] Unhandled script rejection:', sanitizeErrorMessage(message));
  process.exit(1);
});
