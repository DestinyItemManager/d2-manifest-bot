#!/usr/bin/env node

import { getDestinyManifest } from 'bungie-api-ts/destiny2';
import { createHttpClient } from '@d2api/httpclient';
import latest from '../latest.json' with { type: 'json' };

import { writeFileSync } from 'node:fs';
const httpClient = createHttpClient(process.env.API_KEY!);

const skipCheck = process.env.SKIP_CHECK === 'true' ? true : false;

// do the thing
(async () => {
  const manifestMetadata = await getDestinyManifest(httpClient);

  const current = manifestMetadata.Response.version;
  const newREADME = `# d2-manifest-bot\ngithub action for checking for new d2 manifest\n\n# Current Manifest: ${current}`;

  if (!skipCheck) {
    console.log(`Latest:  ${latest}`);
    console.log(`Current: ${current}`);
    if (latest === current) {
      // nothing changed. no updates needed.
      return;
    }
    // if you are here, there's a new manifest
    console.log('New manifest detected');

    writeFileSync('latest.json', `${JSON.stringify(current, null, 2)}\n`, 'utf8');
    writeFileSync('README.md', newREADME, 'utf8');
  }

  const buildMessage = `New manifest build - ${current}`;

  // if (!/^[.\w-]+$/.test(versionNumber)) { I AM NOT REALLY SURE THIS NEEDS DOING. }

  const promises: Promise<void>[] = [];

  for (const repo of ['d2-additional-info', 'dim-custom-symbols']) {
    promises.push(
      (async () => {
        const buildOptions = {
          url: `https://api.github.com/repos/DestinyItemManager/${repo}/dispatches`,
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Basic ' + Buffer.from(process.env.PAT || '').toString('base64'),
            'User-Agent': 'd2-additional-info',
          },
          body: JSON.stringify({
            event_type: 'new-manifest-detected',
            client_payload: {
              message: buildMessage,
              branch: 'master',
              config: {
                env: {
                  MANIFEST_VERSION: current,
                },
              },
            },
          }),
          json: true,
          method: 'POST',
        };

        const githubFetch = await fetch(buildOptions.url, buildOptions);
        if (!githubFetch.ok) {
          console.log('Github returned an error pinging', repo);
          console.log(githubFetch);
          throw new Error('Github returned an error');
        }
      })(),
    );
  }

  const results = await Promise.allSettled(promises);
  if (results.some((r) => r.status === 'rejected')) {
    console.log('One or more of the github dispatches failed');
    process.exit(1);
  }
})().catch((e) => {
  console.log(e);
  process.exit(1);
});
