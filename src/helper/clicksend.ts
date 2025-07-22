import https from "node:https";

const CLICKSEND_USERNAME = process.env.CLICKSEND_USERNAME;
const CLICKSEND_API_KEY = process.env.CLICKSEND_API_KEY
const CLICKSEND_API_HOSTNAME = "rest.clicksend.com";

export async function makeClickSendRequest(method: string, path: string, data = null) {
  return new Promise((resolve, reject) => {

    const sanitizedPath = path.startsWith('/') ? path.substring(1) : path;
    
    const auth = Buffer.from(`${CLICKSEND_USERNAME}:${CLICKSEND_API_KEY}`).toString('base64');
    const options: https.RequestOptions = {
        method: method,
        hostname: CLICKSEND_API_HOSTNAME,
        path: `/${sanitizedPath}`,
        headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
            'User-Agent': 'clicksend-mcp-server/1.0'
        },
    };

    // Create and send the HTTP request
    console.error("Making request: " + JSON.stringify(options));
    const req = https.request(options, (res) => {
      let responseData = "";
      
      res.on("data", (chunk) => {
        responseData += chunk;
      });
      
      res.on("end", () => {
        try {
          const parsedData = JSON.parse(responseData);
          console.error('Response:');
          console.error(responseData);
          if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsedData);
          } else {
            reject(new Error(`API error: ${parsedData.message || responseData}`));
          }
        } catch (e: any) {
          reject(new Error(`Failed to parse response: ${e.message}`));
        }
      });
    });
    
    req.on("error", (error) => {
      reject(error);
    });
    
    if (data && method !== "GET") {
      console.error(data);
      console.error(JSON.stringify(data));
      req.write(JSON.stringify(data));
    }
    
    req.end();
  });
}