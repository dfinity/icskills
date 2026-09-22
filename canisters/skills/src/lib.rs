use candid::CandidType;

// Generated at compile time from skills/*/SKILL.md by build.rs.
include!(concat!(env!("OUT_DIR"), "/skills_data.rs"));

#[derive(CandidType, Clone)]
struct SkillSummary {
    name: String,
    title: String,
    description: String,
    category: String,
}

#[derive(CandidType, Clone)]
struct SkillDetail {
    name: String,
    title: String,
    description: String,
    category: String,
    content: String,
    license: Option<String>,
    compatibility: Option<String>,
}

/// List all skills with their names, titles, descriptions, and categories.
#[ic_cdk::query]
fn list_skills() -> Vec<SkillSummary> {
    SKILLS_DATA
        .iter()
        .map(|s| SkillSummary {
            name: s.name.to_string(),
            title: s.title.to_string(),
            description: s.description.to_string(),
            category: s.category.to_string(),
        })
        .collect()
}

/// Get the full documentation for a skill by its name (e.g. "motoko", "ckbtc").
/// Returns `null` if the skill is not found.
#[ic_cdk::query]
fn get_skill(name: String) -> Option<SkillDetail> {
    SKILLS_DATA.iter().find(|s| s.name == name).map(|s| SkillDetail {
        name: s.name.to_string(),
        title: s.title.to_string(),
        description: s.description.to_string(),
        category: s.category.to_string(),
        content: s.content.to_string(),
        license: s.license.map(str::to_string),
        compatibility: s.compatibility.map(str::to_string),
    })
}

/// Search skills by keyword. Matches against name, title, description, and content.
/// Returns summaries of all matching skills.
#[ic_cdk::query]
fn search_skills(query: String) -> Vec<SkillSummary> {
    let q = query.to_lowercase();
    SKILLS_DATA
        .iter()
        .filter(|s| {
            s.name.to_lowercase().contains(&q)
                || s.title.to_lowercase().contains(&q)
                || s.description.to_lowercase().contains(&q)
                || s.content.to_lowercase().contains(&q)
        })
        .map(|s| SkillSummary {
            name: s.name.to_string(),
            title: s.title.to_string(),
            description: s.description.to_string(),
            category: s.category.to_string(),
        })
        .collect()
}
