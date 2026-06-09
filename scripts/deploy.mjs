#!/usr/bin/env node
/**
 * Copies the built extension/ folder to the SharePoint location synced via
 * OneDrive for Business. Teammates point "Load unpacked" at their own synced
 * copy of that SharePoint folder — reloading the extension picks up the update.
 *
 * Run standalone:  npm run deploy
 * Also runs automatically at the end of:  npm run build:extension
 */

import { cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const SHAREPOINT_DEPLOY_PATH =
  'C:\\Users\\E112671\\RSM\\Customer Success - Project & Document Templates and Wiki\\REST API Explorer Plus Extension';

console.log('Deploying extension to SharePoint (OneDrive sync)…');
try {
  cpSync(join(root, 'extension'), SHAREPOINT_DEPLOY_PATH, { recursive: true });
  console.log(`✅ Deployed → ${SHAREPOINT_DEPLOY_PATH}`);
  console.log('   OneDrive will sync the changes to SharePoint.');
  console.log('   Teammates: reload the extension in edge://extensions to pick up the update.');
} catch (err) {
  console.error(`❌ Deploy failed: ${err.message}`);
  console.error('   Check that the OneDrive folder is accessible and try again.');
  process.exit(1);
}
