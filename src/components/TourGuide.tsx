import { useEffect, useState } from "react";
import { Joyride, STATUS, EVENTS, type Step } from "react-joyride";
import { useAuth } from "@/contexts/AuthContext";
import { isDemoMode } from "@/lib/demo";

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

  const handleEvent = (data: any) => {
    const { status, action, type } = data || {};
    const ended =
      type === EVENTS.TOUR_END ||
      status === STATUS.FINISHED ||
      status === STATUS.SKIPPED ||
      action === "close" ||
      action === "skip";
    if (ended) {
      setRun(false);
      if (!isCompleted) {
        markTourCompleted(tourKey);
      }
      onClose?.();
    }
  };

  if (isDemoMode()) return null;

  // react-joyride 3.x: skipBeacon (no disableBeacon) hace que el tooltip
  // aparezca directo sin el punto/beacon que requiere click.
  const stepsNoBeacon = steps.map((s) => ({ ...s, skipBeacon: true }));

  return (
    <Joyride
      steps={stepsNoBeacon}
      run={run}
      continuous
      showSkipButton
      showProgress
      onEvent={handleEvent}
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
