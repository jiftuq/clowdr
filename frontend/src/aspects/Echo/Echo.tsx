import { gql } from "@apollo/client";
import React from "react";
import { useEchoQuery } from "../../generated/graphql";

const echoQuery = gql`
    query Echo($message: String!) {
        echo(message: $message) {
            message
        }
    }
`;

export default function Echo(): JSX.Element {
    const query = useEchoQuery({
        variables: {
            message: "Test unprotected echo message",
        },
    });
    if (query.loading) {
        return <>Loading&#8230;</>;
    } else if (query.error) {
        return <>Query error! {query.error.message}</>;
    } else if (query.data) {
        return <>Hello, world! {query.data.echo?.message}.</>;
    } else {
        return <>Hello, world! No data?!.</>;
    }
}
