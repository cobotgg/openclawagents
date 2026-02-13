use anchor_lang::prelude::*;

/// Global registry configuration (singleton).
/// Seeds: ["registry"]
#[account]
pub struct RegistryConfig {
    pub authority: Pubkey,
    pub agent_count: u64,
    pub paused: bool,
    pub bump: u8,
}

impl RegistryConfig {
    pub const SEED: &'static [u8] = b"registry";
    pub const SPACE: usize = 8 + 32 + 8 + 1 + 1;
}

/// Agent identity stored on-chain.
/// Seeds: ["agent", owner.key()]
#[account]
pub struct AgentAccount {
    pub owner: Pubkey,
    pub name: String,
    pub description: String,
    pub image_uri: String,
    pub metadata_uri: String,
    pub skills: Vec<String>,
    pub service_url: String,
    pub feedback_count: u64,
    pub total_score: u64,
    pub created_at: i64,
    pub updated_at: i64,
    pub bump: u8,
}

impl AgentAccount {
    pub const SEED: &'static [u8] = b"agent";
    pub const MAX_NAME_LEN: usize = 32;
    pub const MAX_DESC_LEN: usize = 256;
    pub const MAX_URI_LEN: usize = 200;
    pub const MAX_SKILL_LEN: usize = 64;
    pub const MAX_SKILLS: usize = 10;
    pub const SPACE: usize = 2048;
}

/// Feedback left by a reviewer for an agent.
/// Seeds: ["feedback", agent_pda.key(), reviewer.key()]
#[account]
pub struct FeedbackAccount {
    pub agent: Pubkey,
    pub reviewer: Pubkey,
    pub score: u8,
    pub comment_uri: String,
    pub created_at: i64,
    pub bump: u8,
}

impl FeedbackAccount {
    pub const SEED: &'static [u8] = b"feedback";
    pub const SPACE: usize = 300;
}
