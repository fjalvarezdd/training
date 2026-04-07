// Cloudflare Pages Function — Save and retrieve workout logs via GitHub Issues

const GITHUB_REPO = 'fjalvarezdd/training';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

export async function onRequestOptions() {
  return new Response(null, { status: 200, headers: corsHeaders });
}

export async function onRequestPost(context) {
  const token = context.env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GITHUB_TOKEN not configured in Cloudflare environment variables' }, 500);
  }

  try {
    const body = await context.request.json();

    if (!body || !body.session || !body.exercises) {
      return jsonResponse({ error: 'Missing session data' }, 400);
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
        'Accept': 'application/vnd.github.v3+json',
      },
      body: JSON.stringify({
        title: title,
        body: issueBody,
        labels: ['workout-log', body.week || 'semana-01'],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({ error: 'GitHub API error', details: errorText }, 500);
    }

    const issue = await response.json();
    return jsonResponse({
      success: true,
      message: 'Sesion registrada',
      issueUrl: issue.html_url,
      issueNumber: issue.number,
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

export async function onRequestGet(context) {
  const token = context.env.GITHUB_TOKEN;
  if (!token) {
    return jsonResponse({ error: 'GITHUB_TOKEN not configured in Cloudflare environment variables' }, 500);
  }

  try {
    const response = await fetch(
      'https://api.github.com/repos/' + GITHUB_REPO + '/issues?labels=workout-log&state=open&per_page=50&sort=created&direction=desc',
      {
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );

    if (!response.ok) {
      return jsonResponse({ error: 'GitHub API error' }, 500);
    }

    const issues = await response.json();
    return jsonResponse({
      success: true,
      sessions: issues.map(function(i) {
        return {
          id: i.number,
          title: i.title,
          date: i.created_at,
          body: i.body,
          labels: i.labels.map(function(l) { return l.name; }),
        };
      }),
    });
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
