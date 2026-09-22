use std::fmt::Write as FmtWrite;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let skills_dir = manifest_dir.join("../../skills");
    let out_dir = std::env::var("OUT_DIR").expect("OUT_DIR set by Cargo");
    let out_path = Path::new(&out_dir).join("skills_data.rs");

    // Re-run whenever skills content changes.
    println!(
        "cargo:rerun-if-changed={}",
        skills_dir.canonicalize().unwrap_or(skills_dir.clone()).display()
    );

    let mut entries: Vec<_> = fs::read_dir(&skills_dir)
        .expect("skills/ directory must exist")
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name();
            let s = name.to_string_lossy();
            !s.starts_with('_') && !s.starts_with('.') && e.path().is_dir()
        })
        .collect();
    entries.sort_by_key(|e| e.file_name());

    let mut code = String::new();

    writeln!(
        code,
        "struct StaticSkillData {{
    name: &'static str,
    title: &'static str,
    description: &'static str,
    category: &'static str,
    license: Option<&'static str>,
    compatibility: Option<&'static str>,
    content: &'static str,
}}"
    )
    .unwrap();
    writeln!(code).unwrap();
    writeln!(code, "static SKILLS_DATA: &[StaticSkillData] = &[").unwrap();

    for entry in &entries {
        let skill_md = entry.path().join("SKILL.md");
        if !skill_md.exists() {
            continue;
        }

        let raw = fs::read_to_string(&skill_md).unwrap_or_default();
        let (title, description, category, license, compatibility) = parse_frontmatter(&raw);

        writeln!(code, "    StaticSkillData {{").unwrap();
        writeln!(
            code,
            "        name: \"{}\",",
            escape(&entry.file_name().to_string_lossy())
        )
        .unwrap();
        writeln!(code, "        title: \"{}\",", escape(&title)).unwrap();
        writeln!(code, "        description: \"{}\",", escape(&description)).unwrap();
        writeln!(code, "        category: \"{}\",", escape(&category)).unwrap();
        match license {
            Some(l) => writeln!(code, "        license: Some(\"{}\"),", escape(&l)).unwrap(),
            None => writeln!(code, "        license: None,").unwrap(),
        }
        match compatibility {
            Some(c) => writeln!(code, "        compatibility: Some(\"{}\"),", escape(&c)).unwrap(),
            None => writeln!(code, "        compatibility: None,").unwrap(),
        }
        // Embed content directly to avoid include_str! path resolution across include! boundary.
        writeln!(code, "        content: \"{}\",", escape(&raw)).unwrap();
        writeln!(code, "    }},").unwrap();
    }

    writeln!(code, "];").unwrap();

    fs::write(&out_path, code).expect("write skills_data.rs");
}

fn parse_frontmatter(
    content: &str,
) -> (String, String, String, Option<String>, Option<String>) {
    let mut title = String::new();
    let mut description = String::new();
    let mut category = String::new();
    let mut license: Option<String> = None;
    let mut compatibility: Option<String> = None;

    let Some(rest) = content.strip_prefix("---\n").or_else(|| content.strip_prefix("---\r\n")) else {
        return (title, description, category, license, compatibility);
    };
    let end = rest.find("\n---").unwrap_or(rest.len());
    let frontmatter = &rest[..end];

    let mut in_metadata = false;
    for line in frontmatter.lines() {
        // Detect metadata: block (indented children)
        if line == "metadata:" {
            in_metadata = true;
            continue;
        }
        if !line.starts_with(' ') && !line.starts_with('\t') && line.contains(':') {
            in_metadata = false;
        }

        if in_metadata {
            let trimmed = line.trim();
            if let Some(v) = trimmed.strip_prefix("title:") {
                title = unquote(v.trim());
            } else if let Some(v) = trimmed.strip_prefix("category:") {
                category = unquote(v.trim());
            }
        } else if let Some(v) = line.strip_prefix("description:") {
            description = unquote(v.trim());
        } else if let Some(v) = line.strip_prefix("license:") {
            license = Some(unquote(v.trim()));
        } else if let Some(v) = line.strip_prefix("compatibility:") {
            compatibility = Some(unquote(v.trim()));
        }
    }

    (title, description, category, license, compatibility)
}

/// Strip optional surrounding double-quotes from a YAML scalar.
fn unquote(s: &str) -> String {
    if s.len() >= 2 && s.starts_with('"') && s.ends_with('"') {
        s[1..s.len() - 1].to_string()
    } else {
        s.to_string()
    }
}

/// Escape a string for embedding inside a Rust double-quoted string literal.
fn escape(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 16);
    for ch in s.chars() {
        match ch {
            '\\' => out.push_str("\\\\"),
            '"' => out.push_str("\\\""),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if (c as u32) < 0x20 => write!(out, "\\u{{{:04x}}}", c as u32).unwrap(),
            c => out.push(c),
        }
    }
    out
}
