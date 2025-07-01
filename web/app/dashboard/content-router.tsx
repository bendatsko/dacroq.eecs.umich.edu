"use client";

import { DashboardContent } from "./content/Dashboard";
import {SATContent} from "./content/SAT";
import {LDPCContent} from "./content/LDPC";
import {KSatContent} from "./content/KSAT";

interface ContentRouterProps {
  activeSection: string;
  setActiveSection: (section: string) => void;
}

export const ContentRouter: React.FC<ContentRouterProps> = ({
  activeSection,
  setActiveSection,
}) => {
  switch (activeSection) {
    case "Dashboard":
      return <DashboardContent setActiveSection={setActiveSection} />;
    case "3-SAT Solver":
      return <SATContent setActiveSection={setActiveSection} />;
    case "LDPC Solver":
      return <LDPCContent setActiveSection={setActiveSection}/>;
    case "k-SAT Solver":
      return <KSatContent setActiveSection={setActiveSection} />;
    default:
      return <DashboardContent setActiveSection={setActiveSection} />;
  }
};
