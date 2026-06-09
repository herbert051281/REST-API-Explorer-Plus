#!/usr/bin/env node
/**
 * Copies the built extension/ folder to the SharePoint location synced via
 * OneDrive for Business. Teammates point "Load unpacked" at their own synced
 * copy of that SharePoint folder — reloading the extension picks up the update.
 *
 * Run standalone:  npm run deploy
 * Also runs automatically at the end of:  npm run build:extension
 */

import { cpSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SHAREPOINT_DEPLOY_PATH =
  'C:\\Users\\E112671\\RSM\\Customer Success - Project & Document Templates and Wiki\\REST API Explorer Plus Extension';

console.log('Deploying to SharePoint (OneDrive sync)…');
try {
  cpSync(join(root, 'extension'), SHAREPOINT_DEPLOY_PATH, { recursive: true });
  console.log(`   extension/  → ${SHAREPOINT_DEPLOY_PATH}`);

  copyFileSync(join(root, 'docs', 'install-guide.html'), join(SHAREPOINT_DEPLOY_PATH, 'install-guide.html'));
  console.log(`   install-guide.html → ${SHAREPOINT_DEPLOY_PATH}`);

  console.log('✅ Done. OneDrive will sync changes to SharePoint.');
  console.log('   Teammates: reload the extension in edge://extensions to pick up updates.');
} catch (err) {
  console.error(`❌ Deploy failed: ${err.message}`);
  console.error('   Check that the OneDrive folder is accessible and try again.');
  process.exit(1);
}
