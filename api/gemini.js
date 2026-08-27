// Esta función vive en el servidor de Vercel (nunca se ve desde el navegador).
// Recibe peticiones del CRM, les pega la llave secreta de Gemini, y regresa
// la respuesta de la IA ya lista. Así la llave nunca queda expuesta.

async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método no permitido' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'Falta configurar GEMINI_API_KEY en Vercel (Settings > Environment Variables).' });
    return;
  }

  try {
    const { prompt, image, maxTokens, json } = req.body || {};
    if (!prompt) {
      res.status(400).json({ error: 'Falta el texto (prompt).' });
      return;
    }

    const parts = [{ text: prompt }];
    if (image && image.base64) {
      parts.push({
        inline_data: {
          mime_type: image.mediaType || 'image/jpeg',
          data: image.base64
        }
      });
    }

    const model = 'gemini-3.6-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const generationConfig = { maxOutputTokens: maxTokens || 800 };
    if (json) { generationConfig.responseMimeType = 'application/json'; }

    const geminiRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts }],
        generationConfig
      })
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      console.error('Error de Gemini:', data);
      res.status(geminiRes.status).json({ error: (data.error && data.error.message) || 'Error al conectar con la IA.' });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const text = (candidate && candidate.content && candidate.content.parts || [])
      .map(p => p.text || '')
      .join('');

    res.status(200).json({ text });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Error interno al conectar con la IA.' });
  }
}

// Le da hasta 60 segundos a esta función antes de cortarla (por defecto Vercel
// corta a los 10 segundos, y los modelos de IA más nuevos a veces tardan más).
handler.config = { maxDuration: 60 };

module.exports = handler;
