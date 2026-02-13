use anchor_lang::prelude::*;
use crate::state::{AgentAccount, RegistryConfig};
use crate::errors::RegistryError;

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        init,
        payer = owner,
        space = AgentAccount::SPACE,
        seeds = [AgentAccount::SEED, owner.key().as_ref()],
        bump,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(
        mut,
        seeds = [RegistryConfig::SEED],
        bump = registry.bump,
        constraint = !registry.paused @ RegistryError::Paused,
    )]
    pub registry: Account<'info, RegistryConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterAgent>,
    name: String,
    description: String,
    image_uri: String,
    metadata_uri: String,
    skills: Vec<String>,
    service_url: String,
) -> Result<()> {
    // Validate inputs
    require!(!name.is_empty(), RegistryError::NameEmpty);
    require!(name.len() <= AgentAccount::MAX_NAME_LEN, RegistryError::NameTooLong);
    require!(description.len() <= AgentAccount::MAX_DESC_LEN, RegistryError::DescriptionTooLong);
    require!(image_uri.len() <= AgentAccount::MAX_URI_LEN, RegistryError::UriTooLong);
    require!(metadata_uri.len() <= AgentAccount::MAX_URI_LEN, RegistryError::UriTooLong);
    require!(service_url.len() <= AgentAccount::MAX_URI_LEN, RegistryError::UriTooLong);
    require!(skills.len() <= AgentAccount::MAX_SKILLS, RegistryError::TooManySkills);

    for skill in &skills {
        require!(skill.len() <= AgentAccount::MAX_SKILL_LEN, RegistryError::SkillTooLong);
    }

    let clock = Clock::get()?;
    let agent = &mut ctx.accounts.agent;
    agent.owner = ctx.accounts.owner.key();
    agent.name = name;
    agent.description = description;
    agent.image_uri = image_uri;
    agent.metadata_uri = metadata_uri;
    agent.skills = skills;
    agent.service_url = service_url;
    agent.feedback_count = 0;
    agent.total_score = 0;
    agent.created_at = clock.unix_timestamp;
    agent.updated_at = clock.unix_timestamp;
    agent.bump = ctx.bumps.agent;

    let registry = &mut ctx.accounts.registry;
    registry.agent_count = registry.agent_count.checked_add(1).unwrap();

    msg!("Agent '{}' registered", agent.name);
    Ok(())
}
