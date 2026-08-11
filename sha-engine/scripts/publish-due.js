#!/usr/bin/env node
/**
 * Publishes approved posts whose scheduled slot has arrived.
 *
 * Run frequently from the Render cron (hourly is plenty). Only ever touches
 * posts Sha has explicitly approved.
 */
import { Store } from '../src/lib/store.js';
import { InstagramComposio } from '../src/platforms/instagram-composio.js';
import { publishApproved } from '../src/stages/ship.js';

const store = new Store();
const platform = new InstagramComposio();

const account = await platform.getAccountInfo();
if (!account.canPublish) {
  console.error(`@${account.username} is ${account.accountType}; publishing needs BUSINESS or CREATOR`);
  process.exit(1);
}

const results = await publishApproved(store, platform);

if (!results.length) {
  console.log('Nothing due.');
} else {
  for (const r of results) {
    console.log(r.ok ? `published ${r.id} -> ${r.permalink ?? '(no link)'}` : `FAILED ${r.id}: ${r.error}`);
  }
}

if (results.some((r) => !r.ok)) process.exit(1);
