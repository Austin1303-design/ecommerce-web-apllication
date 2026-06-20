const fs = require('fs');
const path = require('path');
const https = require('https');

const OWNER = 'ilavarasan65-design';
const REPO = 'e_commerce-web-application';
const ROOT_DIR = __dirname;

function apiRequest(apiPath, method, token, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: 'api.github.com',
      path: apiPath,
      method,
      headers: {
        'User-Agent': 'Node-GitHub-Pusher',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            body: data
          });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function getFiles(dir, filesList = []) {
  if (!fs.existsSync(dir)) return filesList;
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const name = path.join(dir, file);
    const stat = fs.statSync(name);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        getFiles(name, filesList);
      }
    } else {
      filesList.push(name);
    }
  }
  return filesList;
}

async function run() {
  const token = process.argv[2];
  if (!token) {
    console.error('\n❌ Error: GitHub Personal Access Token (PAT) is required.');
    console.log('\nUsage:');
    console.log('  node push_to_github.js <your_github_token>\n');
    console.log('To create a token:');
    console.log('  1. Go to GitHub -> Settings -> Developer Settings -> Personal Access Tokens -> Tokens (classic).');
    console.log('  2. Generate a token with "repo" scope selected.\n');
    process.exit(1);
  }

  console.log(`\n=== Scanning files in root and public/ ===`);
  const rootFiles = [
    path.join(ROOT_DIR, 'server.js'),
    path.join(ROOT_DIR, 'package.json'),
    path.join(ROOT_DIR, 'database.json')
  ].filter(f => fs.existsSync(f));

  const publicFiles = getFiles(path.join(ROOT_DIR, 'public'));
  const allFiles = [...rootFiles, ...publicFiles];

  console.log(`Found ${allFiles.length} files to upload.`);

  for (const file of allFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    console.log(`\nUploading: ${relPath}...`);

    try {
      const content = fs.readFileSync(file).toString('base64');
      
      // 1. Check if the file exists on GitHub to obtain its SHA (for replacement matches)
      const getRes = await apiRequest(`/repos/${OWNER}/${REPO}/contents/${relPath}`, 'GET', token);
      let sha = null;
      if (getRes.status === 200 && getRes.body && getRes.body.sha) {
        sha = getRes.body.sha;
        console.log(`  (File exists, SHA matching: ${sha.slice(0, 7)})`);
      }

      // 2. Perform upload
      const payload = {
        message: `feat: add/update ${relPath} for ShopVault Client-Server migration`,
        content
      };
      if (sha) {
        payload.sha = sha;
      }

      const putRes = await apiRequest(`/repos/${OWNER}/${REPO}/contents/${relPath}`, 'PUT', token, payload);
      
      if (putRes.status === 200 || putRes.status === 201) {
        console.log(`  ✔ Uploaded successfully!`);
      } else {
        console.error(`  ❌ Failed (Status: ${putRes.status}):`, putRes.body);
      }
    } catch (err) {
      console.error(`  ❌ Error processing file: ${err.message}`);
    }
  }

  console.log('\n=============================================');
  console.log('🎉 UPLOAD COMPLETE!');
  console.log(`Check your repository: https://github.com/${OWNER}/${REPO}`);
  console.log('=============================================');
}

run();
