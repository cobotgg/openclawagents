import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import { getProgram, getRegistryPda, getAgentPda } from "../lib/client";
import { getWallet } from "../lib/config";
import { SystemProgram } from "@solana/web3.js";

export function registerCommand(): Command {
  return new Command("register")
    .description("Register a new agent on-chain")
    .option("-n, --name <name>", "Agent name (max 32 chars)")
    .option("-d, --description <desc>", "Agent description (max 256 chars)")
    .option("--image <uri>", "Image URI", "")
    .option("--metadata <uri>", "Metadata URI", "")
    .option(
      "-s, --skills <skills>",
      "Comma-separated skills (max 10, each max 64 chars)"
    )
    .option("-u, --service-url <url>", "Service URL (MCP endpoint, API, etc.)")
    .option("--json", "Output as JSON")
    .action(async (opts) => {
      try {
        let { name, description, skills, serviceUrl, image, metadata } = opts;

        // Interactive prompts for missing fields
        if (!name || !description || !skills || !serviceUrl) {
          const answers = await inquirer.prompt(
            [
              !name && {
                type: "input",
                name: "name",
                message: "Agent name:",
                validate: (v: string) =>
                  v.length > 0 && v.length <= 32
                    ? true
                    : "Name must be 1-32 characters",
              },
              !description && {
                type: "input",
                name: "description",
                message: "Description:",
                validate: (v: string) =>
                  v.length <= 256 ? true : "Max 256 characters",
              },
              !skills && {
                type: "input",
                name: "skills",
                message: "Skills (comma-separated):",
                validate: (v: string) => {
                  const s = v
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  if (s.length > 10) return "Max 10 skills";
                  if (s.some((x) => x.length > 64))
                    return "Each skill max 64 chars";
                  return true;
                },
              },
              !serviceUrl && {
                type: "input",
                name: "serviceUrl",
                message: "Service URL:",
                default: "",
              },
            ].filter(Boolean)
          );
          name = name || answers.name;
          description = description || answers.description;
          skills = skills || answers.skills;
          serviceUrl = serviceUrl || answers.serviceUrl || "";
        }

        const skillsArray = skills
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);

        const wallet = getWallet();
        const program = getProgram(wallet);
        const agentPda = getAgentPda(wallet.publicKey);
        const registryPda = getRegistryPda();

        console.log(chalk.dim("Registering agent on-chain..."));

        const tx = await program.methods
          .registerAgent(
            name,
            description,
            image || "",
            metadata || "",
            skillsArray,
            serviceUrl || ""
          )
          .accounts({
            owner: wallet.publicKey,
            agent: agentPda,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([wallet])
          .rpc();

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                status: "registered",
                agentAddress: agentPda.toBase58(),
                owner: wallet.publicKey.toBase58(),
                name,
                skills: skillsArray,
                tx,
              },
              null,
              2
            )
          );
        } else {
          console.log(chalk.green("\nAgent registered successfully!"));
          console.log(chalk.bold("Agent PDA:"), agentPda.toBase58());
          console.log(chalk.bold("Owner:"), wallet.publicKey.toBase58());
          console.log(chalk.bold("Name:"), name);
          console.log(chalk.bold("Skills:"), skillsArray.join(", "));
          console.log(chalk.bold("TX:"), tx);
        }
      } catch (err: any) {
        if (err.message?.includes("already in use")) {
          console.error(
            chalk.red(
              "This wallet already has a registered agent. Use 'update' to modify it."
            )
          );
        } else {
          console.error(chalk.red("Registration failed:"), err.message);
        }
      }
    });
}
