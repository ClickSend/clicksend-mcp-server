# ClickSend MCP Server

A Model Context Protocol (MCP) server that enables Claude and other AI assistants to send SMS and MMS messages using ClickSend.


## Features

- Send one SMS at a time by setting up the clicksend username and API Key
- Get Price for sending message to contact list
- Search Contacts or Contact Lists and send message to them
- Get SMS Templates, and use that to send message
- Get SMS Stastics for last 30 days

## Requirements

- Node.js >= 18
  - you can use`nvm` (Node Version Manager) to set the right version to run this app


## Configuration

The server requires two environment variables:

- `CLICKSEND_USERNAME`: Your ClickSend username 
- `CLICKSEND_API_KEY`: Your ClickSend API Key

You can find the username and key at https://dashboard.clicksend.com/account/subaccounts once you Sign Up to ClickSend

### Claude Desktop Configuration

To use this server with Claude Desktop, add the following to your configuration file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`

**Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "clicksend": {
      "command": "node",
      "args": [
        "-y",
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
After that, restart Claude Desktop to reload the configuration. 
If connected, you should see clicksend-send-sms when you click on the hammer icon

## Example Interactions with Claude

Here are some natural ways to interact with the server through Claude:

Simple SMS:
```
Send a text message to the number 61411111111 saying "I'm using ClickSend MCP server to sent SMS!"
```

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