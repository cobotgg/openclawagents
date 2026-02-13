import { Command } from "commander";
import chalk from "chalk";
import { getProgram, getAgentPda, PROGRAM_ID } from "../lib/client";
import { PublicKey } from "@solana/web3.js";

export function infoCommand(): Command {
  return new Command("info")
    .description("View agent info")
    .argument(
      "[address]",
      "Agent PDA address or owner wallet address. If omitted, shows your agent."
    )
    .option("--json", "Output as JSON")
    .action(async (address: string | undefined, opts) => {
      try {
        const program = getProgram();

        let agentPda: PublicKey;

        if (!address) {
          // Show the caller's own agent
          const { getWallet } = await import("../lib/config");
          const wallet = getWallet();
          agentPda = getAgentPda(wallet.publicKey);
        } else {
          const pubkey = new PublicKey(address);
          // Check if it's an agent PDA directly or an owner address
          try {
            const account = await (program.account as any)["agentAccount"].fetch(pubkey);
            agentPda = pubkey; // It's already an agent PDA
          } catch {
            // Assume it's an owner address, derive PDA
            agentPda = getAgentPda(pubkey);
          }
        }

        const agent = await (program.account as any)["agentAccount"].fetch(agentPda);
        const avgScore =
          agent.feedbackCount.toNumber() > 0
            ? (
                agent.totalScore.toNumber() / agent.feedbackCount.toNumber()
              ).toFixed(1)
            : "N/A";

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                address: agentPda.toBase58(),
                owner: agent.owner.toBase58(),
                name: agent.name,
                description: agent.description,
                imageUri: agent.imageUri,
                metadataUri: agent.metadataUri,
                skills: agent.skills,
                serviceUrl: agent.serviceUrl,
                feedbackCount: agent.feedbackCount.toNumber(),
                totalScore: agent.totalScore.toNumber(),
                averageScore: avgScore === "N/A" ? null : parseFloat(avgScore),
                createdAt: agent.createdAt.toNumber(),
                updatedAt: agent.updatedAt.toNumber(),
              },
              null,
              2
            )
          );
        } else {
          console.log(chalk.bold.underline(`\n${agent.name}`));
          console.log(chalk.dim(agent.description));
          console.log();
          console.log(chalk.bold("Agent PDA:"), agentPda.toBase58());
          console.log(chalk.bold("Owner:"), agent.owner.toBase58());
          if (agent.imageUri)
            console.log(chalk.bold("Image:"), agent.imageUri);
          if (agent.metadataUri)
            console.log(chalk.bold("Metadata:"), agent.metadataUri);
          console.log(
            chalk.bold("Skills:"),
            agent.skills.length > 0 ? agent.skills.join(", ") : "none"
          );
          if (agent.serviceUrl)
            console.log(chalk.bold("Service URL:"), agent.serviceUrl);
          console.log(
            chalk.bold("Feedback:"),
            `${agent.feedbackCount.toNumber()} reviews, avg score: ${avgScore}`
          );
          console.log(
            chalk.bold("Registered:"),
            new Date(agent.createdAt.toNumber() * 1000).toISOString()
          );
          console.log(
            chalk.bold("Updated:"),
            new Date(agent.updatedAt.toNumber() * 1000).toISOString()
          );
        }
      } catch (err: any) {
        if (err.message?.includes("Account does not exist")) {
          console.log(chalk.yellow("No agent found at that address."));
        } else {
          console.error(chalk.red("Error:"), err.message);
        }
      }
    });
}
