function getAiServerUrl() {
  const configuredUrl = import.meta.env.VITE_AI_SERVER_URL;
  if (configuredUrl) return configuredUrl.replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'http://localhost:8787';
  return '';
}

export async function requestMonthlyAiReport(user, payload) {
  if (!user) {
    throw new Error('Sign in is required to generate AI reports.');
  }

  const token = await user.getIdToken();
  let response;
  try {
    response = await fetch(`${getAiServerUrl()}/api/ai/reports/monthly`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error(`Could not reach the AI server at ${getAiServerUrl()}.`);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || 'Could not generate the AI report.');
  }

  return data;
}
