import { DiscoveryEngine } from '../core/DiscoveryEngine';

async function main() {
  const args = process.argv.slice(2);
  const urlArg = args.find((a) => a.startsWith('--url='));
  const depthArg = args.find((a) => a.startsWith('--depth='));
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const outputArg = args.find((a) => a.startsWith('--output='));
  const nameArg = args.find((a) => a.startsWith('--name='));
  const userArg = args.find((a) => a.startsWith('--login-user='));
  const passArg = args.find((a) => a.startsWith('--login-pass='));
  const headlessArg = args.find((a) => a.startsWith('--headless='));

  if (!urlArg) {
    console.error(
      'Usage: npm run discover -- --url=https://example.com [--name=example] [--depth=2] [--max-pages=50] [--login-user=USER --login-pass=PASS] [--output=projects/example/discovered] [--headless=true]',
    );
    process.exit(1);
  }

  const url = urlArg.split('=')[1];
  const depth = depthArg ? Number(depthArg.split('=')[1]) : undefined;
  const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : undefined;
  const outputDir = outputArg ? outputArg.split('=')[1] : undefined;
  const name = nameArg ? nameArg.split('=')[1] : undefined;
  const headless = headlessArg ? headlessArg.split('=')[1] !== 'false' : undefined;

  // 登录凭据:显式参数优先,否则回退 USERNAME/PASSWORD 环境变量(配合 --login)
  const username = userArg ? userArg.split('=')[1] : '';
  const password = passArg ? passArg.split('=')[1] : '';
  const login =
    username || password || args.includes('--login')
      ? {
          username: username || process.env.USERNAME || '',
          password: password || process.env.PASSWORD || '',
        }
      : undefined;

  const engine = new DiscoveryEngine();
  const result = await engine.discover({ url, depth, maxPages, outputDir, name, login, headless });

  console.log(
    `Discovery complete: ${result.pages.length} pages, ${result.forms.length} forms, ${result.apis.length} APIs`,
  );
  console.log(`Output: ${result.outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
