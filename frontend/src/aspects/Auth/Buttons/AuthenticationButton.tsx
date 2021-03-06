import { useAuth0 } from "@auth0/auth0-react";
import React from "react";
import LoginButton from "./LoginButton";
import LogoutButton from "./LogoutButton";

export default function AuthenticationButton({ asMenuItem }: { asMenuItem?: boolean }): JSX.Element {
    const { isAuthenticated } = useAuth0();

    return isAuthenticated ? <LogoutButton asMenuItem={asMenuItem} /> : <LoginButton asMenuItem={asMenuItem} />;
}
