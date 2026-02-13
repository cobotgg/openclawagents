use anchor_lang::prelude::*;

pub mod errors;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("5kFt6rNPb88LzwqE7LMQyGeB8jBf24thBKsUuwr5sUYx");

#[program]
pub mod agent_registry {
    use super::*;

    /// Initialize the registry (once, by deployer).
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        instructions::initialize::handler(ctx)
    }

    /// Register a new agent with name, description, skills, and service URL.
    /// One agent per wallet, enforced by PDA seeds.
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        description: String,
        image_uri: String,
        metadata_uri: String,
        skills: Vec<String>,
        service_url: String,
    ) -> Result<()> {
        instructions::register::handler(ctx, name, description, image_uri, metadata_uri, skills, service_url)
    }

    /// Update agent details (owner only). Pass None to keep existing value.
    pub fn update_agent(
        ctx: Context<UpdateAgent>,
        name: Option<String>,
        description: Option<String>,
        skills: Option<Vec<String>>,
        service_url: Option<String>,
    ) -> Result<()> {
        instructions::update::handler(ctx, name, description, skills, service_url)
    }

    /// Give feedback to an agent. One feedback per reviewer per agent.
    pub fn give_feedback(
        ctx: Context<GiveFeedback>,
        score: u8,
        comment_uri: String,
    ) -> Result<()> {
        instructions::feedback::handler(ctx, score, comment_uri)
    }
}
