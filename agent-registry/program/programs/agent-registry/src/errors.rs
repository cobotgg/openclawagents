use anchor_lang::prelude::*;

#[error_code]
pub enum RegistryError {
    #[msg("Registry is paused")]
    Paused,
    #[msg("Name too long (max 32 bytes)")]
    NameTooLong,
    #[msg("Description too long (max 256 bytes)")]
    DescriptionTooLong,
    #[msg("URI too long (max 200 bytes)")]
    UriTooLong,
    #[msg("Too many skills (max 10)")]
    TooManySkills,
    #[msg("Skill name too long (max 64 bytes)")]
    SkillTooLong,
    #[msg("Score must be 0-100")]
    InvalidScore,
    #[msg("Name cannot be empty")]
    NameEmpty,
}
