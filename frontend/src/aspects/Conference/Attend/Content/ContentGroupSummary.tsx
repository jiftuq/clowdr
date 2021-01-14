import { Box, Container, Heading, Text, VStack } from "@chakra-ui/react";
import {
    assertIsContentItemDataBlob,
    ContentBaseType,
    ContentItemDataBlob,
    PaperLinkBlob,
    PaperUrlBlob,
    ZoomBlob,
} from "@clowdr-app/shared-types/build/content";
import * as R from "ramda";
import React, { useMemo } from "react";
import { ContentGroupDataFragment, ContentType_Enum, Permission_Enum } from "../../../../generated/graphql";
import { ExternalLinkButton } from "../../../Chakra/LinkButton";
import { Markdown } from "../../../Text/Markdown";
import RequireAtLeastOnePermissionWrapper from "../../RequireAtLeastOnePermissionWrapper";
import { AuthorList } from "./AuthorList";

export function ContentGroupSummary({ contentGroupData }: { contentGroupData: ContentGroupDataFragment }): JSX.Element {
    const abstractContentItem = useMemo(() => {
        const abstractItem = contentGroupData.contentItems.find(
            (contentItem) => contentItem.contentTypeName === ContentType_Enum.Abstract
        );
        try {
            assertIsContentItemDataBlob(abstractItem?.data);
            const latestVersion = R.last(abstractItem.data);

            return (
                <Box mt={5}>
                    <Markdown>
                        {latestVersion?.data.baseType === ContentBaseType.Text ? latestVersion.data.text : ""}
                    </Markdown>
                </Box>
            );
        } catch (e) {
            return <></>;
        }
    }, [contentGroupData.contentItems]);

    const maybeZoomDetails = useMemo(() => {
        const zoomItem = contentGroupData.contentItems.find(
            (contentItem) => contentItem.contentTypeName === ContentType_Enum.Zoom
        );

        if (!zoomItem) {
            return undefined;
        }

        const versions = zoomItem.data as ContentItemDataBlob;

        return (R.last(versions)?.data as ZoomBlob).url;
    }, [contentGroupData.contentItems]);

    const maybePaperURL = useMemo(() => {
        const item = contentGroupData.contentItems.find(
            (contentItem) => contentItem.contentTypeName === ContentType_Enum.PaperUrl
        );

        if (!item) {
            return undefined;
        }

        const versions = item.data as ContentItemDataBlob;

        return (R.last(versions)?.data as PaperUrlBlob).url;
    }, [contentGroupData.contentItems]);

    const maybePaperLink = useMemo(() => {
        const item = contentGroupData.contentItems.find(
            (contentItem) => contentItem.contentTypeName === ContentType_Enum.PaperLink
        );

        if (!item) {
            return undefined;
        }

        const versions = item.data as ContentItemDataBlob;

        return R.last(versions)?.data as PaperLinkBlob;
    }, [contentGroupData.contentItems]);

    return (
        <Box alignItems="left" textAlign="left" my={5}>
            <Text colorScheme="green">{contentGroupData.contentGroupTypeName}</Text>
            <Heading as="h2" size="md" mb={5} textAlign="left">
                {contentGroupData.title}
            </Heading>
            {<AuthorList contentPeopleData={contentGroupData.people ?? []} />}
            <VStack w="auto" alignItems="flex-start">
                <RequireAtLeastOnePermissionWrapper
                    permissions={[Permission_Enum.ConferenceViewAttendees]}
                >
                    {maybeZoomDetails ? (
                        <ExternalLinkButton
                            to={maybeZoomDetails}
                            isExternal={true}
                            colorScheme="green"
                            linkProps={{ mt: 5 }}
                        >
                            Go to Zoom
                        </ExternalLinkButton>
                    ) : (
                        <></>
                        )}
                </RequireAtLeastOnePermissionWrapper>
                {maybePaperURL ? (
                    <ExternalLinkButton to={maybePaperURL} isExternal={true} colorScheme="red" linkProps={{ mt: 5 }}>
                        Read the PDF
                    </ExternalLinkButton>
                ) : (
                    <></>
                )}
                {maybePaperLink ? (
                    <ExternalLinkButton
                        to={maybePaperLink.url}
                        isExternal={true}
                        colorScheme="blue"
                        linkProps={{ mt: 5 }}
                    >
                        {maybePaperLink.text}
                    </ExternalLinkButton>
                ) : (
                    <></>
                )}
            </VStack>
            <Container width="100%" mt={5} ml={0} pl={0}>
                {abstractContentItem}
            </Container>
        </Box>
    );
}
