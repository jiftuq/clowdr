import { gql } from "@apollo/client";
import {
    Box,
    Button,
    Center,
    FormControl,
    FormHelperText,
    FormLabel,
    Heading,
    Input,
    InputGroup,
    InputLeftAddon,
    InputRightElement,
    SimpleGrid,
    Spinner,
    Text,
    useColorModeValue,
    VStack,
} from "@chakra-ui/react";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ContentGroupDataFragment, TagWithContentFragment, useContentByTagQuery } from "../../../../generated/graphql";
import LinkButton from "../../../Chakra/LinkButton";
import useQueryErrorToast from "../../../GQL/useQueryErrorToast";
import FAIcon from "../../../Icons/FAIcon";
import { useConference } from "../../useConference";

gql`
    fragment TagWithContent on Tag {
        ...TagInfo
        contentGroupTags {
            contentGroup {
                ...ContentGroupData
            }
        }
    }

    query ContentByTag($conferenceId: uuid!) {
        Tag(where: { conferenceId: { _eq: $conferenceId } }) {
            ...TagWithContent
        }
    }
`;

function TagButton({
    tag,
    isExpanded,
    setOpenId,
}: {
    tag: TagWithContentFragment;
    isExpanded: boolean;
    setOpenId: (id: string) => void;
}): JSX.Element {
    const colour = tag.colour.replace(/\s/g, "") === "rgba(0,0,0,0)" ? undefined : tag.colour;
    const collapsedBgColour = useColorModeValue("blue.200", "blue.700");
    const expandedBgColour = useColorModeValue("blue.300", "gray.500");
    return (
        <Button
            colorScheme="blue"
            isActive={isExpanded}
            aria-expanded={isExpanded}
            padding={[1, 1, 5]}
            whiteSpace="normal"
            margin={0}
            color={colour}
            height="auto"
            borderWidth={2}
            borderColor={isExpanded ? expandedBgColour : collapsedBgColour}
            variant="outline"
            id={`content-groups-accordion-button-${tag.id}`}
            aria-controls={`content-groups-accordion-panel-${tag.id}`}
            onClick={() => setOpenId(tag.id)}
            backgroundColor={isExpanded ? expandedBgColour : collapsedBgColour}
        >
            <Center>
                <Text as="span" fontSize="1.2rem" marginBottom="0.5rem" fontWeight={600} m={0}>
                    {tag.name}
                </Text>
            </Center>
        </Button>
    );
}

function ContentGroupButton({ group }: { group: ContentGroupDataFragment }): JSX.Element {
    const conference = useConference();
    const textColour = useColorModeValue("gray.500", "gray.400");
    return (
        <LinkButton
            to={`/conference/${conference.slug}/item/${group.id}`}
            p={[2, 4]}
            alignItems="flex-start"
            justifyContent="flex-start"
            flexDir="column"
            width="100%"
            height="100%"
        >
            <Text as="p" whiteSpace="normal" fontSize="1.2em" fontWeight="600" textAlign="left" mb={4}>
                {group.title}
            </Text>
            <Text as="p" fontSize="0.9em" textColor={textColour} whiteSpace="normal" lineHeight="3ex">
                {group.people.reduce((acc, person) => `${acc}, ${person.person.name}`, "").substr(2)}
            </Text>
        </LinkButton>
    );
}

function Panel({ tag, isExpanded }: { tag: TagWithContentFragment; isExpanded: boolean }): JSX.Element {
    const [search, setSearch] = useState<string>("");

    const sortedGroups = useMemo(
        () => tag.contentGroupTags.map((x) => x.contentGroup).sort((x, y) => x.title.localeCompare(y.title)),
        [tag.contentGroupTags]
    );
    const groupElements = useMemo(
        () =>
            sortedGroups.map((group) => ({
                title: group.title.toLowerCase(),
                names: group.people.map((person) => person.person.name.toLowerCase()),
                affiliations: group.people.map((person) => person.person.affiliation?.toLowerCase() ?? ""),
                el: <ContentGroupButton key={group.id} group={group} />,
            })),
        [sortedGroups]
    );
    const filteredElements = groupElements.filter((g) => {
        return (
            g.title.includes(search) ||
            g.names.some((name) => name.includes(search)) ||
            g.affiliations.some((affiliation) => affiliation.includes(search))
        );
    });

    const resultCountStr = `${filteredElements.length} ${filteredElements.length !== 1 ? "items" : "items"}`;
    const [ariaSearchResultStr, setAriaSearchResultStr] = useState<string>(resultCountStr);
    useEffect(() => {
        const tId = setTimeout(() => {
            setAriaSearchResultStr(resultCountStr);
        }, 250);
        return () => {
            clearTimeout(tId);
        };
    }, [resultCountStr]);

    return (
        <Center
            role="region"
            aria-labelledby={`content-groups-accordion-button-${tag.id}`}
            hidden={!isExpanded ? true : undefined}
            transition={"height 5s linear"}
            overflow="hidden"
            height="auto"
            width="100%"
            flexDir="column"
            p={2}
        >
            <Heading as="h3" fontSize="1.4rem" marginBottom="0.5rem" mb={4}>
                {tag.name}
            </Heading>
            <FormControl mb={4} maxW={400}>
                <InputGroup>
                    <InputLeftAddon aria-hidden>Search</InputLeftAddon>
                    <Input
                        aria-label={"Search found " + ariaSearchResultStr}
                        type="text"
                        placeholder="Search"
                        value={search}
                        onChange={(ev) => {
                            setSearch(ev.target.value);
                        }}
                    />
                    <InputRightElement>
                        <FAIcon iconStyle="s" icon="search" />
                    </InputRightElement>
                </InputGroup>
                <FormHelperText>Search for an item by title or a person&apos;s name or affiliation.</FormHelperText>
                <FormLabel mt={4} textAlign="center">
                    {resultCountStr}
                </FormLabel>
            </FormControl>
            <SimpleGrid columns={[1, 2, 3]} autoRows="min-content" spacing={[2, 2, 4]}>
                {filteredElements.map((g) => g.el)}
            </SimpleGrid>
        </Center>
    );
}

export default function ContentGroupList(): JSX.Element {
    const conference = useConference();
    const { loading, data, error } = useContentByTagQuery({
        variables: {
            conferenceId: conference.id,
        },
    });
    useQueryErrorToast(error);

    const previousOpenPanelId = window.localStorage.getItem("ContentGroupList-OpenPanelId");
    const [openPanelId, setOpenPanelId] = useState<string | null>(previousOpenPanelId ?? null);
    const setOpenId = useCallback((id: string) => {
        setOpenPanelId((oldId) => {
            const newId = oldId === id ? null : id;
            if (newId) {
                window.localStorage.setItem("ContentGroupList-OpenPanelId", newId);
            } else {
                window.localStorage.removeItem("ContentGroupList-OpenPanelId");
            }
            return newId;
        });
    }, []);

    const sortedTags = useMemo(
        () => data?.Tag.filter((tag) => tag.contentGroupTags.length > 0).sort((x, y) => x.name.localeCompare(y.name)),
        [data?.Tag]
    );

    if (loading && !sortedTags) {
        return (
            <Box>
                <Spinner />
            </Box>
        );
    }

    if (!sortedTags) {
        return <></>;
    }

    return (
        <VStack spacing={4}>
            <Heading as="h2" fontSize="1.4em" id="content-groups-accordion-header">
                Pre-published content
            </Heading>
            <Center flexDirection="column">
                <SimpleGrid
                    aria-describedby="content-groups-accordion-header"
                    columns={[1, 2, 3, 4]}
                    maxW={1024}
                    autoRows={["min-content", "min-content", "1fr"]}
                    spacing={[2, 2, 4]}
                >
                    {sortedTags.map((tag) => (
                        <TagButton key={tag.id} tag={tag} setOpenId={setOpenId} isExpanded={openPanelId === tag.id} />
                    ))}
                </SimpleGrid>
                <Box overflow="hidden" pt={6} justifyContent="center">
                    {sortedTags.map((tag) => (
                        <Panel key={tag.id} tag={tag} isExpanded={openPanelId === tag.id} />
                    ))}
                </Box>
            </Center>
        </VStack>
    );
}