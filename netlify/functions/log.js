// Netlify Serverless Function — Save and retrieve workout logs via GitHub Issues

const GITHUB_REPO = 'fjalvarezdd/training';

exports.handler = async function(event, context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return {
      statusCode: 500, headers,
      body: JSON.stringify({ error: 'GITHUB_TOKEN not configured in Netlify environment variables' })
    };
  }

  // POST: Save a workout session as a GitHub Issue
  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body);

      if (!body || !body.session || !body.exercises) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing session data' }) };
      }

      const title = 'Sesion: ' + body.sessionName + ' — ' + body.date;
      const exerciseLines = body.exercises.map(function(e) {
        return '| ' + e.name + ' | ' + e.weight + (e.unit || 'kg') + ' | 3x' + e.reps + ' | RPE ' + e.rpe + ' |';
      }).join('\n');

      const issueBody = '## ' + body.sessionName + '\n' +
        '**Fecha:** ' + body.date + '\n' +
        '**Semana:** ' + body.week + '\n\n' +
        '| Ejercicio | Peso | Series x Reps | RPE |\n' +
        '|---|---|---|---|\n' +
        exerciseLines + '\n\n' +
        '**Notas:** ' + (body.notes || 'Sin notas') + '\n\n' +
        '---\n*Enviado desde la web de entrenamiento*';

      const response = await fetch('https://api.github.com/repos/' + GITHUB_REPO + '/issues', {
        method: 'POST',
        headers: {
          'Authorization': 'token ' + token,
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
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'GitHub API error', details: errorText }) };
      }

      const issue = await response.json();
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          message: 'Sesion registrada',
          issueUrl: issue.html_url,
          issueNumber: issue.number
        })
      };
    } catch (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  // GET: Retrieve workout logs
  if (event.httpMethod === 'GET') {
    try {
      const response = await fetch(
        'https://api.github.com/repos/' + GITHUB_REPO + '/issues?labels=workout-log&state=open&per_page=50&sort=created&direction=desc',
        {
          headers: {
            'Authorization': 'token ' + token,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (!response.ok) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'GitHub API error' }) };
      }

      const issues = await response.json();
      return {
        statusCode: 200, headers,
        body: JSON.stringify({
          success: true,
          sessions: issues.map(function(i) {
            return { id: i.number, title: i.title, date: i.created_at, body: i.body, labels: i.labels.map(function(l) { return l.name; }) };
          })
        })
      };
    } catch (error) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
    }
  }

  return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
};
