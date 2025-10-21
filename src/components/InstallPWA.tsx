import { useState } from 'react';
import { useInstallPrompt } from '@/hooks/useInstallPrompt';
import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const InstallPWA = () => {
  const { isInstallable, isInstalled, promptInstall } = useInstallPrompt();
  const [showBanner, setShowBanner] = useState(true);

  const handleInstall = async () => {
    const accepted = await promptInstall();
    if (accepted) {
      setShowBanner(false);
    }
  };

  if (isInstalled || !isInstallable || !showBanner) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md animate-in slide-in-from-top-5 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-center gap-3">
        <div className="flex-shrink-0">
          <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
            <Download className="w-6 h-6 text-primary" />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-foreground">
            Instalar CCDT App
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Accede más rápido desde tu pantalla principal
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            onClick={handleInstall}
            size="sm"
            className="whitespace-nowrap"
          >
            Instalar
          </Button>
          
          <Button
            onClick={() => setShowBanner(false)}
            size="sm"
            variant="ghost"
            className="p-2 h-auto"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};