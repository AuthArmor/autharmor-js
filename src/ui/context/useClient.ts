import { useContext } from "solid-js";
import { ClientContext } from "./ClientContext";
import { AuthArmorClient } from "../../client/AuthArmorClient";

export function useClient(): AuthArmorClient {
    const client = useContext(ClientContext);

    if (client === undefined) {
        throw new Error("Client context is not defined.");
    }

    return client;
}
