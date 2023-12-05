#!/usr/bin/env node

import btoa from 'btoa';
import fetch from 'cross-fetch';
import { load, setApiKey, verbose } from '@d2api/manifest-node';
import { loadedVersion } from '@d2api/manifest';
import latest from '../latest.json' assert { type: 'json' };
import fse from 'fs-extra';

const { writeFileSync } = fse;

verbose();
setApiKey(process.env.API_KEY);

const skipCheck = process.env.SKIP_CHECK === 'true' ? true : false;

// do the thing
(async () => {
  await load();
  const current = loadedVersion;
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

  const buildOptions = {
    url: 'https://api.github.com/repos/DestinyItemManager/d2-additional-info/dispatches',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: 'Basic ' + btoa(process.env.PAT || ''),
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
    console.log('Github returned an error');
    console.log(githubFetch);
    process.exit(1);
  }
})().catch((e) => {
  console.log(e);
  process.exit(1);
});
