const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectDir = path.join(__dirname, '..', 'test_temp');
const planPath = path.join(projectDir, 'plan.md');
const paramsPath = path.join(projectDir, 'params.json');
const pythonExe = path.join(__dirname, '..', 'resources', 'bin', 'python', 'python.exe');
const scriptPath = path.join(__dirname, '..', 'engine', 'run_engine.py');

function main() {
  if (!fs.existsSync(planPath)) {
    console.error('plan.md does not exist. Run the plan action first.');
    process.exit(1);
  }

  const planContent = fs.readFileSync(planPath, 'utf-8');
  const params = JSON.parse(fs.readFileSync(paramsPath, 'utf-8'));
  
  params.plan_content = planContent;
  fs.writeFileSync(paramsPath, JSON.stringify(params, null, 2), 'utf-8');

  console.log('Spawning engine generate action...');
  const child = spawn(pythonExe, [
    scriptPath,
    '--action', 'generate',
    '--mode', 'linkedin',
    '--project-dir', projectDir,
    '--revision-id', 'rev_01',
    '--params-file', paramsPath
  ]);

  child.stdout.on('data', (data) => {
    console.log('[STDOUT]:', data.toString().trim());
  });

  child.stderr.on('data', (data) => {
    console.error('[STDERR]:', data.toString().trim());
  });

  child.on('close', (code) => {
    console.log(`Child process exited with code ${code}`);
    if (code === 0) {
      console.log('HTML Generation succeeded! Check test_temp/carousel.html');
    }
  });
}

main();
