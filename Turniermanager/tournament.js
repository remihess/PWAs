// Spielplanregeln für die Vorrunde.
window.TournamentRules = (() => {
    function fixtureCount(teamCount, gamesPerTeam) {
        const appearances = teamCount * gamesPerTeam;
        return Number.isSafeInteger(appearances) && appearances % 2 === 0 ? appearances / 2 : null;
    }

    function shuffle(items) {
        const shuffled = [...items];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }

    function drawFixtures(teamIds, gamesPerTeam) {
        const ids = shuffle(teamIds);
        const n = ids.length;
        const fixtures = [];
        const lastMatch = Array(n).fill(null);
        const startsHome = ids.map((_, i) => i < Math.floor(n / 2));

        function addMatch(home, away) {
            const match = { home: ids[home], away: ids[away], next: [], pending: 0 };
            fixtures.push(match);
            return match;
        }

        function orderForTeam(team, match) {
            const previous = lastMatch[team];
            if (previous) {
                previous.next.push(match);
                match.pending++;
            }
            lastMatch[team] = match;
        }

        // Ein Rundlauf je Abstand liefert genau zwei verschiedene Gegner pro Team.
        // Die beiden Hälften beginnen auf verschiedenen Seiten. Dadurch lässt sich
        // jeder Rundlauf so ordnen, dass alle Teams genau einmal die Seite wechseln.
        for (let remaining = gamesPerTeam; remaining > 0;) {
            const degree = Math.min(remaining, n - 1);
            remaining -= degree;

            const distances = shuffle(Array.from({ length: Math.floor((n - 1) / 2) }, (_, i) => i + 1));
            for (const distance of distances.slice(0, Math.floor(degree / 2))) {
                const cycle = ids.map((_, i) => addMatch(i, (i + distance) % n));
                if (gamesPerTeam === 2) continue; // Die Richtung allein garantiert den Seitenwechsel.
                for (let i = 0; i < n; i++) {
                    const home = cycle[i];
                    const away = cycle[(i - distance + n) % n];
                    orderForTeam(i, startsHome[i] ? home : away);
                    orderForTeam(i, startsHome[i] ? away : home);
                }
            }

            // Bei gerader Teamzahl liefert der gegenüberliegende Gegner den einzelnen
            // zusätzlichen Spieltermin. Jeder Gegner kommt einmal pro vollem Umlauf vor.
            if (degree % 2 === 1) {
                for (let i = 0; i < n / 2; i++) {
                    const opposite = i + n / 2;
                    const match = startsHome[i] ? addMatch(i, opposite) : addMatch(opposite, i);
                    orderForTeam(i, match);
                    orderForTeam(opposite, match);
                    startsHome[i] = !startsHome[i];
                    startsHome[opposite] = !startsHome[opposite];
                }
            }
        }
        return fixtures;
    }

    function placeFixtures(fixtures, tables) {
        const pending = new Map(fixtures.map(match => [match, match.pending]));
        const available = new Set(shuffle(fixtures.filter(match => match.pending === 0)));
        const slots = [];
        let previousTeams = new Set();
        let placed = 0;

        while (placed < fixtures.length) {
            if (!available.size) throw new Error('Der Spielplan enthält widersprüchliche Abhängigkeiten.');
            const playing = new Set();
            const slot = [];
            for (const match of available) {
                if (previousTeams.has(match.home) || previousTeams.has(match.away) ||
                    playing.has(match.home) || playing.has(match.away)) continue;
                slot.push(match);
                playing.add(match.home);
                playing.add(match.away);
                if (slot.length === tables) break;
            }
            slots.push(slot);
            for (const match of slot) {
                available.delete(match);
                for (const next of match.next) {
                    pending.set(next, pending.get(next) - 1);
                    if (pending.get(next) === 0) available.add(next);
                }
            }
            placed += slot.length;
            previousTeams = playing;
        }
        return slots;
    }

    function automaticSchedule(teamIds, gamesPerTeam, tables) {
        let best;
        let bestPauses = Infinity;
        const lowerBound = Math.max(
            Math.ceil(fixtureCount(teamIds.length, gamesPerTeam) / Math.min(tables, Math.floor(teamIds.length / 2))),
            2 * gamesPerTeam - 1
        );
        // Mehrere Ziehungen reduzieren Leerzeiten, ohne Spielanzahl oder Fairness zu lockern.
        for (let attempt = 0; attempt < 32; attempt++) {
            const candidate = placeFixtures(drawFixtures(teamIds, gamesPerTeam), tables);
            const pauses = candidate.filter(slot => slot.length === 0).length;
            if (!best || candidate.length < best.length ||
                (candidate.length === best.length && pauses < bestPauses)) {
                best = candidate;
                bestPauses = pauses;
            }
            if (best.length === lowerBound && bestPauses === 0) break;
        }
        return best.map(slot => slot.map(({ home, away }) => ({ home, away })));
    }

    return { fixtureCount, automaticSchedule };
})();
