import { useContext } from "react";
import { InstallContext } from "../context/InstallContext";

export const useInstall = () => useContext(InstallContext);
