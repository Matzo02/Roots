# Roots MCP Server

Exposes the user's relationship garden as tools any MCP-capable AI assistant can call (Claude Desktop, Cursor, Codex, Goose, etc.).

The server reads/writes the **same on-disk store** as the Next.js app (`~/.roots/data.json`). Both surfaces talk to the same garden — pluck a plant in the web UI, list it via Claude Desktop, both reflect.

## Tools

| Tool | What it does |
|---|---|
| `list_plants` | List every plant + state, warmth, days-since |
| `get_plant` | Read full detail including talking points and recent messages |
| `tend_plant` | Open the chat thread (water / voice / reply / prune). **Never composes text** — only opens the channel for the user to type |
| `observe_plant` | Re-run Gemini for fresh context + talking points |

## Connect from Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "roots": {
      "command": "npx",
      "args": [
        "tsx",
        "/Users/YOU/Code and stuff/roots/mcp/server.ts"
      ],
      "env": {
        "GEMINI_API_KEY": "your-key-if-using-observe"
      }
    }
  }
}
```

Restart Claude Desktop. You should see a 🔌 icon in the chat composer with `roots` listed.

Try:
- *"list plants that need attention"* → calls `list_plants(state="ready")`
- *"who's been wilting? show me details on the worst one"* → `list_plants(state="wilting")` + `get_plant`
- *"open Anjali's chat — I'll write something myself"* → `tend_plant("Anjali", "water")` opens iMessage/WhatsApp
- *"refresh what's going on with Dad"* → `observe_plant("Dad")`

## Connect from Cursor / Codex

Cursor + Codex both support stdio MCP servers. The exact config path differs but the command is the same:

```
npx tsx /absolute/path/to/roots/mcp/server.ts
```

## Why this exists

Roots' web UI is a daily ritual. The MCP server is the **ambient surface** — when you're talking to your AI assistant about anything else and it nudges you: *"hey, Anjali sent you something 4 days ago — want me to open the chat?"* Your daily AI tool becomes the mom-mode reminder layer. The garden tends itself.
