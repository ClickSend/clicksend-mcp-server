#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Load environment variables from server configuration on client
const env = process.env;
if (!env.CLICKSEND_USERNAME || !env.CLICKSEND_API_KEY) {
  console.error("Please set CLICKSEND_USERNAME and CLICKSEND_API_KEY in your .env file.");
  process.exit(1); //not sure if process.exit is the right thing to do here
}

// set environment variables from the server configuration on client 
//TODO: Ideally, want to use SDK instead of using API Endpoint directly
const BASE_URL = "https://rest.clicksend.com/v3/sms/send";
const CLICK_SEND_USERNAME = env.CLICK_SEND_USERNAME;  
const CLICK_SEND_API_KEY = env.CLICK_SEND_API_KEY;

// Create MCP server
const server = new McpServer({
    name: "clicksend",
    version: "1.0.0",
});

//model to format request parameters
interface LocalSmsMessage {
  source: string;
  body: string;
  to: string;
  from?: string;
}

// Function to send SMS using ClickSend API
async function sendSms(message: LocalSmsMessage) {
  const url = BASE_URL;
  const auth = Buffer.from(`${CLICK_SEND_USERNAME}:${CLICK_SEND_API_KEY}`).toString('base64');

  const payload = {
    messages: [
      {
        source: message.source,
        body: message.body,
        to: message.to,
        from: message.from,
      },
    ],
  };

  try {
    //actual call to the ClickSend API
    // Note: The ClickSend API may require additional headers or parameters
    const response = await axios.post(url, payload, {
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });

    console.log('SMS sent:', response.data);
  } catch (error: any) {
    //raise error but not sure if this will actuall be logged on the client side, to be seen
    console.error('Failed to send SMS:', error.response?.data || error.message);
  }
}
''
//Register Send SMS tool, this is the pre-set command that will be used to send the SMS via LLM Client
server.tool(
  "clicksend-send-sms",
  "Send SMS using Clicksend",
  {
    number: z.string().describe("number to send sms to"),
    message: z.string().describe("message to send"),
  },
  async ({ number, message }) => {
    const smsMessage: LocalSmsMessage = {
      source: "clicksend",
      body: message,
      to: number,
    };

    try {
      await sendSms(smsMessage);
      return {
        content: [
          {
            type: "text",
            text: `SMS sent to ${number}: ${message}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Failed to send SMS: ${error instanceof Error ? error.message : "Unknown error"}`,
          },
        ],
      };
    }
  }, 
);

//implement main function to start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ClickSend server started");
}


main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});