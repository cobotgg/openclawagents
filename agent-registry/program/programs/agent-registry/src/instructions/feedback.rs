use anchor_lang::prelude::*;
use crate::state::{AgentAccount, FeedbackAccount};
use crate::errors::RegistryError;

#[derive(Accounts)]
pub struct GiveFeedback<'info> {
    #[account(mut)]
    pub reviewer: Signer<'info>,

    #[account(
        mut,
        seeds = [AgentAccount::SEED, agent.owner.as_ref()],
        bump = agent.bump,
    )]
    pub agent: Account<'info, AgentAccount>,

    #[account(
        init,
        payer = reviewer,
        space = FeedbackAccount::SPACE,
        seeds = [FeedbackAccount::SEED, agent.key().as_ref(), reviewer.key().as_ref()],
        bump,
    )]
    pub feedback: Account<'info, FeedbackAccount>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<GiveFeedback>,
    score: u8,
    comment_uri: String,
) -> Result<()> {
    require!(score <= 100, RegistryError::InvalidScore);
    require!(comment_uri.len() <= AgentAccount::MAX_URI_LEN, RegistryError::UriTooLong);

    let clock = Clock::get()?;

    let feedback = &mut ctx.accounts.feedback;
    feedback.agent = ctx.accounts.agent.key();
    feedback.reviewer = ctx.accounts.reviewer.key();
    feedback.score = score;
    feedback.comment_uri = comment_uri;
    feedback.created_at = clock.unix_timestamp;
    feedback.bump = ctx.bumps.feedback;

    // Update agent's aggregated score
    let agent = &mut ctx.accounts.agent;
    agent.feedback_count = agent.feedback_count.checked_add(1).unwrap();
    agent.total_score = agent.total_score.checked_add(score as u64).unwrap();

    msg!("Feedback (score={}) given to agent '{}'", score, agent.name);
    Ok(())
}
