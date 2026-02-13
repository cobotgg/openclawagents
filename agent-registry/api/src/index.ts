import { Hono } from "hono";
import { cors } from "hono/cors";
import { cache } from "hono/cache";
import { SolanaReader } from "./solana";
import { buildAgentCard } from "./agent-card";

type Bindings = {
  SOLANA_RPC_URL: string;
  PROGRAM_ID: string;
};

const app = new Hono<{ Bindings: Bindings }>();

app.use("/*", cors());

function getReader(c: any): SolanaReader {
  return new SolanaReader(c.env.SOLANA_RPC_URL, c.env.PROGRAM_ID);
}

// Health check
app.get("/health", (c) => {
  return c.json({
    status: "ok",
    program: c.env.PROGRAM_ID,
    rpc: c.env.SOLANA_RPC_URL,
  });
});

// Registry stats
app.get("/registry", async (c) => {
  const reader = getReader(c);
  const registry = await reader.getRegistry();
  return c.json(registry);
});

// List/search agents
app.get("/agents", async (c) => {
  const reader = getReader(c);
  const query = c.req.query("q");
  const skill = c.req.query("skill");
  const agents = await reader.searchAgents(query, skill);
  return c.json({
    count: agents.length,
    agents,
  });
});

// Get agent by address (PDA or owner)
app.get("/agents/:address", async (c) => {
  const reader = getReader(c);
  const address = c.req.param("address");

  // Try as direct agent PDA first
  let agent = await reader.getAgent(address);
  if (!agent) {
    // Try as owner address
    agent = await reader.getAgentByOwner(address);
  }

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  return c.json(agent);
});

// A2A Agent Card format
app.get("/agents/:address/card.json", async (c) => {
  const reader = getReader(c);
  const address = c.req.param("address");

  let agent = await reader.getAgent(address);
  if (!agent) {
    agent = await reader.getAgentByOwner(address);
  }

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const card = buildAgentCard(agent, c.env.PROGRAM_ID);
  return c.json(card);
});

// Get feedback for an agent
app.get("/agents/:address/feedback", async (c) => {
  const reader = getReader(c);
  const address = c.req.param("address");

  let agent = await reader.getAgent(address);
  if (!agent) {
    agent = await reader.getAgentByOwner(address);
  }

  if (!agent) {
    return c.json({ error: "Agent not found" }, 404);
  }

  const feedback = await reader.getFeedbackForAgent(agent.address);
  return c.json({
    agent: agent.address,
    count: feedback.length,
    averageScore: agent.averageScore,
    feedback,
  });
});

// List all known skills
app.get("/skills", async (c) => {
  const reader = getReader(c);
  const skills = await reader.getAllSkills();
  return c.json({ skills });
});

export default app;
