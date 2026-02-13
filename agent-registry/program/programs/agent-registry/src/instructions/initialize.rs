use anchor_lang::prelude::*;
use crate::state::RegistryConfig;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = RegistryConfig::SPACE,
        seeds = [RegistryConfig::SEED],
        bump,
    )]
    pub registry: Account<'info, RegistryConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Initialize>) -> Result<()> {
    let registry = &mut ctx.accounts.registry;
    registry.authority = ctx.accounts.authority.key();
    registry.agent_count = 0;
    registry.paused = false;
    registry.bump = ctx.bumps.registry;

    msg!("Agent Registry initialized");
    Ok(())
}
