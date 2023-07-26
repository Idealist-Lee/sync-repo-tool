import shell from "shelljs";
import { Octokit } from "@octokit/rest";
import { program } from "commander";

let args = process.argv.splice(2);

program // options
  .option("-d, --delete", "Delete repo when done")
  .parse(process.argv);

const originalRepoOwner = args[0];
const originalRepoName = args[1];
const originalRepoDefaultBranch = args[2];
const needSyncRepoOwner = args[3];
const needSyncRepoName = args[4];
const needSyncRepoBranch = args[5];
const syncerUsername = args[6];
const syncerEmail = args[7];
const syncerToken = args[8];
const originalRepoUrl = `https://github.com/${originalRepoOwner}/${originalRepoName}.git`;
const needSyncRepoUrl = `https://${syncerUsername}:${syncerToken}@github.com/${needSyncRepoOwner}/${needSyncRepoName}.git`;

if (shell.cd("repo").code !== 0) {
  shell.mkdir("repo");
  shell.cd("repo");
}

shell.exec(`git config --global user.name ${syncerUsername}`);
shell.exec(`git config --global user.email ${syncerEmail}`);

shell.exec(`git clone ${needSyncRepoUrl}`);
console.log(`Finished cloning ${needSyncRepoUrl} `);
shell.cd(needSyncRepoName);
shell.exec(`pwd`);
shell.exec(`git remote add upstream ${originalRepoUrl}`);
shell.exec(`git config pull.rebase false`);

// Pull from {source}/master
const output = shell.exec(
  `git pull upstream ${originalRepoDefaultBranch}`
).stdout;
console.log(output);
console.log(`There are new commits in ${originalRepoName}.`);
shell.exec(`git commit -am "merging all conflicts"`);
const hash = shell.exec(`git rev-parse ${originalRepoDefaultBranch}`).stdout;
const shortHash = hash.substr(0, 8);
const syncBranch = `sync-${shortHash}`;

if (shell.exec(`git checkout ${syncBranch}`).code !== 0) {
  shell.exec(`git checkout -b ${syncBranch}`);

  const lines = output.split("\n");
  // Commit all merge conflicts
  const conflictLines = lines.filter((line) => line.startsWith("CONFLICT"));
  const conflictFiles = conflictLines.map((line) =>
    line.substr(line.lastIndexOf(" ") + 1)
  );

  if (conflictFiles.length === 0) {
    console.log("\nNo conflicts found. Committing directly to master.");
    shell.exec(`git checkout ${needSyncRepoBranch}`);
    shell.exec(`git merge ${syncBranch}`);
    shell.exec(`git push origin ${needSyncRepoBranch}`);
    shell.exec(`git remote get-url origin`);
  } else {
    console.log("conflict files: ", conflictFiles.join("\n"));
    // Create a new pull request, listing all conflicting files
    shell.exec(`git push --set-upstream origin ${syncBranch}`);

    const title = `Sync with ${needSyncRepoName} @ ${shortHash}`;

    const conflictsText = `下面的文件存在冲突，请处理后合并：\n${conflictFiles
        .map(
          (file) =>
            ` * [ ] [${file}](/${needSyncRepoOwner}/${needSyncRepoName}/commits/master/${file})`
        )
        .join("\n")}
    `;

    const body = `合并自 ${originalRepoUrl} @ ${shortHash}\n${conflictFiles.length > 0 ? conflictsText : "无冲突"}\n## 不要 Squash 此 Pull Request！！！`;

    let retryNum = 0;
    async function createPullRequest() {
      console.log(`It's ready to create a pull request.`);
      retryNum++;
      const octokit = new Octokit({
        auth: `token ${syncerToken}`,
        previews: ["hellcat-preview"],
      });

      try {
        const {
          data: { number },
        } = await octokit.pulls.create({
          owner: needSyncRepoOwner,
          repo: needSyncRepoName,
          title,
          body,
          head: syncBranch,
          base: originalRepoDefaultBranch,
        });
      } catch (err) {
        console.log(err);
        retryNum < 5 && createPullRequest();
      }
    }
    createPullRequest();
    console.log(`\nCreated pull request of sync-${shortHash} `);
  }
} else {
  console.log(`\nThe pull request of sync-${shortHash} is pending `);
}
