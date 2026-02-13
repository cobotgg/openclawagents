import { Buffer } from "node:buffer";
import { Connection, PublicKey } from "@solana/web3.js";
import { BorshCoder } from "@coral-xyz/anchor";
import idl from "./idl.json";

const coder = new BorshCoder(idl as any);

export interface AgentData {
  address: string;
  owner: string;
  name: string;
  description: string;
  imageUri: string;
  metadataUri: string;
  skills: string[];
  serviceUrl: string;
  feedbackCount: number;
  totalScore: number;
  averageScore: number | null;
  createdAt: number;
  updatedAt: number;
  bump: number;
}

export interface FeedbackData {
  address: string;
  agent: string;
  reviewer: string;
  score: number;
  commentUri: string;
  createdAt: number;
  bump: number;
}

export interface RegistryData {
  authority: string;
  agentCount: number;
  paused: boolean;
}

function decodeAgent(address: string, data: Buffer): AgentData {
  const decoded: any = coder.accounts.decode("AgentAccount", data);
  const fc = (decoded.feedback_count ?? decoded.feedbackCount);
  const fcNum = typeof fc === "number" ? fc : fc.toNumber();
  const ts = (decoded.total_score ?? decoded.totalScore);
  const tsNum = typeof ts === "number" ? ts : ts.toNumber();
  const ca = (decoded.created_at ?? decoded.createdAt);
  const caNum = typeof ca === "number" ? ca : ca.toNumber();
  const ua = (decoded.updated_at ?? decoded.updatedAt);
  const uaNum = typeof ua === "number" ? ua : ua.toNumber();
  return {
    address,
    owner: decoded.owner.toBase58(),
    name: decoded.name,
    description: decoded.description,
    imageUri: decoded.image_uri ?? decoded.imageUri,
    metadataUri: decoded.metadata_uri ?? decoded.metadataUri,
    skills: decoded.skills,
    serviceUrl: decoded.service_url ?? decoded.serviceUrl,
    feedbackCount: fcNum,
    totalScore: tsNum,
    averageScore: fcNum > 0 ? Math.round((tsNum / fcNum) * 10) / 10 : null,
    createdAt: caNum,
    updatedAt: uaNum,
    bump: decoded.bump,
  };
}

function decodeFeedback(address: string, data: Buffer): FeedbackData {
  const decoded: any = coder.accounts.decode("FeedbackAccount", data);
  const ca = (decoded.created_at ?? decoded.createdAt);
  const caNum = typeof ca === "number" ? ca : ca.toNumber();
  return {
    address,
    agent: decoded.agent.toBase58(),
    reviewer: decoded.reviewer.toBase58(),
    score: decoded.score,
    commentUri: decoded.comment_uri ?? decoded.commentUri,
    createdAt: caNum,
    bump: decoded.bump,
  };
}

export class SolanaReader {
  private connection: Connection;
  private programId: PublicKey;

  constructor(rpcUrl: string, programId: string) {
    this.connection = new Connection(rpcUrl, "confirmed");
    this.programId = new PublicKey(programId);
  }

  getAgentPda(owner: PublicKey): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("agent"), owner.toBuffer()],
      this.programId
    );
    return pda;
  }

  getRegistryPda(): PublicKey {
    const [pda] = PublicKey.findProgramAddressSync(
      [Buffer.from("registry")],
      this.programId
    );
    return pda;
  }

  async getRegistry(): Promise<RegistryData> {
    const pda = this.getRegistryPda();
    const info = await this.connection.getAccountInfo(pda);
    if (!info) throw new Error("Registry not initialized");
    const decoded: any = coder.accounts.decode("RegistryConfig", info.data);
    const ac = (decoded.agent_count ?? decoded.agentCount);
    const acNum = typeof ac === "number" ? ac : ac.toNumber();
    return {
      authority: decoded.authority.toBase58(),
      agentCount: acNum,
      paused: decoded.paused,
    };
  }

  async getAgent(address: string): Promise<AgentData | null> {
    const pubkey = new PublicKey(address);
    const info = await this.connection.getAccountInfo(pubkey);
    if (!info) return null;
    try {
      return decodeAgent(address, info.data);
    } catch {
      return null;
    }
  }

  async getAgentByOwner(owner: string): Promise<AgentData | null> {
    const ownerPk = new PublicKey(owner);
    const pda = this.getAgentPda(ownerPk);
    return this.getAgent(pda.toBase58());
  }

  async getAllAgents(): Promise<AgentData[]> {
    const discriminator = idl.accounts?.find(
      (a: any) => a.name === "AgentAccount"
    )?.discriminator;
    if (!discriminator) throw new Error("AgentAccount discriminator not found");

    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        { memcmp: { offset: 0, bytes: Buffer.from(discriminator).toString("base64"), encoding: "base64" } },
      ],
    });

    return accounts
      .map((a) => {
        try {
          return decodeAgent(a.pubkey.toBase58(), a.account.data);
        } catch {
          return null;
        }
      })
      .filter((a): a is AgentData => a !== null);
  }

  async searchAgents(query?: string, skill?: string): Promise<AgentData[]> {
    const agents = await this.getAllAgents();
    let filtered = agents;

    if (skill) {
      const s = skill.toLowerCase();
      filtered = filtered.filter((a) =>
        a.skills.some((sk) => sk.toLowerCase().includes(s))
      );
    }

    if (query) {
      const q = query.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.description.toLowerCase().includes(q)
      );
    }

    return filtered.sort((a, b) => b.feedbackCount - a.feedbackCount);
  }

  async getFeedbackForAgent(agentAddress: string): Promise<FeedbackData[]> {
    const discriminator = idl.accounts?.find(
      (a: any) => a.name === "FeedbackAccount"
    )?.discriminator;
    if (!discriminator) return [];

    const agentPk = new PublicKey(agentAddress);
    const accounts = await this.connection.getProgramAccounts(this.programId, {
      filters: [
        { memcmp: { offset: 0, bytes: Buffer.from(discriminator).toString("base64"), encoding: "base64" } },
        { memcmp: { offset: 8, bytes: agentPk.toBase58() } },
      ],
    });

    return accounts
      .map((a) => {
        try {
          return decodeFeedback(a.pubkey.toBase58(), a.account.data);
        } catch {
          return null;
        }
      })
      .filter((a): a is FeedbackData => a !== null);
  }

  async getAllSkills(): Promise<{ skill: string; count: number }[]> {
    const agents = await this.getAllAgents();
    const skillMap = new Map<string, number>();
    for (const agent of agents) {
      for (const skill of agent.skills) {
        const normalized = skill.toLowerCase();
        skillMap.set(normalized, (skillMap.get(normalized) || 0) + 1);
      }
    }
    return Array.from(skillMap.entries())
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count);
  }
}
