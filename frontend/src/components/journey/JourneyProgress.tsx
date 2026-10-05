import React from "react";
import { Camera, Eye, MapPin, CheckCircle2 } from "lucide-react";
import { JourneyStep } from "../../types/journey";

interface JourneyProgressProps {
  currentStep: JourneyStep;
}

export const JourneyProgress: React.FC<JourneyProgressProps> = ({ currentStep }) => {
  const steps = [
    { id: "capture", label: "Photo Evidence", icon: Camera },
    { id: "signals", label: "Observation", icon: Eye },
    { id: "location", label: "Location & Time", icon: MapPin },
    { id: "case", label: "Evidence Case", icon: CheckCircle2 },
  ];

  const getStepStatus = (stepId: string) => {
    const order = ["capture", "signals", "location", "submitting", "interview", "case"];
    const currentIndex = order.indexOf(currentStep);
    const stepIndex = order.indexOf(stepId);

    if (currentStep === "case") return "completed";
    if (currentIndex > stepIndex) return "completed";
    if (currentIndex === stepIndex) return "active";
    return "upcoming";
  };

  if (currentStep === "landing" || currentStep === "error") {
    return null;
  }

  return (
    <div className="mb-8 bg-brand-surface border border-brand-border rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between">
        {steps.map((s, idx) => {
          const status = getStepStatus(s.id);
          const Icon = s.icon;
          return (
            <React.Fragment key={s.id}>
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors text-xs font-semibold ${
                    status === "completed"
                      ? "bg-brand-teal text-white"
                      : status === "active"
                      ? "bg-brand-light text-brand-dark border-2 border-brand-teal"
                      : "bg-gray-100 text-gray-400"
                  }`}
                >
                  {status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-xs font-medium ${
                      status === "active"
                        ? "text-brand-dark font-bold"
                        : status === "completed"
                        ? "text-brand-teal font-semibold"
                        : "text-gray-400"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 sm:mx-4 transition-colors ${
                    status === "completed" ? "bg-brand-teal" : "bg-gray-200"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
