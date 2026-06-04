import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const source = join(root, 'apresentacao');
const target = join(root, 'carecore-site', 'public', 'guia');

const htmlSource = join(source, 'apresentacao-carecore.html');

if (!existsSync(htmlSource)) {
  if (existsSync(join(target, 'guia-carecore.html'))) {
    console.warn('Origem do guia não encontrada; usando public/guia já sincronizado.');
    process.exit(0);
  }

  console.error('Arquivo não encontrado:', htmlSource);
  process.exit(1);
}

function copyFileSafe(src, dest) {
  writeFileSync(dest, readFileSync(src));
}

function copyDirSafe(srcDir, destDir) {
  mkdirSync(destDir, { recursive: true });

  for (const entry of readdirSync(srcDir)) {
    const srcPath = join(srcDir, entry);
    const destPath = join(destDir, entry);

    if (statSync(srcPath).isDirectory()) {
      copyDirSafe(srcPath, destPath);
      continue;
    }

    copyFileSafe(srcPath, destPath);
  }
}

mkdirSync(target, { recursive: true });

copyFileSafe(htmlSource, join(target, 'guia-carecore.html'));
copyFileSafe(join(source, 'logo.png'), join(target, 'logo.png'));
copyFileSafe(join(source, 'whatsapp_qr.svg'), join(target, 'whatsapp_qr.svg'));

const telasTarget = join(target, 'telas');
if (existsSync(telasTarget)) {
  rmSync(telasTarget, { recursive: true, force: true });
}

copyDirSafe(join(source, 'telas'), telasTarget);

console.log('Guia sincronizado em carecore-site/public/guia/');
