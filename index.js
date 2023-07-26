import  metas  from './usage/metas.js';

import Promise from 'bluebird';
import s from 'shelljs'
const shell = Promise.promisifyAll(s);
import {program} from 'commander';
let args = process.argv.splice(2)

program
    .option('-c, --concurrency <n>', 'Concurrency to run script', parseInt)
    .option('-d, --delete', 'Delete repos afterwards')
    .parse(process.argv);

if (shell.ls('repo').code !== 0) {
    shell.mkdir('repo');
}

Promise.map(
    metas(),
    meta => {
        return shell.exec(
            `node ./sync.js ${meta.originalRepoOwner} ${meta.originalRepoName} ${meta.originalRepoDefaultBranch} ${meta.needSyncRepoOwner} ${meta.needSyncRepoName} ${meta.needSyncRepoBranch} ${meta.syncerUsername} ${meta.syncerEmail} ${args[0]}`,
        );
    }
);
