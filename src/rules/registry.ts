import { config } from "../config";
import { Project } from "./project";
import { WingRiders } from "./WingRiders";

function getProject(): Project {
  switch (config.PROJECT) {
    case "WingRiders":
      return new WingRiders();
    default: {
      throw new Error(`Unsupported project ${config.PROJECT}`);
    }
  }
}

export const activeProject: Project = getProject();
