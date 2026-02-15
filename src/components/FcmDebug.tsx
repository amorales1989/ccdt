import React, { useState, useEffect } from 'react';
import { useFcm } from '@/hooks/useFcm';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Copy, RefreshCw, Bell } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export function FcmDebug() {
    const {
        fcmToken,
        fcmSoportado,
        fcmInicializado,
        fcmDisponible,
        refrescarTokenFcm,
        inicializarFcm
    } = useFcm();

    const [permissionState, setPermissionState] = useState<NotificationPermission>(Notification.permission);
    const [lastMessage, setLastMessage] = useState<any>(null);

    useEffect(() => {
        // Escuchar cambios en permisos (aunque el evento no es muy confiable en todos los browsers)
        if (navigator.permissions && navigator.permissions.query) {
            navigator.permissions.query({ name: 'notifications' }).then((permissionStatus) => {
                setPermissionState(permissionStatus.state as NotificationPermission);
                permissionStatus.onchange = () => {
                    setPermissionState(permissionStatus.state as NotificationPermission);
                };
            });
        }
    }, []);

    // Escuchar mensajes (esto es un hack, idealmente useFcm expondría el último mensaje)
    useEffect(() => {
        const handleMessage = (event: any) => {
            // Si usas un CustomEvent o algo similar en tu onMessage
            console.log('FCM Debug detected message', event);
        };

        // Si tu service worker o firebase.js despacha eventos al window, escúchalos aquí
        // window.addEventListener('fcm-message', handleMessage);
        // return () => window.removeEventListener('fcm-message', handleMessage);
    }, []);


    const handleCopyToken = () => {
        if (fcmToken) {
            navigator.clipboard.writeText(fcmToken);
            toast({
                title: "Token copiado",
                description: "El token FCM ha sido copiado al portapapeles",
            });
        }
    };

    const handleRefreshToken = async () => {
        const token = await refrescarTokenFcm();
        if (token) {
            toast({
                title: "Token refrescado",
                description: "Se ha obtenido un nuevo token FCM",
            });
        } else {
            toast({
                title: "Error",
                description: "No se pudo refrescar el token",
                variant: "destructive",
            });
        }
    };

    const requestPermission = async () => {
        const result = await Notification.requestPermission();
        setPermissionState(result);
        if (result === 'granted') {
            inicializarFcm();
        }
    };

    if (!fcmSoportado && fcmInicializado) {
        return (
            <Card className="border-red-200 bg-red-50">
                <CardHeader>
                    <CardTitle className="text-red-700">FCM No Soportado</CardTitle>
                    <CardDescription className="text-red-600">
                        Tu navegador no soporta notificaciones Push o Firebase Messaging.
                    </CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card className="w-full mt-6 border-blue-200 shadow-sm">
            <CardHeader className="bg-blue-50/50 pb-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Bell className="h-5 w-5 text-blue-600" />
                        <CardTitle>Diagnóstico de Notificaciones</CardTitle>
                    </div>
                    <Badge variant={fcmDisponible ? "default" : "secondary"} className={fcmDisponible ? "bg-green-600" : ""}>
                        {fcmDisponible ? "Conectado" : "Desconectado"}
                    </Badge>
                </div>
                <CardDescription>
                    Herramienta para depurar problemas con las notificaciones push.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 pt-6">

                {/* Permisos */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">Estado del Permiso</Label>
                        <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${permissionState === 'granted' ? 'text-green-600' :
                                permissionState === 'denied' ? 'text-red-600' : 'text-yellow-600'
                                }`}>
                                {permissionState === 'granted' ? 'Permitido (Granted)' :
                                    permissionState === 'denied' ? 'Denegado (Denied)' : 'Preguntar (Default)'}
                            </span>
                            {permissionState !== 'granted' && (
                                <Button size="sm" variant="outline" onClick={requestPermission} className="h-6 text-xs">
                                    Solicitar
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="space-y-1">
                        <Label className="text-muted-foreground text-xs uppercase font-bold">Service Worker</Label>
                        <div className="text-sm font-medium">
                            {'serviceWorker' in navigator ? 'Disponible' : 'No soportado'}
                        </div>
                    </div>
                </div>

                {/* Token */}
                <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs uppercase font-bold">FCM Token</Label>
                    <div className="flex gap-2">
                        <Input
                            readOnly
                            value={fcmToken || "No generado aún..."}
                            className="font-mono text-xs bg-muted/50"
                        />
                        <Button size="icon" variant="outline" onClick={handleCopyToken} disabled={!fcmToken} title="Copiar Token">
                            <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="outline" onClick={handleRefreshToken} title="Refrescar Token">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                    {!fcmToken && permissionState === 'granted' && (
                        <p className="text-xs text-yellow-600">
                            * Si el permiso está concedido pero no hay token, verifica la consola del navegador y el archivo firebase-messaging-sw.js
                        </p>
                    )}
                </div>

            </CardContent>
        </Card>
    );
}
