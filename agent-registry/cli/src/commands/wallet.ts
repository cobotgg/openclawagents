import { Command } from "commander";
import chalk from "chalk";
import {
  walletExists,
  createWallet,
  getWallet,
  getWalletPath,
  getConfig,
} from "../lib/config";
import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";

export function walletCommand(): Command {
  const cmd = new Command("wallet").description("Manage your wallet");

  cmd
    .command("create")
    .description("Create a new wallet keypair")
    .action(async () => {
      try {
        const kp = createWallet();
        console.log(chalk.green("Wallet created!"));
        console.log(chalk.bold("Address:"), kp.publicKey.toBase58());
        console.log(chalk.dim(`Saved to ${getWalletPath()}`));
        console.log();
        console.log(
          chalk.yellow("Fund it on devnet:"),
          `solana airdrop 2 ${kp.publicKey.toBase58()} --url devnet`
        );
      } catch (err: any) {
        console.error(chalk.red(err.message));
      }
    });

  cmd
    .command("show")
    .description("Show wallet address and balance")
    .action(async () => {
      if (!walletExists()) {
        console.log(
          chalk.red("No wallet found. Run:"),
          chalk.bold("agent-registry wallet create")
        );
        return;
      }
      try {
        const kp = getWallet();
        const config = getConfig();
        const connection = new Connection(config.rpcUrl, "confirmed");
        const balance = await connection.getBalance(kp.publicKey);

        console.log(chalk.bold("Address:"), kp.publicKey.toBase58());
        console.log(
          chalk.bold("Balance:"),
          `${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
        );
        console.log(chalk.bold("Cluster:"), config.cluster);
        console.log(chalk.bold("RPC:"), config.rpcUrl);
      } catch (err: any) {
        console.error(chalk.red(err.message));
      }
    });

  cmd
    .command("airdrop")
    .description("Request devnet SOL airdrop")
    .argument("[amount]", "Amount of SOL to airdrop", "2")
    .action(async (amount: string) => {
      if (!walletExists()) {
        console.log(
          chalk.red("No wallet found. Run:"),
          chalk.bold("agent-registry wallet create")
        );
        return;
      }
      try {
        const kp = getWallet();
        const config = getConfig();
        if (config.cluster !== "devnet" && config.cluster !== "localnet") {
          console.log(chalk.red("Airdrop only works on devnet/localnet"));
          return;
        }
        const connection = new Connection(config.rpcUrl, "confirmed");
        const sol = parseFloat(amount);
        console.log(
          `Requesting ${sol} SOL airdrop to ${kp.publicKey.toBase58()}...`
        );
        const sig = await connection.requestAirdrop(
          kp.publicKey,
          sol * LAMPORTS_PER_SOL
        );
        await connection.confirmTransaction(sig);
        const balance = await connection.getBalance(kp.publicKey);
        console.log(
          chalk.green("Airdrop successful!"),
          `Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`
        );
      } catch (err: any) {
        console.error(chalk.red("Airdrop failed:"), err.message);
      }
    });

  // Default action when just `wallet` is run
  cmd.action(async () => {
    if (walletExists()) {
      await cmd.commands.find((c) => c.name() === "show")?.parseAsync([]);
    } else {
      await cmd.commands.find((c) => c.name() === "create")?.parseAsync([]);
    }
  });

  return cmd;
}
