import { DiscoveryEngine } from '../core/DiscoveryEngine';

async function main() {
  const args = process.argv.slice(2);
  const urlArg = args.find((a) => a.startsWith('--url='));
  const depthArg = args.find((a) => a.startsWith('--depth='));
  const maxPagesArg = args.find((a) => a.startsWith('--max-pages='));
  const outputArg = args.find((a) => a.startsWith('--output='));
  const headlessArg = args.find((a) => a.startsWith('--headless='));

  if (!urlArg) {
    console.error(
      'Usage: npm run discover -- --url=https://example.com [--depth=2] [--max-pages=50] [--output=discovered/example.com] [--headless=true]',
    );
    process.exit(1);
  }

  const url = urlArg.split('=')[1];
  const depth = depthArg ? Number(depthArg.split('=')[1]) : undefined;
  const maxPages = maxPagesArg ? Number(maxPagesArg.split('=')[1]) : undefined;
  const outputDir = outputArg ? outputArg.split('=')[1] : undefined;
  const headless = headlessArg ? headlessArg.split('=')[1] !== 'false' : undefined;

  const engine = new DiscoveryEngine();
  const result = await engine.discover({ url, depth, maxPages, outputDir, headless });

  console.log(
    `Discovery complete: ${result.pages.length} pages, ${result.forms.length} forms, ${result.apis.length} APIs`,
  );
  console.log(`Output: ${result.outputDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
