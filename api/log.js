// Vercel Serverless Function — Save and retrieve workout logs
// Uses Vercel KV (Redis) or falls back to in-memory + GitHub Issues

const GITHUB_REPO = 'fjalvarezdd/training';

export default async function handler(req, res) {
  // CORS headers for the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // POST: Save a workout session
  if (req.method === 'POST') {
    try {
      const body = req.body;

      if (!body || !body.session || !body.exercises) {
        return res.status(400).json({ error: 'Missing session data' });
      }

      // Create a GitHub Issue with the workout data
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'GitHub token not configured' });
      }

      const title = `Sesión: ${body.sessionName} — ${body.date}`;
      const exerciseLines = body.exercises.map(e =>
        `| ${e.name} | ${e.weight}${e.unit || 'kg'} | 3x${e.reps} | RPE ${e.rpe} |`
      ).join('\n');

      const issueBody = `## ${body.sessionName}
**Fecha:** ${body.date}
**Semana:** ${body.week}

| Ejercicio | Peso | Series x Reps | RPE |
|---|---|---|---|
${exerciseLines}

**Notas:** ${body.notes || 'Sin notas'}

---
*Enviado automáticamente desde la web de entrenamiento*`;

      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/issues`, {
        method: 'POST',
        headers: {
          'Authorization': `token ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          title: title,
          body: issueBody,
          labels: ['workout-log', body.week || 'semana-01']
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return res.status(500).json({ error: 'GitHub API error', details: errorText });
      }

      const issue = await response.json();
      return res.status(200).json({
        success: true,
        message: 'Sesión registrada',
        issueUrl: issue.html_url,
        issueNumber: issue.number
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  // GET: Retrieve workout logs
  if (req.method === 'GET') {
    try {
      const token = process.env.GITHUB_TOKEN;
      if (!token) {
        return res.status(500).json({ error: 'GitHub token not configured' });
      }

      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/issues?labels=workout-log&state=open&per_page=50&sort=created&direction=desc`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return res.status(500).json({ error: 'GitHub API error' });
      }

      const issues = await response.json();
      return res.status(200).json({
        success: true,
        sessions: issues.map(i => ({
          id: i.number,
          title: i.title,
          date: i.created_at,
          body: i.body,
          labels: i.labels.map(l => l.name)
        }))
      });

    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
