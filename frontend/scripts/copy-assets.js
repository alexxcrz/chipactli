import { promises as fs } from 'fs';
import path from 'path';

async function copyDir(src, dest) {
  await fs.mkdir(dest, { recursive: true });
  const entries = await fs.readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  // Determine frontend root and target public folder depending on where script is run
  const cwd = process.cwd();
  const baseName = path.basename(cwd);
  let frontendRoot = null;
  let targetPublic = null;
  if (baseName === 'react-app') {
    const repoRoot = path.resolve(cwd, '..', '..');
    frontendRoot = path.join(repoRoot, 'frontend');
    targetPublic = path.join(cwd, 'public');
  } else {
    // running from `frontend` root
    frontendRoot = cwd;
    targetPublic = path.join(cwd, 'public');
  }

  function exists(p) {
    return fs.stat(p).then(() => true).catch(() => false);
  }

  // Copy images
  // Try a few common locations for assets in the repo
  const possibleImageSrcs = [
    path.join(frontendRoot, 'images'),
    path.join(frontendRoot, 'public', 'images'),
    path.join(frontendRoot, 'src', 'images')
  ];
  const imagesDest = path.join(targetPublic, 'images');
  for (const s of possibleImageSrcs) {
    if (await exists(s)) {
      try { await copyDir(s, imagesDest); console.log('Images copied to', imagesDest); break } catch (e) { console.error('Failed to copy images from', s, e.message) }
    }
  }

  // Copy modules and utils referenced by the SW if desired
  const possibleModulesSrcs = [
    path.join(frontendRoot, 'modules'),
    path.join(frontendRoot, 'public', 'modules')
  ];
  const modulesDest = path.join(targetPublic, 'modules');
  for (const s of possibleModulesSrcs) {
    if (await exists(s)) {
      try { await copyDir(s, modulesDest); console.log('Modules copied to', modulesDest); break } catch (e) { console.error('Failed to copy modules from', s, e.message) }
    }
  }

  // Copy utils
  const possibleUtilsSrcs = [
    path.join(frontendRoot, 'utils'),
    path.join(frontendRoot, 'public', 'utils')
  ];
  const utilsDest = path.join(targetPublic, 'utils');
  for (const s of possibleUtilsSrcs) {
    if (await exists(s)) {
      try { await copyDir(s, utilsDest); console.log('Utils copied to', utilsDest); break } catch (e) { console.error('Failed to copy utils from', s, e.message) }
    }
  }

  // Copy top-level config and main and legacy html and css files from frontend root
  const filesToCopy = ['config.js', 'main.js', 'index.legacy.html', 'manifest.json'];
  for (const fname of filesToCopy) {
    const src = path.join(frontendRoot, fname);
    const dest = path.join(targetPublic, fname);
    if (await exists(src)) {
      try { await fs.copyFile(src, dest); console.log(`${fname} copied to`, dest) } catch (e) { console.error(`Failed copying ${fname}:`, e.message) }
    }
  }

  // Copy CSS files from frontend root
  try {
    const entries = await fs.readdir(path.join(frontendRoot), { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile()) continue;
      if (entry.name.endsWith('.css')) {
        const src = path.join(frontendRoot, entry.name);
        const dest = path.join(targetPublic, entry.name);
        if (await exists(src)) {
          await fs.copyFile(src, dest);
          console.log(`${entry.name} copied to`, dest);
        }
      }
    }
  } catch (e) {
    console.error('Failed copying CSS files:', e.message);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
