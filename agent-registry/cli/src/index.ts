#!/usr/bin/env node
import { Command } from "commander";
import { walletCommand } from "./commands/wallet";
import { registerCommand } from "./commands/register";
import { updateCommand } from "./commands/update";
import { infoCommand } from "./commands/info";

const program = new Command()
  .name("agent-registry")
  .description("Solana Agent Registry CLI")
  .version("0.1.0");

program.addCommand(walletCommand());
program.addCommand(registerCommand());
program.addCommand(updateCommand());
program.addCommand(infoCommand());

program.parse(process.argv);
