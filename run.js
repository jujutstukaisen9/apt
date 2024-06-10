const fetch = require('node-fetch');
const fs = require('fs');
const winston = require('winston');

// Set up logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ timestamp, level, message }) => `${timestamp} - ${level.toUpperCase()} - ${message}`)
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Constants
const API_URL = "https://tplayapi.code-crafters.app/321codecrafters/fetcher.json";
const HMAC_URL = "https://tplayapi.code-crafters.app/321codecrafters/hmac.json";
const RETRIES = 3;

async function fetchApi(url, retries) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      logger.error(`Error fetching API data (attempt ${attempt + 1}/${retries}): ${error.message}`);
      if (attempt < retries - 1) {
        continue;
      } else {
        return null;
      }
    }
  }
}

function generateM3U8(data, hmac) {
  let m3u8Content = `#EXTM3U x-tvg-url="https://raw.githubusercontent.com/mitthu786/tvepg/main/tataplay/epg.xml.gz"\n\n`;

  for (const channel of data.channels) {
    if (channel.clearkeys && channel.clearkeys.length > 0) {
      const clearkey = channel.clearkeys[0].base64;
      const userAgent = channel.manifest_headers['User-Agent'];

      // Use the correct 'hdntl' key
      const cookie = hmac.hmac.hdntl.value;

      m3u8Content += `#EXTINF:-1 tvg-id="${channel.id}" group-title="${channel.genres.join(', ')}", tvg-logo="${channel.logo_url}", ${channel.name}\n`;
      m3u8Content += `#KODIPROP:inputstream.adaptive.license_type=clearkey\n`;
      m3u8Content += `#KODIPROP:inputstream.adaptive.license_key=${JSON.stringify(clearkey)}\n`;
      m3u8Content += `#EXTVLCOPT:http-user-agent=${userAgent}\n`;
      m3u8Content += `#EXTHTTP:{"cookie":"${cookie}"}\n`;
      m3u8Content += `${channel.manifest_url}|cookie:${cookie}\n\n`;
    }
  }

  return m3u8Content;
}

async function main() {
  const fetcherData = await fetchApi(API_URL, RETRIES);
  const hmacData = await fetchApi(HMAC_URL, RETRIES);

  if (fetcherData && hmacData) {
    const m3u8Content = generateM3U8(fetcherData.data, hmacData.data);
    fs.writeFileSync('ts.m3u', m3u8Content);
    logger.info("M3U8 playlist generated and saved to playlist.m3u8");
  } else {
    logger.error("Failed to fetch data from API");
  }
}

main();
