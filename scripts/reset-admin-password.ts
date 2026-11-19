import 'dotenv/config';
import readline from 'node:readline';
import { applySuperAdminPasswordUpdate, mutateStore } from '../server/store.ts';

function promptHidden(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const stdin = process.stdin;
    const onData = (char: Buffer) => {
      const str = char.toString('utf8');
      if (str === '\n' || str === '\r' || str === '\u0004') {
        stdin.removeListener('data', onData);
      } else {
        process.stdout.write('\x1B[2K\x1B[200D' + question);
      }
    };
    if (stdin.isTTY) {
      stdin.on('data', onData);
    }
    rl.question(question, (answer) => {
      rl.close();
      if (stdin.isTTY) process.stdout.write('\n');
      resolve(answer.trim());
    });
  });
}

async function main() {
  const email = (process.env.ADMIN_RESET_EMAIL || 'admin.corpu@pln.co.id').trim().toLowerCase();
  let newPassword = process.env.ADMIN_NEW_PASSWORD?.trim() || '';

  if (!newPassword) {
    newPassword = await promptHidden(`Masukkan password baru untuk Super Admin (${email}) [min. 8 karakter]: `);
  }

  if (newPassword.length < 8) {
    console.error('Gagal: Password baru wajib minimal 8 karakter.');
    process.exit(1);
  }

  const updated = mutateStore((state) =>
    applySuperAdminPasswordUpdate(state, {
      email,
      newPassword,
      action: 'ADMIN_CLI_PASSWORD_RESET',
      details: `Pemulihan password Super Admin (${email}) melalui perintah CLI server-side terotorisasi.`,
    }),
  );

  console.log(`Berhasil: Akun ${updated.email} (${updated.role}) telah diperbarui dan seluruh sesi lama dicabut.`);
}

main().catch((err) => {
  console.error('Terjadi kesalahan saat mereset password admin:', err);
  process.exit(1);
});
