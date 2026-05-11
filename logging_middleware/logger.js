const axios = require('axios');

const endpoint = 'http://4.224.186.213/evaluation-service/logs';
let token = process.env.AUTH_TOKEN || '';

function setToken(t) {
  token = t;
}

async function Log(stack, level, pkg, message) {
  const payload = { stack, level, package: pkg, message };
  const now = new Date().toISOString();
  console.log(`[${now}] [${level.toUpperCase()}] [${stack}/${pkg}] ${message}`);

  if (token) {
    try {
      const res = await axios.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      return res.data;
    } catch (e) {
      // silently ignore log api errors so it doesnt break the flow
    }
  }
}

module.exports = { Log, setToken };
