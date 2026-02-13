use anchor_lang::prelude::*;
use crate::state::AgentAccount;
use crate::errors::RegistryError;

#[derive(Accounts)]
pub struct UpdateAgent<'info> {
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [AgentAccount::SEED, owner.key().as_ref()],
        bump = agent.bump,
        has_one = owner,
    )]
    pub agent: Account<'info, AgentAccount>,
}

pub fn handler(
    ctx: Context<UpdateAgent>,
    name: Option<String>,
    description: Option<String>,
    skills: Option<Vec<String>>,
    service_url: Option<String>,
) -> Result<()> {
    let agent = &mut ctx.accounts.agent;

    if let Some(n) = name {
        require!(!n.is_empty(), RegistryError::NameEmpty);
        require!(n.len() <= AgentAccount::MAX_NAME_LEN, RegistryError::NameTooLong);
        agent.name = n;
    }

    if let Some(d) = description {
        require!(d.len() <= AgentAccount::MAX_DESC_LEN, RegistryError::DescriptionTooLong);
        agent.description = d;
    }

    if let Some(s) = skills {
        require!(s.len() <= AgentAccount::MAX_SKILLS, RegistryError::TooManySkills);
        for skill in &s {
            require!(skill.len() <= AgentAccount::MAX_SKILL_LEN, RegistryError::SkillTooLong);
        }
        agent.skills = s;
    }

    if let Some(url) = service_url {
        require!(url.len() <= AgentAccount::MAX_URI_LEN, RegistryError::UriTooLong);
        agent.service_url = url;
    }

    let clock = Clock::get()?;
    agent.updated_at = clock.unix_timestamp;

    msg!("Agent '{}' updated", agent.name);
    Ok(())
}
