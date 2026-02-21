export default async function handler(req, res) {
    const cronSecret = process.env.CRON_SECRET;
    const backendUrl = process.env.VITE_API_URL;

    if (!cronSecret || !backendUrl) {
        console.error('Missing configuration: CRON_SECRET or BACKEND_URL');
        return res.status(500).json({ error: 'Configuración incompleta en Vercel' });
    }

    // Verificar que la llamada venga de Vercel Cron (opcional pero recomendado)
    // Vercel envía el secret en el header Authorization: Bearer <secret>
    const authHeader = req.headers.authorization;
    if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        console.log('Triggering backend health check...');

        // Llamar al backend
        const response = await fetch(`${backendUrl}/api/webhooks/cron/health-check`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${cronSecret}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        return res.status(response.status).json({
            success: response.ok,
            backendResponse: data
        });
    } catch (error) {
        console.error('Error triggering backend health check:', error);
        return res.status(500).json({ error: 'Error al conectar con el backend', message: error.message });
    }
}
