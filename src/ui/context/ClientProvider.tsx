import { JSXElement } from "solid-js";
import { AuthArmorClient } from "../../client/AuthArmorClient";
import { ClientContext } from "./ClientContext";

export interface IClientProviderProps {
    client: AuthArmorClient;
    children: JSXElement;
}

export function ClientProvider(props: IClientProviderProps): JSXElement {
    return <ClientContext.Provider value={props.client}>{props.children}</ClientContext.Provider>;
}
