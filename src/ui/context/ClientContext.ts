import { createContext } from "solid-js";
import { AuthArmorClient } from "../../client/AuthArmorClient";

export const ClientContext = createContext<AuthArmorClient>();
