import { Command } from "commander";
import chalk from "chalk";
import { getProgram, getAgentPda } from "../lib/client";
import { getWallet } from "../lib/config";

export function updateCommand(): Command {
  return new Command("update")
    .description("Update your agent details")
    .option("-n, --name <name>", "New name")
    .option("-d, --description <desc>", "New description")
    .option("-s, --skills <skills>", "New comma-separated skills")
    .option("-u, --service-url <url>", "New service URL")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        const { name, description, skills, serviceUrl } = opts;

        if (!name && !description && !skills && !serviceUrl) {
          console.log(
            chalk.yellow(
              "Provide at least one field to update: --name, --description, --skills, --service-url"
            )
          );
          return;
        }

        const skillsArray = skills
          ? skills
              .split(",")
              .map((s: string) => s.trim())
              .filter(Boolean)
          : null;

        const wallet = getWallet();
        const program = getProgram(wallet);
        const agentPda = getAgentPda(wallet.publicKey);

        console.log(chalk.dim("Updating agent on-chain..."));

        const tx = await program.methods
          .updateAgent(
            name || null,
            description || null,
            skillsArray,
            serviceUrl || null
          )
          .accounts({
            owner: wallet.publicKey,
            agent: agentPda,
          })
          .signers([wallet])
          .rpc();

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                status: "updated",
                agentAddress: agentPda.toBase58(),
                tx,
                updated: {
                  ...(name && { name }),
                  ...(description && { description }),
                  ...(skillsArray && { skills: skillsArray }),
                  ...(serviceUrl && { serviceUrl }),
                },
              },
              null,
              2
            )
          );
        } else {
          console.log(chalk.green("\nAgent updated successfully!"));
          if (name) console.log(chalk.bold("Name:"), name);
          if (description)
            console.log(chalk.bold("Description:"), description);
          if (skillsArray)
            console.log(chalk.bold("Skills:"), skillsArray.join(", "));
          if (serviceUrl) console.log(chalk.bold("Service URL:"), serviceUrl);
          console.log(chalk.bold("TX:"), tx);
        }
      } catch (err: any) {
        console.error(chalk.red("Update failed:"), err.message);
      }
    });
}
