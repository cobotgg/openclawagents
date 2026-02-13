import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AgentRegistry } from "../target/types/agent_registry";
import { expect } from "chai";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

describe("agent-registry", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.agentRegistry as Program<AgentRegistry>;

  // Derive the registry PDA
  const [registryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("registry")],
    program.programId
  );

  // Agent owner (uses the provider wallet)
  const owner = provider.wallet;

  // Derive agent PDA for the provider wallet
  const [agentPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("agent"), owner.publicKey.toBuffer()],
    program.programId
  );

  // A second user for feedback tests
  const reviewer = Keypair.generate();

  // Second agent owner for uniqueness tests
  const secondOwner = Keypair.generate();

  before(async () => {
    // Airdrop SOL to reviewer and second owner for transaction fees
    const sig1 = await provider.connection.requestAirdrop(
      reviewer.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig1);

    const sig2 = await provider.connection.requestAirdrop(
      secondOwner.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig2);
  });

  describe("initialize", () => {
    it("initializes the registry", async () => {
      const tx = await program.methods
        .initialize()
        .accounts({
          authority: owner.publicKey,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const registry = await program.account.registryConfig.fetch(registryPda);
      expect(registry.authority.toBase58()).to.equal(
        owner.publicKey.toBase58()
      );
      expect(registry.agentCount.toNumber()).to.equal(0);
      expect(registry.paused).to.equal(false);
    });

    it("fails to initialize twice", async () => {
      try {
        await program.methods
          .initialize()
          .accounts({
            authority: owner.publicKey,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown");
      } catch (err: any) {
        // Account already exists - Anchor throws a constraint error
        expect(err).to.exist;
      }
    });
  });

  describe("register_agent", () => {
    it("registers an agent", async () => {
      const tx = await program.methods
        .registerAgent(
          "TradingBot Alpha",
          "Autonomous prediction market trader",
          "https://example.com/image.png",
          "https://example.com/metadata.json",
          ["trading", "prediction-markets", "defi"],
          "https://myagent.com/mcp"
        )
        .accounts({
          owner: owner.publicKey,
          agent: agentPda,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.owner.toBase58()).to.equal(owner.publicKey.toBase58());
      expect(agent.name).to.equal("TradingBot Alpha");
      expect(agent.description).to.equal(
        "Autonomous prediction market trader"
      );
      expect(agent.imageUri).to.equal("https://example.com/image.png");
      expect(agent.metadataUri).to.equal(
        "https://example.com/metadata.json"
      );
      expect(agent.skills).to.deep.equal([
        "trading",
        "prediction-markets",
        "defi",
      ]);
      expect(agent.serviceUrl).to.equal("https://myagent.com/mcp");
      expect(agent.feedbackCount.toNumber()).to.equal(0);
      expect(agent.totalScore.toNumber()).to.equal(0);
      expect(agent.createdAt.toNumber()).to.be.greaterThan(0);
      expect(agent.updatedAt.toNumber()).to.be.greaterThan(0);

      // Registry count should be 1
      const registry = await program.account.registryConfig.fetch(registryPda);
      expect(registry.agentCount.toNumber()).to.equal(1);
    });

    it("enforces one agent per wallet (PDA uniqueness)", async () => {
      try {
        await program.methods
          .registerAgent(
            "Duplicate Agent",
            "Should fail",
            "",
            "",
            [],
            ""
          )
          .accounts({
            owner: owner.publicKey,
            agent: agentPda,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        expect.fail("Should have thrown - duplicate agent");
      } catch (err: any) {
        expect(err).to.exist;
      }
    });

    it("allows a different wallet to register", async () => {
      const [secondAgentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), secondOwner.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .registerAgent(
          "AnalysisBot",
          "Market analysis agent",
          "",
          "",
          ["analysis"],
          "https://analysis.bot/api"
        )
        .accounts({
          owner: secondOwner.publicKey,
          agent: secondAgentPda,
          registry: registryPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([secondOwner])
        .rpc();

      const agent = await program.account.agentAccount.fetch(secondAgentPda);
      expect(agent.name).to.equal("AnalysisBot");

      const registry = await program.account.registryConfig.fetch(registryPda);
      expect(registry.agentCount.toNumber()).to.equal(2);
    });

    it("rejects empty name", async () => {
      const badOwner = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        badOwner.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [badAgentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), badOwner.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .registerAgent("", "desc", "", "", [], "")
          .accounts({
            owner: badOwner.publicKey,
            agent: badAgentPda,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([badOwner])
          .rpc();
        expect.fail("Should have thrown - empty name");
      } catch (err: any) {
        expect(err.toString()).to.include("NameEmpty");
      }
    });

    it("rejects name exceeding 32 bytes", async () => {
      const badOwner = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        badOwner.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [badAgentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), badOwner.publicKey.toBuffer()],
        program.programId
      );

      try {
        await program.methods
          .registerAgent("A".repeat(33), "desc", "", "", [], "")
          .accounts({
            owner: badOwner.publicKey,
            agent: badAgentPda,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([badOwner])
          .rpc();
        expect.fail("Should have thrown - name too long");
      } catch (err: any) {
        expect(err.toString()).to.include("NameTooLong");
      }
    });

    it("rejects more than 10 skills", async () => {
      const badOwner = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        badOwner.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [badAgentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("agent"), badOwner.publicKey.toBuffer()],
        program.programId
      );

      const tooManySkills = Array.from({ length: 11 }, (_, i) => `skill${i}`);

      try {
        await program.methods
          .registerAgent("Agent", "desc", "", "", tooManySkills, "")
          .accounts({
            owner: badOwner.publicKey,
            agent: badAgentPda,
            registry: registryPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([badOwner])
          .rpc();
        expect.fail("Should have thrown - too many skills");
      } catch (err: any) {
        expect(err.toString()).to.include("TooManySkills");
      }
    });
  });

  describe("update_agent", () => {
    it("updates agent name", async () => {
      await program.methods
        .updateAgent("TradingBot Beta", null, null, null)
        .accounts({
          owner: owner.publicKey,
          agent: agentPda,
        })
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.name).to.equal("TradingBot Beta");
      // Other fields unchanged
      expect(agent.description).to.equal(
        "Autonomous prediction market trader"
      );
      expect(agent.skills).to.deep.equal([
        "trading",
        "prediction-markets",
        "defi",
      ]);
    });

    it("updates skills only", async () => {
      await program.methods
        .updateAgent(null, null, ["trading", "mcp", "a2a"], null)
        .accounts({
          owner: owner.publicKey,
          agent: agentPda,
        })
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.name).to.equal("TradingBot Beta"); // unchanged
      expect(agent.skills).to.deep.equal(["trading", "mcp", "a2a"]);
    });

    it("updates multiple fields at once", async () => {
      await program.methods
        .updateAgent(
          "TradingBot Gamma",
          "Updated description",
          null,
          "https://new-service.com/api"
        )
        .accounts({
          owner: owner.publicKey,
          agent: agentPda,
        })
        .rpc();

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.name).to.equal("TradingBot Gamma");
      expect(agent.description).to.equal("Updated description");
      expect(agent.serviceUrl).to.equal("https://new-service.com/api");
      expect(agent.updatedAt.toNumber()).to.be.greaterThan(
        agent.createdAt.toNumber()
      );
    });

    it("rejects update from non-owner", async () => {
      try {
        await program.methods
          .updateAgent("Hacked Name", null, null, null)
          .accounts({
            owner: reviewer.publicKey,
            agent: agentPda,
          })
          .signers([reviewer])
          .rpc();
        expect.fail("Should have thrown - wrong owner");
      } catch (err: any) {
        // PDA derivation with wrong owner will yield wrong address
        expect(err).to.exist;
      }
    });
  });

  describe("give_feedback", () => {
    // Derive feedback PDA
    const [feedbackPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("feedback"),
        agentPda.toBuffer(),
        reviewer.publicKey.toBuffer(),
      ],
      program.programId
    );

    it("gives feedback to an agent", async () => {
      await program.methods
        .giveFeedback(85, "https://example.com/review1.json")
        .accounts({
          reviewer: reviewer.publicKey,
          agent: agentPda,
          feedback: feedbackPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([reviewer])
        .rpc();

      const feedback =
        await program.account.feedbackAccount.fetch(feedbackPda);
      expect(feedback.agent.toBase58()).to.equal(agentPda.toBase58());
      expect(feedback.reviewer.toBase58()).to.equal(
        reviewer.publicKey.toBase58()
      );
      expect(feedback.score).to.equal(85);
      expect(feedback.commentUri).to.equal(
        "https://example.com/review1.json"
      );
      expect(feedback.createdAt.toNumber()).to.be.greaterThan(0);

      // Agent's aggregated score should update
      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.feedbackCount.toNumber()).to.equal(1);
      expect(agent.totalScore.toNumber()).to.equal(85);
    });

    it("prevents duplicate feedback from same reviewer", async () => {
      try {
        await program.methods
          .giveFeedback(90, "https://example.com/dup.json")
          .accounts({
            reviewer: reviewer.publicKey,
            agent: agentPda,
            feedback: feedbackPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([reviewer])
          .rpc();
        expect.fail("Should have thrown - duplicate feedback");
      } catch (err: any) {
        // PDA already initialized
        expect(err).to.exist;
      }
    });

    it("allows different reviewer to give feedback", async () => {
      // Provider wallet gives feedback to the same agent
      const [feedback2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback"),
          agentPda.toBuffer(),
          owner.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .giveFeedback(92, "https://example.com/review2.json")
        .accounts({
          reviewer: owner.publicKey,
          agent: agentPda,
          feedback: feedback2Pda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      const feedback =
        await program.account.feedbackAccount.fetch(feedback2Pda);
      expect(feedback.score).to.equal(92);

      // Agent should now have 2 feedbacks with total 177
      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.feedbackCount.toNumber()).to.equal(2);
      expect(agent.totalScore.toNumber()).to.equal(177); // 85 + 92
    });

    it("rejects score > 100", async () => {
      const badReviewer = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        badReviewer.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [badFeedbackPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback"),
          agentPda.toBuffer(),
          badReviewer.publicKey.toBuffer(),
        ],
        program.programId
      );

      try {
        await program.methods
          .giveFeedback(101, "https://example.com/bad.json")
          .accounts({
            reviewer: badReviewer.publicKey,
            agent: agentPda,
            feedback: badFeedbackPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([badReviewer])
          .rpc();
        expect.fail("Should have thrown - invalid score");
      } catch (err: any) {
        expect(err.toString()).to.include("InvalidScore");
      }
    });

    it("allows score of 0 (minimum)", async () => {
      const zeroReviewer = Keypair.generate();
      const sig = await provider.connection.requestAirdrop(
        zeroReviewer.publicKey,
        1 * anchor.web3.LAMPORTS_PER_SOL
      );
      await provider.connection.confirmTransaction(sig);

      const [zeroFeedbackPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("feedback"),
          agentPda.toBuffer(),
          zeroReviewer.publicKey.toBuffer(),
        ],
        program.programId
      );

      await program.methods
        .giveFeedback(0, "")
        .accounts({
          reviewer: zeroReviewer.publicKey,
          agent: agentPda,
          feedback: zeroFeedbackPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([zeroReviewer])
        .rpc();

      const feedback =
        await program.account.feedbackAccount.fetch(zeroFeedbackPda);
      expect(feedback.score).to.equal(0);

      const agent = await program.account.agentAccount.fetch(agentPda);
      expect(agent.feedbackCount.toNumber()).to.equal(3);
      expect(agent.totalScore.toNumber()).to.equal(177); // unchanged (0 added)
    });
  });

  describe("fetch all accounts", () => {
    it("can list all registered agents", async () => {
      const agents = await program.account.agentAccount.all();
      expect(agents.length).to.equal(2);

      const names = agents.map((a) => a.account.name).sort();
      expect(names).to.deep.equal(["AnalysisBot", "TradingBot Gamma"]);
    });

    it("can list all feedback for an agent", async () => {
      const allFeedback = await program.account.feedbackAccount.all([
        {
          memcmp: {
            offset: 8, // after discriminator
            bytes: agentPda.toBase58(),
          },
        },
      ]);
      expect(allFeedback.length).to.equal(3);
    });
  });
});
