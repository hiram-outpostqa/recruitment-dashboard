const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  clientId: '1000.OBUI55MA3J9TU6ISTMXHI70S5SMYPM',
  clientSecret: '4eb294031cd1f44790edf1b983bcb3f44147a5dafd',
  refreshToken: '1000.c19cc8dd396b6279b1c4ea1393dd7756.8cf4c6e71c15c753562d52f0f3e869a6',
};

let cachedToken = null;
let tokenExpiry = 0;

function httpsPost(hostname, path, body) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(body);
    const req = https.request({
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': data.length }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON from auth')); } });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function httpsGet(hostname, pathStr, token) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname, path: pathStr, method: 'GET',
      headers: { Authorization: 'Zoho-oauthtoken ' + token }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => { try { resolve(JSON.parse(raw)); } catch { reject(new Error('Invalid JSON from API')); } });
    });
    req.on('error', reject);
    req.end();
  });
}

async function getToken() {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const params = new URLSearchParams({
    refresh_token: CONFIG.refreshToken,
    client_id: CONFIG.clientId,
    client_secret: CONFIG.clientSecret,
    grant_type: 'refresh_token'
  });
  const data = await httpsPost('accounts.zoho.com', '/oauth/v2/token', params.toString());
  if (!data.access_token) throw new Error(data.error || 'Token refresh failed');
  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  return cachedToken;
}

async function fetchAllPages(module, token, fields) {
  let page = 1, all = [];
  const fieldParam = fields ? '&fields=' + fields : '';
  while (true) {
    const p = '/recruit/v2/' + module + '?per_page=200&page=' + page + fieldParam;
    const data = await httpsGet('recruit.zoho.com', p, token);
    const records = data.data || [];
    all = all.concat(records);
    if (!data.info || !data.info.more_records) break;
    page++;
  }
  return all;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/') {
    const file = fs.readFileSync(path.join(__dirname, 'dashboard.html'));
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(file);
    return;
  }

  if (url.pathname === '/api/data') {
    try {
      const token = await getToken();
      const [candidates, jobs, interviews, events] = await Promise.all([
        fetchAllPages('Candidates', token, 'id,Full_Name,Candidate_Status,Candidate_Stage,Call_Sumarize,Candidate_Category,Leveling,City,State,Current_Employer,Created_Time,Modified_Time'),
        fetchAllPages('JobOpenings', token, 'id,Job_Opening_Name,Job_Status,Department,Date_Opened'),
        fetchAllPages('Interviews', token, 'id,Interview_Status,Candidate_Name'),
        fetchAllPages('Events', token, 'id,Event_Title,Start_DateTime1,End_DateTime1').catch(() => []),
      ]);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates, jobs, interviews, events }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log('');
  console.log('  Recruitment Dashboard corriendo');
  console.log('  Abre tu navegador en: http://localhost:3000');
  console.log('');
  console.log('  Presiona Ctrl+C para detener el servidor.');
  console.log('');
});
