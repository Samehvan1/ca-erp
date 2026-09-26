import { TransferOrder } from "./types";
import { LifecycleStepper, StepItem } from "../../components/LifecycleStepper";

export interface TransferStepperProps {
  order: TransferOrder;
}

export function TransferStepper({ order }: TransferStepperProps) {
  const status = (order.status || "REQUESTED").toUpperCase();

  const getStepStatus = (stepName: string): StepItem["status"] => {
    if (status === "CANCELLED") return "error";

    const stageOrder = ["REQUESTED", "APPROVED", "DISPATCHED", "IN_TRANSIT", "RECEIVED"];
    const curIdx = stageOrder.indexOf(status);
    const stepIdx = stageOrder.indexOf(stepName);

    if (curIdx === -1) return "upcoming";
    if (stepIdx < curIdx) return "completed";
    if (stepIdx === curIdx) return "current";
    return "upcoming";
  };

  const steps: StepItem[] = [
    {
      id: "requested",
      label: "Transfer Requested",
      description: `From ${order.requisition?.fromWarehouse?.code || "Origin"}`,
      status: getStepStatus("REQUESTED"),
      badgeText: "Requisition",
    },
    {
      id: "approved",
      label: "Order Approved",
      description: "Ready for picking",
      status: getStepStatus("APPROVED"),
    },
    {
      id: "dispatched",
      label: "Dispatched",
      description: order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleDateString("en-GB") : "Pending dispatch",
      timestamp: order.dispatchedAt ? new Date(order.dispatchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      status: getStepStatus("DISPATCHED"),
    },
    {
      id: "in_transit",
      label: "In-Transit",
      description: `En route to ${order.requisition?.toWarehouse?.code || "Destination"}`,
      status: getStepStatus("IN_TRANSIT"),
    },
    {
      id: "received",
      label: "Branch Received",
      description: order.receivedAt ? new Date(order.receivedAt).toLocaleDateString("en-GB") : "Awaiting arrival",
      timestamp: order.receivedAt ? new Date(order.receivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined,
      status: getStepStatus("RECEIVED"),
    },
  ];

  return <LifecycleStepper steps={steps} className="transfer-pipeline-stepper" />;
}
