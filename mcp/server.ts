#!/usr/bin/env node
/**
 * Roots MCP Server
 *
 * Exposes the user's relationship garden as tools any MCP-capable AI
 * assistant can call (Claude Desktop, Cursor, Codex, etc.).
 *
 * Tools:
 *   - list_plants:   List all contacts in the garden + their states
 *   - get_plant:     Read full detail for one plant including talking points
 *   - tend_plant:    Open the chat thread for a plant (water/voice/reply/prune)
 *                    — never composes a message, only opens the channel
 *   - observe_plant: Re-run the agent to refresh context + talking points
 *
 * Run with stdio (default) so it pipes into Claude Desktop's mcpServers config:
 *
 *   "roots": {
 *     "command": "npx",
 *     "args": ["tsx", "/absolute/path/to/roots/mcp/server.ts"]
 *   }
 *
 * The server reads the same on-disk store as the Next.js app
 * (~/.roots/data.json). Both surfaces are talking to the same garden.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { observePlant } from "../lib/agent.js";
import { isMacOS, openImessageConversation } from "../lib/imessage-send.js";
import {
  getChatForPlant,
  readStore,
  updatePlants,
  updatePlayer,
} from "../lib/storage.js";
import type { Action } from "../lib/types.js";
import { computeSignals } from "../lib/whatsapp-parser.js";

const server = new Server(
  { name: "roots", version: "0.1.0" },
  { capabilities: { tools: {} } },
);

const XP: Record<Action, number> = { water: 15, voice: 30, reply: 25, prune: 5 };
const ENERGY: Record<Action, number> = {
  water: 1,
  voice: 2,
  reply: 1,
  prune: 0,
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "list_plants",
      description:
        "List every person in the user's relationship garden with their current state (sapling | healthy | mature | wilting | ready | dying), warmth (0-100), and days since last message. Use this when the user asks who needs attention or who they should reach out to.",
      inputSchema: {
        type: "object",
        properties: {
          state: {
            type: "string",
            enum: [
              "sapling",
              "healthy",
              "mature",
              "wilting",
              "ready",
              "dying",
            ],
            description: "Optional: filter to a specific state.",
          },
        },
      },
    },
    {
      name: "get_plant",
      description:
        "Get full detail for one plant including the agent's observation, talking points (concrete things to react to — NOT message drafts), and recent inbound messages. Use when the user wants to understand why a particular relationship needs attention.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            description: "Plant's name (case-insensitive partial match).",
          },
        },
      },
    },
    {
      name: "tend_plant",
      description:
        "Open the chat thread for a plant in the user's actual messaging app (WhatsApp / Messages / Phone) so they can compose their own message. NEVER use this to send pre-written text — Roots' core principle is that the user always brings the words. Logs the gameplay outcome (XP, warmth, state change). Available actions: water (quick check-in), voice (voice note), reply (respond to their post — only if state=ready), prune (mark relationship cooled, no chat opened).",
      inputSchema: {
        type: "object",
        required: ["name", "action"],
        properties: {
          name: { type: "string", description: "Plant's name." },
          action: {
            type: "string",
            enum: ["water", "voice", "reply", "prune"],
          },
        },
      },
    },
    {
      name: "observe_plant",
      description:
        "Re-run the agent for a plant — refreshes context line and talking points using the latest cached chat history. Use when the user wants a fresh take on a relationship.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: { name: { type: "string" } },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const a = args as Record<string, string | undefined>;

  if (name === "list_plants") {
    const store = await readStore();
    const filtered = a.state
      ? store.plants.filter((p) => p.state === a.state)
      : store.plants;
    if (filtered.length === 0) {
      return {
        content: [
          {
            type: "text",
            text:
              "Garden is empty. Drop a WhatsApp .txt or import an iMessage contact to plant the first one.",
          },
        ],
      };
    }
    const lines = filtered.map(
      (p) =>
        `• ${p.name} — ${p.state.toUpperCase()}, warmth ${p.warmth}/100, ${p.daysSinceLastMessage}d since last message · ${p.context}`,
    );
    return {
      content: [
        {
          type: "text",
          text: `${filtered.length} plant(s):\n${lines.join("\n")}`,
        },
      ],
    };
  }

  if (name === "get_plant") {
    if (!a.name) throw new Error("get_plant: missing 'name'");
    const store = await readStore();
    const plant = store.plants.find((p) =>
      p.name.toLowerCase().includes(a.name!.toLowerCase()),
    );
    if (!plant) {
      return {
        content: [
          { type: "text", text: `No plant matching "${a.name}".` },
        ],
      };
    }
    const chat = await getChatForPlant(plant.id);
    const recent = chat?.messages.slice(-5) ?? [];
    const recentBlock = recent
      .map(
        (m) =>
          `  ${new Date(m.at).toISOString().slice(0, 16)} ${m.fromMe ? "→ you" : "← " + plant.name}: ${m.text.slice(0, 100)}`,
      )
      .join("\n");

    const points = plant.talkingPoints?.length
      ? plant.talkingPoints.map((p) => `  • ${p}`).join("\n")
      : "  (none — agent hasn't observed yet)";

    return {
      content: [
        {
          type: "text",
          text: [
            `${plant.name} — ${plant.state.toUpperCase()}, warmth ${plant.warmth}/100`,
            plant.handle ? `Handle: ${plant.handle}` : "",
            `Channel: ${plant.channel}`,
            `Days since last: ${plant.daysSinceLastMessage}, last from: ${plant.lastMessageWasFromThem ? plant.name : "you"}`,
            ``,
            `Context: ${plant.context}`,
            ``,
            `Talking points (angles, NOT message drafts):`,
            points,
            ``,
            `Recent messages:`,
            recentBlock || "  (no chat history loaded)",
          ]
            .filter(Boolean)
            .join("\n"),
        },
      ],
    };
  }

  if (name === "tend_plant") {
    if (!a.name || !a.action) {
      throw new Error("tend_plant: requires 'name' and 'action'");
    }
    const action = a.action as Action;
    if (!["water", "voice", "reply", "prune"].includes(action)) {
      throw new Error(`Invalid action: ${action}`);
    }

    const store = await readStore();
    const plant = store.plants.find((p) =>
      p.name.toLowerCase().includes(a.name!.toLowerCase()),
    );
    if (!plant) {
      return {
        content: [{ type: "text", text: `No plant matching "${a.name}".` }],
      };
    }

    if (action === "reply" && plant.state !== "ready") {
      return {
        content: [
          {
            type: "text",
            text: `${plant.name} isn't in 'ready' state — there's no recent post to reply to. Try 'water' instead.`,
          },
        ],
      };
    }

    // Open the chat thread (no text — user types their own)
    let opened = false;
    if (action !== "prune" && plant.channel === "imessage" && plant.phone) {
      if (isMacOS()) {
        try {
          await openImessageConversation("+" + plant.phone);
          opened = true;
        } catch (err) {
          console.error("[mcp] iMessage open failed:", err);
        }
      }
    }
    // For WhatsApp/call channels, the human user clicks the wa.me/tel link
    // in the web UI. Via MCP we just record the action.

    // Update plant + player state
    await updatePlants((all) =>
      all.map((p) => {
        if (p.id !== plant.id) return p;
        if (action === "prune")
          return { ...p, state: "dying", warmth: Math.max(0, p.warmth - 20) };
        if (action === "reply")
          return {
            ...p,
            state: "mature",
            warmth: Math.min(100, p.warmth + 18),
            daysSinceLastMessage: 0,
            lastMessageWasFromThem: false,
          };
        if (action === "voice")
          return {
            ...p,
            state: "mature",
            warmth: Math.min(100, p.warmth + 22),
            daysSinceLastMessage: 0,
          };
        return {
          ...p,
          state: p.warmth + 10 > 60 ? "healthy" : "wilting",
          warmth: Math.min(100, p.warmth + 10),
          daysSinceLastMessage: 0,
        };
      }),
    );

    await updatePlayer((p) => {
      let xp = p.xp + XP[action];
      let level = p.level;
      let xpToNext = p.xpToNext;
      while (xp >= xpToNext) {
        xp -= xpToNext;
        level += 1;
        xpToNext = Math.round(xpToNext * 1.4);
      }
      return {
        ...p,
        xp,
        level,
        xpToNext,
        energy: Math.max(0, p.energy - ENERGY[action]),
      };
    });

    const verb =
      action === "water"
        ? "Opened chat with"
        : action === "voice"
          ? "Opened chat for voice note —"
          : action === "prune"
            ? "Marked as cooled —"
            : "Opened chat to reply to";
    const tail =
      action === "prune"
        ? "no message sent."
        : opened
          ? `${plant.channel} thread is open. Type your own message — Roots never drafts for you.`
          : `Open ${plant.channel === "whatsapp" ? "https://wa.me/" + plant.phone : plant.channel === "call" ? "tel:+" + plant.phone : "Messages"} on your machine to continue. The user types their own message.`;

    return {
      content: [
        {
          type: "text",
          text: `${verb} ${plant.name}. +${XP[action]} XP. ${tail}`,
        },
      ],
    };
  }

  if (name === "observe_plant") {
    if (!a.name) throw new Error("observe_plant: missing 'name'");
    const store = await readStore();
    const plant = store.plants.find((p) =>
      p.name.toLowerCase().includes(a.name!.toLowerCase()),
    );
    if (!plant) {
      return {
        content: [{ type: "text", text: `No plant matching "${a.name}".` }],
      };
    }
    const chat = await getChatForPlant(plant.id);
    if (!chat) {
      return {
        content: [
          {
            type: "text",
            text: "No cached chat history for this plant — re-import to refresh signals.",
          },
        ],
      };
    }
    const signals = computeSignals(chat);
    let observation;
    try {
      observation = await observePlant({
        contactName: plant.name,
        signals,
        recentMessages: chat.messages,
      });
    } catch (err) {
      return {
        content: [
          {
            type: "text",
            text: `Agent call failed: ${(err as Error).message}. Is GEMINI_API_KEY set?`,
          },
        ],
      };
    }

    await updatePlants((all) =>
      all.map((p) =>
        p.id === plant.id
          ? {
              ...p,
              context: observation.context,
              talkingPoints: observation.talkingPoints,
            }
          : p,
      ),
    );

    return {
      content: [
        {
          type: "text",
          text: [
            `Refreshed observation for ${plant.name}:`,
            ``,
            `Context: ${observation.context}`,
            ``,
            `Talking points:`,
            ...observation.talkingPoints.map((tp) => `  • ${tp}`),
          ].join("\n"),
        },
      ],
    };
  }

  throw new Error(`Unknown tool: ${name}`);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("roots MCP server ready (stdio)");
}

main().catch((err) => {
  console.error("[roots-mcp] fatal:", err);
  process.exit(1);
});
