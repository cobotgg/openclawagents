import { AgentData } from "./solana";

export interface AgentCard {
  name: string;
  description: string;
  version: string;
  url?: string;
  skills: {
    id: string;
    name: string;
    tags: string[];
  }[];
  supported_interfaces: {
    url: string;
    protocol: string;
  }[];
  solana: {
    agent_address: string;
    owner: string;
    program_id: string;
    feedback_count: number;
    avg_score: number | null;
  };
  image_uri?: string;
  metadata_uri?: string;
}

export function buildAgentCard(
  agent: AgentData,
  programId: string
): AgentCard {
  return {
    name: agent.name,
    description: agent.description,
    version: "1.0.0",
    url: agent.serviceUrl || undefined,
    skills: agent.skills.map((s) => ({
      id: s.toLowerCase().replace(/\s+/g, "-"),
      name: s,
      tags: [s.toLowerCase()],
    })),
    supported_interfaces: agent.serviceUrl
      ? [
          {
            url: agent.serviceUrl,
            protocol: agent.serviceUrl.includes("/mcp") ? "mcp" : "http",
          },
        ]
      : [],
    solana: {
      agent_address: agent.address,
      owner: agent.owner,
      program_id: programId,
      feedback_count: agent.feedbackCount,
      avg_score: agent.averageScore,
    },
    image_uri: agent.imageUri || undefined,
    metadata_uri: agent.metadataUri || undefined,
  };
}
