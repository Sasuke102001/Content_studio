const path = require('path');
const { bundle } = require('@remotion/bundler');

async function main() {
  const entryPoint = path.join(__dirname, '..', 'src', 'Root.tsx');
  const outDir = path.join(__dirname, '..', '..', 'dist', 'motion-bundle');

  const bundleLocation = await bundle({
    entryPoint,
    outDir,
    onProgress: (progress) => {
      process.stdout.write(`\rBundling motion composition... ${progress}%`);
    },
  });

  process.stdout.write('\n');
  console.log(`Motion bundle created at: ${bundleLocation}`);
}

main().catch((err) => {
  console.error('Failed to bundle motion composition:', err);
  process.exit(1);
});
