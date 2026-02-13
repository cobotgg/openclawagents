import * as anchor from "@coral-xyz/anchor";
import { Program, AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import { getConfig, getWallet } from "./config";

// Program ID from the deployed program
const PROGRAM_ID = new PublicKey(
  "5kFt6rNPb88LzwqE7LMQyGeB8jBf24thBKsUuwr5sUYx"
);

function loadIdl(): any {
  const idlPath = path.resolve(
    __dirname,
    "../../../program/target/idl/agent_registry.json"
  );
  return JSON.parse(fs.readFileSync(idlPath, "utf-8"));
}

export function getProvider(wallet?: Keypair): AnchorProvider {
  const config = getConfig();
  const connection = new Connection(config.rpcUrl, "confirmed");
  const kp = wallet || getWallet();
  const w = new Wallet(kp);
  return new AnchorProvider(connection, w, {
    commitment: "confirmed",
  });
}

export function getProgram(wallet?: Keypair): Program {
  const provider = getProvider(wallet);
  const idl = loadIdl();
  return new Program(idl, provider);
}

export function getRegistryPda(): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    PROGRAM_ID
  );
  return pda;
}

export function getAgentPda(owner: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export function getFeedbackPda(
  agent: PublicKey,
  reviewer: PublicKey
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("feedback"), agent.toBuffer(), reviewer.toBuffer()],
    PROGRAM_ID
  );
  return pda;
}

export { PROGRAM_ID };
