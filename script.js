// script.js

// Manifest listing all fantasy teams and their JSON files
const TEAM_MANIFEST_URL = "data/teams_index.json";

// Categories used for scoring and display
const CATEGORIES = [
  { key: "goals",      field: "goals",           label: "Goals",          higherIsBetter: true },
  { key: "assists",    field: "assists",         label: "Assists",        higherIsBetter: true },
  { key: "ppPoints",   field: "powerPlayPoints", label: "PP Points",      higherIsBetter: true },
  { key: "hits",       field: "hits",            label: "Hits",           higherIsBetter: true },
  { key: "shots",      field: "shots",           label: "Shots on Goal",  higherIsBetter: true },
  { key: "pim",        field: "penaltyMinutes",  label: "PIM",            higherIsBetter: true },
  { key: "savePct",    field: "avgSavePct",      label: "Save % (avg)",   higherIsBetter: true },
  { key: "gaa",        field: "avgGaa",          label: "GAA (avg)",      higherIsBetter: false }
];

// --- Utility helpers --------------------------------------------------------

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toFloat(value) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

function formatCategoryValue(catKey, rawValue) {
  if (catKey === "savePct") {
    return rawValue ? (rawValue * 100).toFixed(1) + "%" : "—";
  }
  if (catKey === "gaa") {
    return rawValue ? rawValue.toFixed(2) : "—";
  }
  return rawValue.toString();
}

function ordinal(n) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// --- Aggregate stats for a single team -------------------------------------

function computeTeamSummary(teamJson, overrideLabel) {
  const players = teamJson.players || [];

  const skaters = players.filter(
    (p) => p.stats_position_group === "skater" && !p.missing
  );
  const goalies = players.filter(
    (p) => p.stats_position_group === "goalie" && !p.missing
  );

  let goals = 0;
  let assists = 0;
  let powerPlayGoals = 0;
  let powerPlayAssists = 0;
  let hits = 0;
  let shots = 0;
  let penaltyMinutes = 0;

  skaters.forEach((p) => {
    goals += toInt(p.goals);
    assists += toInt(p.assists);
    powerPlayGoals += toInt(p.power_play_goals);
    powerPlayAssists += toInt(p.power_play_assists);
    hits += toInt(p.hits);
    shots += toInt(p.shots);
    penaltyMinutes += toInt(p.penalty_minutes);
  });

  // Team-level goalie averages
  let avgSavePct = 0;
  let avgGaa = 0;

  if (goalies.length > 0) {
    const totalSavePct = goalies.reduce(
      (sum, g) => sum + toFloat(g.save_percentage),
      0
    );
    const totalGaa = goalies.reduce(
      (sum, g) => sum + toFloat(g.goals_against_average),
      0
    );
    avgSavePct = totalSavePct / goalies.length;
    avgGaa = totalGaa / goalies.length;
  }

  const powerPlayPoints = powerPlayGoals + powerPlayAssists;

  return {
    teamName: overrideLabel || teamJson.team_name || "Unnamed Team",
    seasonId: teamJson.season_id,
    players,
    skaters,
    goalies,
    totals: {
      goals,
      assists,
      powerPlayPoints,
      hits,
      shots,
      penaltyMinutes,
      avgSavePct,
      avgGaa,
      fantasyScore: 0 // will be filled in after ranking
    },
    categoryPoints: {}, // e.g. { goals: 8, assists: 6, ... }
    categoryRanks: {}   // e.g. { goals: 2, assists: 4, ... }
  };
}

// --- Category-rank scoring --------------------------------------------------

function applyCategoryRankScoring(summaries) {
  const nTeams = summaries.length;

  // Reset scores
  summaries.forEach((team) => {
    team.categoryPoints = {};
    team.categoryRanks = {};
    team.totals.fantasyScore = 0;
  });

  CATEGORIES.forEach((cat) => {
    const field = cat.field;

    // Sort copy by raw value for this category
    const sorted = [...summaries].sort((a, b) => {
      const av = a.totals[field] ?? 0;
      const bv = b.totals[field] ?? 0;

      if (cat.higherIsBetter) {
        return bv - av; // high → low
      } else {
        return av - bv; // low → high (e.g. GAA)
      }
    });

    // Assign X, X-1, ..., 1 and store rank
    sorted.forEach((team, idx) => {
      const rank = idx + 1;        // 1-based rank
      const points = nTeams - idx; // 1st = X, last = 1

      team.categoryRanks[cat.key] = rank;
      team.categoryPoints[cat.key] = points;
      team.totals.fantasyScore += points;
    });
  });
}

// --- Rendering --------------------------------------------------------------

function renderTeamCard(summary, overallRank, nTeams) {
  const container = document.getElementById("team-cards");
  if (!container) return;

  const t = summary.totals;

  const statChipsHtml = CATEGORIES.map((cat) => {
    const rawValue = t[cat.field] ?? 0;
    const displayValue = formatCategoryValue(cat.key, rawValue);
    const rank = summary.categoryRanks[cat.key];
    const rankText = rank
      ? `${ordinal(rank)} of ${nTeams}`
      : "Unranked";

    // special classes for save% / GAA, otherwise default
    let valueClass = "stat-value";
    if (cat.key === "savePct") {
      valueClass += " stat-value--good";
    } else if (cat.key === "gaa") {
      valueClass += " stat-value--bad";
    }

    return `
      <div class="stat-chip">
        <div class="stat-label">${cat.label}</div>
        <div class="${valueClass}">${displayValue}</div>
        <div class="stat-rank">${rankText}</div>
      </div>
    `;
  }).join("");

  const card = document.createElement("article");
  card.className = "team-card";

  card.innerHTML = `
    <header class="team-card-header">
      <div>
        <div class="team-name">${summary.teamName}</div>
        <div class="team-meta">
          <span class="meta-chip meta-chip--accent">Rank #${overallRank}</span>
          <span class="meta-chip">Season ${summary.seasonId}</span>
          <span class="meta-chip">${summary.skaters.length} skaters</span>
          <span class="meta-chip">${summary.goalies.length} goalies</span>
        </div>
      </div>
      <div class="meta-chip meta-chip--accent">
        Team Score: ${t.fantasyScore.toFixed(1)}
      </div>
    </header>

    <section class="team-card-body">
      ${statChipsHtml}
    </section>

    <footer class="team-card-footer">
      <p class="footer-note">
        Stats pulled from PWHL API; fantasy scoring uses category ranks.
      </p>
      <span class="footer-tag">
        Goals · Assists · PP · Hits · SOG · PIM · SV% · GAA
      </span>
    </footer>
  `;

  container.appendChild(card);
}

function renderRosterTable(summary) {
  const container = document.getElementById("roster-container");
  if (!container) return;

  const players = summary.players.slice().sort((a, b) => {
    const roleOrder = { forward: 1, defence: 2, goalie: 3 };
    const ra = roleOrder[a.fantasy_role] || 99;
    const rb = roleOrder[b.fantasy_role] || 99;
    if (ra !== rb) return ra - rb;
    return (a.matched_name || a.name || a.requested_name || "").localeCompare(
      b.matched_name || b.name || b.requested_name || ""
    );
  });

  const roleLabel = (role) => {
    if (role === "forward") return "F";
    if (role === "defence") return "D";
    if (role === "goalie") return "G";
    return role || "";
  };

  const rowsHtml = players
    .map((p) => {
      const isGoalie = p.stats_position_group === "goalie";
      const name =
        p.matched_name ||
        p.name ||
        p.requested_name ||
        "(unknown player)";
      const role = roleLabel(p.fantasy_role);

      const goals = toInt(p.goals);
      const assists = toInt(p.assists);
      const points = goals + assists;
      const shots = !isGoalie ? toInt(p.shots) : 0;
      const hits = !isGoalie ? toInt(p.hits) : 0;
      const pim = toInt(p.penalty_minutes);

      const sv = isGoalie ? toFloat(p.save_percentage) : 0;
      const gaa = isGoalie ? toFloat(p.goals_against_average) : 0;

      const svDisplay =
        isGoalie && sv ? (sv * 100).toFixed(1) + "%" : "";
      const gaaDisplay = isGoalie && gaa ? gaa.toFixed(2) : "";

      return `
        <tr>
          <td>${name}</td>
          <td class="roster-role">${role}</td>
          <td>${p.games_played || ""}</td>
          <td>${goals || ""}</td>
          <td>${assists || ""}</td>
          <td>${points || ""}</td>
          <td>${shots || ""}</td>
          <td>${hits || ""}</td>
          <td>${pim || ""}</td>
          <td>${svDisplay}</td>
          <td>${gaaDisplay}</td>
        </tr>
      `;
    })
    .join("");

  container.innerHTML = `
    <div class="roster-header">
      <h3>${summary.teamName}</h3>
      <p class="roster-subtitle">
        ${summary.skaters.length} skaters · ${summary.goalies.length} goalies
      </p>
    </div>
    <div class="roster-table-wrapper">
      <table class="roster-table">
        <thead>
          <tr>
            <th>Player</th>
            <th>Pos</th>
            <th>GP</th>
            <th>G</th>
            <th>A</th>
            <th>P</th>
            <th>SOG</th>
            <th>Hits</th>
            <th>PIM</th>
            <th>SV%</th>
            <th>GAA</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
    </div>
  `;
}

// --- Bootstrap: load all teams ----------------------------------------------

async function init() {
  try {
    // 1. Load manifest
    const manifestRes = await fetch(TEAM_MANIFEST_URL);
    if (!manifestRes.ok) {
      throw new Error(`Failed to load manifest: HTTP ${manifestRes.status}`);
    }
    const manifest = await manifestRes.json();
    const teamEntries = manifest.teams || [];

    const summaries = [];

    // 2. Load each team JSON
    for (const entry of teamEntries) {
      const filePath = entry.url || `data/${entry.file}`;
      try {
        const res = await fetch(filePath);
        if (!res.ok) {
          console.error(`Failed to load team file ${filePath}: HTTP ${res.status}`);
          continue;
        }
        const teamJson = await res.json();
        const summary = computeTeamSummary(teamJson, entry.label);
        summaries.push(summary);
      } catch (err) {
        console.error(`Error loading team file ${filePath}:`, err);
      }
    }

    if (summaries.length === 0) {
      throw new Error("No team summaries could be loaded.");
    }

    // 3. Apply category-based scoring
    applyCategoryRankScoring(summaries);

    // 4. Sort teams by total fantasy score (descending)
    summaries.sort(
      (a, b) => b.totals.fantasyScore - a.totals.fantasyScore
    );

    const nTeams = summaries.length;

    // 5. Render cards in rank order
    summaries.forEach((summary, index) => {
      renderTeamCard(summary, index + 1, nTeams);
    });

    // 6. Show roster for top-ranked team by default
    renderRosterTable(summaries[0]);
  } catch (err) {
    console.error("Failed to initialize app:", err);
    const cards = document.getElementById("team-cards");
    if (cards) {
      cards.innerHTML =
        '<p style="color:#f88;">Failed to load teams. Check teams_index.json and file paths.</p>';
    }
  }
}

init();
