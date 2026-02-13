import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Keypair } from "@solana/web3.js";

const CONFIG_DIR = path.join(os.homedir(), ".agent-registry");
const WALLET_PATH = path.join(CONFIG_DIR, "wallet.json");
const CONFIG_PATH = path.join(CONFIG_DIR, "config.json");

export interface Config {
  cluster: "devnet" | "mainnet-beta" | "localnet";
  rpcUrl: string;
}

const DEFAULT_CONFIG: Config = {
  cluster: "devnet",
  rpcUrl: "https://api.devnet.solana.com",
};

function ensureConfigDir() {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function getConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
}

export function saveConfig(config: Partial<Config>) {
  ensureConfigDir();
  const current = getConfig();
  const merged = { ...current, ...config };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(merged, null, 2));
}

export function getWallet(): Keypair {
  if (!fs.existsSync(WALLET_PATH)) {
    throw new Error(
      `No wallet found. Run 'agent-registry wallet' to create one.`
    );
  }
  const raw = fs.readFileSync(WALLET_PATH, "utf-8");
  const secret = Uint8Array.from(JSON.parse(raw));
  return Keypair.fromSecretKey(secret);
}

export function createWallet(): Keypair {
  ensureConfigDir();
  if (fs.existsSync(WALLET_PATH)) {
    throw new Error(
      `Wallet already exists at ${WALLET_PATH}. Delete it first to create a new one.`
    );
  }
  const keypair = Keypair.generate();
  fs.writeFileSync(
    WALLET_PATH,
    JSON.stringify(Array.from(keypair.secretKey))
  );
  return keypair;
}

export function walletExists(): boolean {
  return fs.existsSync(WALLET_PATH);
}

export function getWalletPath(): string {
  return WALLET_PATH;
}
