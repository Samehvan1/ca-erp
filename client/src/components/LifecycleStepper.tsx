import React from "react";

export interface StepItem {
  id: string;
  label: string;
  description?: string;
  timestamp?: string;
  status: "completed" | "current" | "upcoming" | "warning" | "error";
  badgeText?: string;
}

export interface LifecycleStepperProps {
  steps: StepItem[];
  onStepClick?: (step: StepItem, index: number) => void;
  className?: string;
}

export function LifecycleStepper({ steps, onStepClick, className = "" }: LifecycleStepperProps) {
  return (
    <div className={`lifecycle-stepper ${className}`}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <React.Fragment key={step.id}>
            <div
              className={`step-node step-${step.status} ${onStepClick ? "interactive" : ""}`}
              onClick={() => onStepClick && onStepClick(step, idx)}
            >
              <div className="step-circle">
                {step.status === "completed" && <span className="step-icon">✓</span>}
                {step.status === "current" && <span className="step-icon">●</span>}
                {step.status === "warning" && <span className="step-icon">!</span>}
                {step.status === "error" && <span className="step-icon">✕</span>}
                {step.status === "upcoming" && <span className="step-number">{idx + 1}</span>}
              </div>
              <div className="step-info">
                <div className="step-label-row">
                  <span className="step-label">{step.label}</span>
                  {step.badgeText && <span className="step-badge">{step.badgeText}</span>}
                </div>
                {step.description && <span className="step-desc">{step.description}</span>}
                {step.timestamp && <span className="step-time">{step.timestamp}</span>}
              </div>
            </div>
            {!isLast && <div className={`step-connector connector-${step.status}`} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
