// Build with the GitHub Pages base path and publish dist/ to the gh-pages branch.
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const run = (cmd, opts = {}) => execSync(cmd, { stdio: 'inherit', ...opts });
const remote = execSync('git remote get-url origin').toString().trim();
const repo = remote.replace(/\.git$/, '').split('/').pop();

run('npm run build', { env: { ...process.env, BASE_PATH: `/${repo}/` } });
writeFileSync('dist/.nojekyll', '');

const git = (c) => run(`git ${c}`, { cwd: 'dist' });
git('init -q -b gh-pages');
git('add -A');
git('-c core.autocrlf=false commit -q -m "Deploy"');
git(`push -f ${remote} gh-pages`);
console.log(`\nDeployed: https://${remote.split('/').at(-2)}.github.io/${repo}/`);
