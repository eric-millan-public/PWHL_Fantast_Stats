// script.js

// Path to the JSON produced by your Python script
const TEAM_DATA_URL = "data/eric_team_stats.json";

// --- Utility helpers --------------------------------------------------------

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isNaN(n) ? 0 : n;
}

function toFloat(value) {
  const n = parseFloat(value);
  return Number.isNaN(n) ? 0 : n;
}

// Aggregate relevant fantasy stats for one team-json payload
function computeTeamSummary(teamJson) {
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

  // Placeholder simple "score" if you ever want to sort cards.
  // Adjust this function to match your league's scoring system.
  const fantasyScore =
    goals +
    assists +
    powerPlayPoints +
    hits +
    shots +
    penaltyMinutes +
    avgSavePct * 10 -
    avgGaa * 5;

  return {
    teamName: teamJson.team_name || "Unnamed Team",
    seasonId: teamJson.season_id,
    players,
    skaters,
    goalies,
    totals: {
      goals,
      assists,
      powerPlayPoints,
      powerPlayGoals,
      powerPlayAssists,
      hits,
      shots,
      penaltyMinutes,
      avgSavePct,
      avgGaa,
      fantasyScore,
    },
  };
}

// --- Rendering --------------------------------------------------------------

function renderTeamCard(summary) {
  const container = document.getElementById("team-cards");
  if (!container) return;

  const t = summary.totals;

  const card = document.createElement("article");
  card.className = "team-card";

  card.innerHTML = `
    <header class="team-card-header">
      <div>
        <div class="team-name">${summary.teamName}</div>
        <div class="team-meta">
          <span class="meta-chip meta-chip--accent">Season ${summary.seasonId}</span>
          <span class="meta-chip">${summary.skaters.length} skaters</span>
          <span class="meta-chip">${summary.goalies.length} goalies</span>
        </div>
      </div>
      <div class="meta-chip meta-chip--accent">
        Team Score: ${t.fantasyScore.toFixed(1)}
      </div>
    </header>

    <section class="team-card-body">
      <div class="stat-chip">
        <div class="stat-label">Goals</div>
        <div class="stat-value">${t.goals}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">Assists</div>
        <div class="stat-value">${t.assists}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">PP Points</div>
        <div class="stat-value">${t.powerPlayPoints}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">Hits</div>
        <div class="stat-value">${t.hits}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">Shots on Goal</div>
        <div class="stat-value">${t.shots}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">PIM</div>
        <div class="stat-value">${t.penaltyMinutes}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">Save % (avg)</div>
        <div class="stat-value stat-value--good">
          ${t.avgSavePct ? (t.avgSavePct * 100).toFixed(1) + "%" : "—"}
        </div>
      </div>
      <div class="stat-chip">
        <div class="stat-label">GAA (avg)</div>
        <div class="stat-value stat-value--bad">
          ${t.avgGaa ? t.avgGaa.toFixed(2) : "—"}
        </div>
      </div>
    </section>

    <footer class="team-card-footer">
      <p class="footer-note">
        Stats pulled from PWHL API; fantasy scoring applied client-side.
      </p>
      <span class="footer-tag">Goals · Assists · PP · Hits · SOG · PIM · SV% · GAA</span>
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
    return (a.matched_name || a.requested_name || "").localeCompare(
      b.matched_name || b.requested_name || ""
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
          <td>${isGoalie ? (p.games_played || "") : p.games_played || ""}</td>
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

// --- Bootstrap --------------------------------------------------------------

async function init() {
  try {
    const res = await fetch(TEAM_DATA_URL);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const teamJson = await res.json();
    const summary = computeTeamSummary(teamJson);

    renderTeamCard(summary);
    renderRosterTable(summary);
  } catch (err) {
    console.error("Failed to load team data:", err);
    const container = document.getElementById("team-cards");
    if (container) {
      container.innerHTML =
        '<p style="color:#f88;">Failed to load team data. Check the JSON path in script.js.</p>';
    }
  }
}

init();
