import { useEffect, useState } from "react";
import { Joyride, STATUS, type CallBackProps, type Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";

interface TourGuideProps {
  tourKey: string;
  steps: Step[];
  autoStart?: boolean;
  run?: boolean;
  onClose?: () => void;
}

export const TourGuide = ({
  tourKey,
  steps,
  autoStart = true,
  run: runProp,
  onClose,
}: TourGuideProps) => {
  const { profile, markTourCompleted } = useAuth();
  const [run, setRun] = useState(false);

  const isCompleted = Boolean(profile?.completed_tours?.includes(tourKey));

  useEffect(() => {
    if (runProp !== undefined) {
      setRun(runProp);
      return;
    }
    if (autoStart && profile && !isCompleted) {
      const t = setTimeout(() => setRun(true), 600);
      return () => clearTimeout(t);
    }
  }, [tourKey, autoStart, runProp, profile, isCompleted]);

  const handleCallback = (data: CallBackProps) => {
    const { status, action } = data;
    const finished = [STATUS.FINISHED, STATUS.SKIPPED, STATUS.PAUSED].includes(status as any);
    if (finished || action === "close" || action === "reset") {
      setRun(false);
      if (!isCompleted) {
        markTourCompleted(tourKey);
      }
      onClose?.();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showSkipButton
      showProgress
      callback={handleCallback}
      locale={{
        back: "Atrás",
        close: "Cerrar",
        last: "Finalizar",
        next: "Siguiente",
        skip: "Saltar",
      }}
      styles={{
        options: {
          primaryColor: "#7c3aed",
          zIndex: 10000,
          arrowColor: "#fff",
          backgroundColor: "#fff",
          textColor: "#1f2937",
        },
        tooltip: { borderRadius: 14, fontSize: 14 },
        buttonNext: { borderRadius: 10, fontWeight: 700 },
        buttonBack: { color: "#7c3aed", fontWeight: 600 },
      }}
    />
  );
};
