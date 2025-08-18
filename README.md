# ClickSend MCP Server

This is the official **ClickSend MCP Server** developed by the ClickSend team. For security reasons do not use unofficial versions of ClickSend MCP.

## Purpose

**ClickSend MCP is designed to extend ClickSend’s messaging capabilities into modern AI ecosystems and platforms** - allowing developers to easily send SMS via ClickSend without needing to write custom code.
 
This accelerates adoption, enables new AI-driven use cases, and positions ClickSend as a future-ready messaging platform in the age of intelligent automation.

## Requirements

- Node.js >= 18
  - you can use`nvm` (Node Version Manager) to set the right version to run this app

## Installation

Download an AI desktop client. An example would be Claude for Desktop which you can download **[here](https://claude.ai/download)**.

## Configuration

The server requires two environment variables:

- `CLICKSEND_USERNAME`: Your ClickSend username 
- `CLICKSEND_API_KEY`: Your ClickSend API Key

You can find the username and key at https://dashboard.clicksend.com/account/subaccounts once you Sign Up to ClickSend.

### Claude Desktop Configuration

- Open Claude for Desktop
- Go to **Settings** from the system's menu bar
- In the settings window, navigate to the **Developer** tab and click **Edit Config**.
  This opens the configuation file located at:

  - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

  - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clicksend": {
      "command": "node",
      "args": [
        "/path/to/repository/build/clicksend-mcp.js"
      ],
      "env": {
        "CLICKSEND_USERNAME": "your clicksend username",
        "CLICKSEND_API_KEY": "your API Key",
      }
    }
  }
}

```
After that, restart Claude Desktop to reload the configuration. If connected, you should see clicksend-send-sms when you click on the hammer icon.

## Example Interactions with Claude

Here are some natural ways to interact with the server through Claude:

Simple SMS:
```
Send a text message to the number 61411111111 saying "I'm using ClickSend MCP server to sent SMS!"
```

## Features

- Send one SMS at a time by setting up the clicksend username and API Key
- Get Price for sending message to contact list
- Search Contacts or Contact Lists and send message to them
- Get SMS Templates, and use that to send message
- View/Retrieve SMS history
- Get SMS Statistics for last 30 days

## Supported APIs

1. `POST /v3/sms/send`
 - **Operation ID:** `send-sms`
 - **Summary:** Send SMS
 - **Description:** Send messages to recipients, either as phone numbers or contacts from a contact list.

2. `POST /v3/sms/price`
 - **Operation ID:** `calculate-sms-price`
 - **Summary:** Calculate SMS Price
 - **Description:** Calculate the price of sending messages based on message type and length.

3. `GET /v3/sms/templates`
 - **Operation ID:** `view-sms-templates`
 - **Summary:** View SMS Templates
 - **Description:** Retrieve SMS templates with filtering options.

4. `GET /v3/sms/history`
 - **Operation ID:** `view-sms-history`
 - **Summary:** View SMS History
 - **Description:** View previously sent SMS with filtering and pagination options.

5. `GET /v3/statistics/sms`
 - **Operation ID:** `view-sms-statistics`
 - **Summary:** View SMS Statistics
 - **Description:** Get SMS statistics for the last 30 days.

6. `GET /v3/search/contacts-lists`
 - **Operation ID:** `view-contact-lists`
 - **Summary:**  View Contact Lists
 - **Description:** Get a list of searched contact lists.

## Important Notes

1. **Phone Number Format**: All phone numbers must be in E.164 format (e.g., +61411111111)
2. **Rate Limits**: Be aware of your ClickSend account's rate limits and pricing
3. **Security**: Keep your ClickSend credentials secure and never commit them to version control

## Troubleshooting

Common error messages and solutions:

1. "Phone number must be in E.164 format"
   - Make sure the phone number starts with "+" and the country code

2. "Invalid credentials"
   - Double-check your CLICKSEND_USERNAME and CLICKSEND_API_KEY. You can copy them from the [ClickSend Dashboard](https://clicksend.com)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Security

Please do not include any sensitive information (like phone numbers or ClickSend credentials) in GitHub issues or pull requests.