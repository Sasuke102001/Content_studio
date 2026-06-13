const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Pinned Versions
const PYTHON_VERSION = '3.10.11';
const PLAYWRIGHT_VERSION = '1.49.1';
const REQUESTS_VERSION = '2.34.2';
const IMG2PDF_VERSION = '0.6.0';
const DOTENV_VERSION = '1.2.2';
const BS4_VERSION = '4.12.3';
const MARKDOWN_IT_VERSION = '4.0.0';

const PYTHON_ZIP_URL = `https://www.python.org/ftp/python/${PYTHON_VERSION}/python-${PYTHON_VERSION}-embed-amd64.zip`;
const GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py';

const projectRoot = path.join(__dirname, '..');
const cacheDir = path.join(projectRoot, 'cache');
const resourcesDir = path.join(projectRoot, 'resources');
const binDir = path.join(resourcesDir, 'bin');
const pythonDir = path.join(binDir, 'python');
const pythonExePath = path.join(pythonDir, 'python.exe');
const pipExePath = path.join(pythonDir, 'Scripts', 'pip.exe');

const cachedZipPath = path.join(cacheDir, `python-${PYTHON_VERSION}-embed-amd64.zip`);
const cachedPipScriptPath = path.join(cacheDir, 'get-pip.py');

const tempZipPath = path.join(resourcesDir, 'python-embed.zip');
const tempPipScriptPath = path.join(pythonDir, 'get-pip.py');

// Helper to download a file with redirection support
function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`Downloading: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download file: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

// Check if all python dependencies can be imported successfully
function checkDependenciesImportable() {
  if (!fs.existsSync(pythonExePath)) return false;
  try {
    const checkCommand = `"${pythonExePath}" -c "import requests, playwright, img2pdf, dotenv, bs4, markdown_it"`;
    execSync(checkCommand, { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

async function main() {
  try {
    // Ensure cache and resources directories exist
    if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
    if (!fs.existsSync(resourcesDir)) fs.mkdirSync(resourcesDir, { recursive: true });
    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });

    // Step 1: Pre-check if portable python and dependencies are already complete
    if (checkDependenciesImportable()) {
      console.log('Portable Python environment and all pinned dependencies are already set up and importable. Skipping all download and install tasks.');
      console.log('\n--- Setup Portable Python Completed (Cached & Ready) ---');
      return;
    }

    // Step 2: Handle Python portable runtime download/extract
    if (fs.existsSync(pythonExePath)) {
      console.log('Python executable found, but dependencies are missing or broken. Re-verifying setup...');
    } else {
      if (!fs.existsSync(pythonDir)) fs.mkdirSync(pythonDir, { recursive: true });

      // Check cache first
      if (fs.existsSync(cachedZipPath)) {
        console.log(`Using cached Python zip: ${cachedZipPath}`);
        fs.copyFileSync(cachedZipPath, tempZipPath);
      } else {
        await downloadFile(PYTHON_ZIP_URL, cachedZipPath);
        fs.copyFileSync(cachedZipPath, tempZipPath);
      }

      // Extract using PowerShell
      console.log(`Extracting ${tempZipPath} to ${pythonDir}...`);
      const extractCmd = `powershell -Command "Expand-Archive -Path '${tempZipPath}' -DestinationPath '${pythonDir}' -Force"`;
      execSync(extractCmd);
      console.log('Extraction complete.');

      // Clean up temp zip
      fs.unlinkSync(tempZipPath);
    }

    // Step 3: Enable site-packages in python310._pth
    const pthFile = path.join(pythonDir, 'python310._pth');
    if (fs.existsSync(pthFile)) {
      console.log('Configuring python310._pth to enable import site...');
      let content = fs.readFileSync(pthFile, 'utf-8');
      if (content.includes('#import site') || content.includes('# import site')) {
        content = content.replace(/#\s*import site/, 'import site');
        fs.writeFileSync(pthFile, content, 'utf-8');
        console.log('Configured successfully.');
      } else if (!content.includes('import site')) {
        content += '\nimport site\n';
        fs.writeFileSync(pthFile, content, 'utf-8');
        console.log('Appended import site successfully.');
      }
    }

    // Step 4: Install pip inside portable environment
    if (!fs.existsSync(pipExePath)) {
      console.log('Installing pip in portable environment...');
      if (fs.existsSync(cachedPipScriptPath)) {
        console.log(`Using cached get-pip.py: ${cachedPipScriptPath}`);
        fs.copyFileSync(cachedPipScriptPath, tempPipScriptPath);
      } else {
        await downloadFile(GET_PIP_URL, cachedPipScriptPath);
        fs.copyFileSync(cachedPipScriptPath, tempPipScriptPath);
      }

      execSync(`"${pythonExePath}" "${tempPipScriptPath}" --no-warn-script-location`);
      console.log('pip installation complete.');

      // Clean up temp script
      fs.unlinkSync(tempPipScriptPath);
    } else {
      console.log('pip is already installed.');
    }

    // Step 5: Install Pinned Dependencies
    console.log('Installing dependencies with pinned versions...');
    const pipCommand = `"${pythonExePath}" -m pip install ` +
      `requests==${REQUESTS_VERSION} ` +
      `playwright==${PLAYWRIGHT_VERSION} ` +
      `img2pdf==${IMG2PDF_VERSION} ` +
      `python-dotenv==${DOTENV_VERSION} ` +
      `beautifulsoup4==${BS4_VERSION} ` +
      `markdown-it-py==${MARKDOWN_IT_VERSION}`;
      
    console.log(`Running: ${pipCommand}`);
    execSync(pipCommand, { stdio: 'inherit' });
    console.log('Portable Python dependencies installed successfully.');

    console.log('\n--- Setup Portable Python Completed Successfully! ---');
  } catch (err) {
    console.error('Error during portable Python environment setup:', err);
    process.exit(1);
  }
}

main();
